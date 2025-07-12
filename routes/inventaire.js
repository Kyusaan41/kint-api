// /routes/inventaire.js (version finale, complète et corrigée)

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const {
    loadInventaire,
    saveInventaire,
    loadEffects,
    saveEffects,
} = require('../inventaire');
const { loadCurrency, saveCurrency } = require('../currency.js');

const LOTTERY_FILE = path.join(__dirname, '../lottery.json');

const loadJSON = (filePath) => fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
const saveJSON = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

module.exports = function(client, redisClient) {

    // ✅ Fonction corrigée pour utiliser les listes Redis (la "boîte aux lettres")
    const sendMessageToUserMailbox = async (userId, data) => {
        const eventPayload = {
            targetUserId: userId,
            ...data
        };
        try {
            // Utilise RPUSH pour ajouter le message à la fin de la liste de l'utilisateur
            await redisClient.rPush(`mailbox:${userId}`, JSON.stringify(eventPayload));
            console.log(`[Mailbox] Message ajouté à la boîte de l'utilisateur ${userId}`);
        } catch (error) {
            console.error("[Mailbox] Erreur lors de l'ajout du message:", error);
        }
    };

    router.get('/:userId', (req, res) => {
        try {
            const inventaire = loadInventaire();
            res.json(inventaire[req.params.userId] || {});
        } catch (e) {
            console.error("Erreur dans GET /api/inventaire/:userId", e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/use', async (req, res) => {
        const { userId, itemId, extraData } = req.body;

        if (!userId || !itemId) {
            return res.status(400).json({ message: "Données manquantes : userId et itemId sont requis." });
        }

        try {
            const inventaire = loadInventaire();
            const userInventory = inventaire[userId];
            const realItemName = Object.keys(userInventory || {}).find(key => key.toLowerCase() === itemId.toLowerCase());

            if (!realItemName || userInventory[realItemName].quantity < 1) {
                return res.status(400).json({ message: "Vous ne possédez pas cet objet ou en quantité insuffisante." });
            }
            
            // On retire l'objet de l'inventaire AVANT d'envoyer la demande pour éviter les abus
            userInventory[realItemName].quantity -= 1;
            if (userInventory[realItemName].quantity <= 0) {
                delete userInventory[realItemName];
            }
            saveInventaire(inventaire);

            const normalizedItemId = realItemName.toLowerCase();

            if (normalizedItemId === 'my champ' || normalizedItemId === 'swap lane') {
                const { targetUserId, champName } = extraData;
                if (!targetUserId) {
                     // Si la cible n'est pas valide, on rend l'objet
                    userInventory[realItemName] = userInventory[realItemName] || { quantity: 0 };
                    userInventory[realItemName].quantity += 1;
                    saveInventaire(inventaire);
                    return res.status(400).json({ message: "Aucun joueur cible n'a été sélectionné." });
                }
                if (normalizedItemId === 'my champ' && !champName) {
                    // Si le champion n'est pas valide, on rend l'objet
                    userInventory[realItemName] = userInventory[realItemName] || { quantity: 0 };
                    userInventory[realItemName].quantity += 1;
                    saveInventaire(inventaire);
                    return res.status(400).json({ message: "Le nom du champion est requis." });
                }

                const initiatorUser = await client.users.fetch(userId).catch(() => null);
                if (!initiatorUser) return res.status(404).json({ message: "Utilisateur initiateur introuvable." });
                
                const interactionId = `interaction_${Date.now()}`;
                const interactionData = { fromUserId: userId, targetUserId, itemId: normalizedItemId, itemName: realItemName, champName };
                // On sauvegarde l'objet utilisé dans Redis au cas où il faudrait le rendre (refus)
                await redisClient.set(`interaction:${interactionId}`, JSON.stringify(interactionData), { EX: 120 });
                
                // ✅ Appel de la fonction corrigée
                await sendMessageToUserMailbox(targetUserId, {
                    type: 'interaction_request',
                    payload: {
                        interactionId,
                        itemName: realItemName,
                        fromUser: { id: userId, username: initiatorUser.username },
                        ...(champName && { champName })
                    }
                });
                
                return res.status(200).json({ message: `La demande a été envoyée à l'utilisateur...` });
            }
            
            if (normalizedItemId === 'ticket coin million') {
                const { numbers } = extraData;
                if (!Array.isArray(numbers) || numbers.length !== 5 || numbers.some(n => isNaN(n) || n < 1 || n > 50)) {
                    // L'objet a déjà été retiré, on ne le rend pas car c'est une erreur de l'utilisateur
                    return res.status(400).json({ message: "Veuillez fournir 5 numéros valides entre 1 et 50." });
                }
                
                const lotteryData = loadJSON(LOTTERY_FILE);
                if (!lotteryData[userId]) lotteryData[userId] = [];
                lotteryData[userId].push(numbers);
                saveJSON(LOTTERY_FILE, lotteryData);
                
                // L'inventaire a déjà été sauvegardé au début
                console.log(`[Lotterie] ${userId} a joué les numéros via le dashboard : ${numbers.join(', ')}`);
                return res.status(200).json({ message: `Vous avez joué les numéros : ${numbers.join(", ")}. Bonne chance ! 🍀` });
            }

            if (normalizedItemId === 'épée du kint') {
                const effects = loadEffects();
                if (effects[userId] && new Date(effects[userId].expiresAt).getTime() > Date.now()) {
                    // L'effet est déjà actif, on rend l'objet
                    userInventory[realItemName] = userInventory[realItemName] || { quantity: 0 };
                    userInventory[realItemName].quantity += 1;
                    saveInventaire(inventaire);
                    return res.status(400).json({ message: 'Un effet de l\'épée est déjà actif.' });
                }
                effects[userId] = { type: 'epee-du-kint', expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() };
                saveEffects(effects);
                
                // L'inventaire a déjà été sauvegardé
                return res.status(200).json({ message: 'Épée du KINT activée !' });
            }
            
            // Si l'objet n'a pas d'action, on le rend à l'inventaire
            userInventory[realItemName] = userInventory[realItemName] || { quantity: 0 };
            userInventory[realItemName].quantity += 1;
            saveInventaire(inventaire);
            return res.status(400).json({ message: "Cet objet n'a pas d'action définie." });

        } catch (error) {
            console.error(`Erreur critique sur la route /use:`, error);
            return res.status(500).json({ message: 'Erreur interne du serveur du bot.' });
        }
    });

    return router;
};