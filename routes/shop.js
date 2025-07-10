const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// --- Fichiers de données ---
const SHOP_FILE = path.join(__dirname, '../shop.json');
const INVENTAIRE_FILE = path.join(__dirname, '../inventaire.json');
const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const PURCHASE_LOCKS_FILE = path.join(__dirname, '../purchase_locks.json');
const TITLES_AVAILABLE_FILE = path.join(__dirname, '../titles_available.json');
const TITLES_FILE = path.join(__dirname, '../titles.json');
const KSHIELD_ID = 'KShield';

// --- Fonctions utilitaires ---
const userLocks = {};
async function acquireLock(userId) {
    while (userLocks[userId]) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    userLocks[userId] = true;
}
function releaseLock(userId) {
    delete userLocks[userId];
}
async function readData(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}
async function writeData(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}
const getFullShop = async () => {
    const shop = await readData(SHOP_FILE);
    const titlesAvailable = await readData(TITLES_AVAILABLE_FILE);
    for (const [key, data] of Object.entries(titlesAvailable)) {
        if (data.price) {
            shop[key] = { id: key, name: key, price: data.price, description: data.description || 'Titre spécial.', type: 'Personnalisation', isTitle: true, category: data.rarete || 'Commun' };
        }
    }
    return shop;
};

// On exporte une fonction qui prend "client" en argument
module.exports = (client) => {

    // ... (Vos routes GET ne changent pas) ...
    router.get('/', async (req, res) => {
        try {
            const fullShop = await getFullShop();
            const items = Object.entries(fullShop).map(([key, item]) => ({ id: item.id || key, ...item }));
            items.sort((a, b) => (a.price || 0) - (b.price || 0));
            res.json(items);
        } catch (error) {
            res.status(500).json({ error: 'Erreur lecture du fichier boutique' });
        }
    });
    router.get('/kshield-status/:userId', async (req, res) => {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'User ID manquant.' });
        try {
            const cooldownData = await readData(PURCHASE_LOCKS_FILE);
            const lastPurchase = cooldownData[userId]?.[KSHIELD_ID] || 0;
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const timeLeft = oneWeek - (Date.now() - lastPurchase);
            
            if (timeLeft > 0) {
                return res.json({ canPurchase: false, timeLeft });
            }
            return res.json({ canPurchase: true });
        } catch (error) {
            res.status(500).json({ error: 'Erreur interne du serveur.' });
        }
    });

    // [POST] /api/shop/buy - Gère l'achat d'un panier
    router.post('/buy', async (req, res) => {
        const { userId, items: itemIds } = req.body;
        
        if (!userId || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'Données d\'achat invalides.' });
        }
        
        await acquireLock(userId);
        try {
            const [fullShop, currencyData, inventaire, purchaseLocks, titlesData] = await Promise.all([
                getFullShop(), readData(CURRENCY_FILE), readData(INVENTAIRE_FILE), readData(PURCHASE_LOCKS_FILE), readData(TITLES_FILE)
            ]);

            let totalCost = 0;
            const itemsToPurchase = [];
            for (const itemId of itemIds) {
                const itemKey = Object.keys(fullShop).find(key => key === itemId || fullShop[key].id === itemId);
                const itemDetails = itemKey ? fullShop[itemKey] : null;
                if (!itemDetails) throw new Error(`Objet introuvable: '${itemId || 'null'}'`);
                itemsToPurchase.push({ ...itemDetails, definitiveId: itemDetails.id || itemKey });
                totalCost += itemDetails.price;
            }

            const userWallet = currencyData[userId] || { balance: 0 };
            if (userWallet.balance < totalCost) throw new Error('Fonds insuffisants.');

            // --- LOGIQUE AMÉLIORÉE ---
            if (!process.env.GUILD_ID) {
                throw new Error("La variable d'environnement GUILD_ID n'est pas définie.");
            }
            const guild = await client.guilds.fetch(process.env.GUILD_ID); // Utilise .fetch() pour plus de fiabilité
            if (!guild) {
                throw new Error(`Impossible de trouver le serveur avec l'ID ${process.env.GUILD_ID}. Le bot en fait-il partie ?`);
            }
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) throw new Error("Membre introuvable sur le serveur Discord.");

            // --- Transaction ---
            userWallet.balance -= totalCost;
            if (!inventaire[userId]) inventaire[userId] = {};

            for (const item of itemsToPurchase) {
                const id = item.definitiveId;
                if (item.action === 'color') {
                    for (const ownedItemId of Object.keys(inventaire[userId])) {
                        const ownedItemDetails = fullShop[ownedItemId];
                        if (ownedItemDetails && ownedItemDetails.action === 'color') {
                            delete inventaire[userId][ownedItemId];
                            const oldRole = guild.roles.cache.get(ownedItemDetails.roleId);
                            if (oldRole && member.roles.cache.has(oldRole.id)) {
                                await member.roles.remove(oldRole);
                            }
                        }
                    }
                    const newRole = guild.roles.cache.get(item.roleId);
                    if (newRole) await member.roles.add(newRole);
                    inventaire[userId][id] = { name: item.name, price: item.price, quantity: 1 };
                } else if (item.isTitle) {
                    if (!titlesData[userId]) titlesData[userId] = { list: [], equipped: null };
                    if (!titlesData[userId].list.includes(id)) {
                        titlesData[userId].list.push(id);
                    }
                } else {
                    if (!inventaire[userId][id]) inventaire[userId][id] = { name: item.name, price: item.price, quantity: 0 };
                    inventaire[userId][id].quantity += 1;
                }
                if (id === KSHIELD_ID) {
                    if (!purchaseLocks[userId]) purchaseLocks[userId] = {};
                    purchaseLocks[userId][KSHIELD_ID] = Date.now();
                }
            }
            
            await Promise.all([
                writeData(CURRENCY_FILE, currencyData),
                writeData(INVENTAIRE_FILE, inventaire),
                writeData(PURCHASE_LOCKS_FILE, purchaseLocks),
                writeData(TITLES_FILE, titlesData)
            ]);
            
            res.json({ success: true, message: 'Achat réussi !', newBalance: userWallet.balance });
        } catch (error) {
            console.error("Erreur lors de l'achat:", error);
            res.status(500).json({ error: error.message });
        } finally {
            releaseLock(userId);
        }
    });

    return router;
};