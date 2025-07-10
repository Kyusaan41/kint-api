const express = require('express');
const router = express.Router();
const fs = require('fs').promises; // Utilisation de la version asynchrone pour plus de fiabilité
const path = require('path');

// Chemin vers le fichier qui stocke les données de monnaie et de cooldown
// Ce fichier est uniquement pour le bonus du dashboard.
const CURRENCY_FILE = path.join(__dirname, '../currency.json');

/**
 * Lit les données depuis le fichier currency.json.
 * @returns {Promise<Object>} Les données des utilisateurs.
 */
async function readCurrencyData() {
    try {
        const data = await fs.readFile(CURRENCY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si le fichier n'existe pas, on retourne un objet vide pour éviter une erreur.
        if (error.code === 'ENOENT') {
            return {};
        }
        // Pour les autres erreurs, on les propage.
        throw error;
    }
}

/**
 * Écrit les données dans le fichier currency.json.
 * @param {Object} data - Les données à écrire.
 */
async function writeCurrencyData(data) {
    // Écrit les données de manière "atomique" pour éviter la corruption en cas de crash.
    await fs.writeFile(CURRENCY_FILE, JSON.stringify(data, null, 2));
}

// --- ROUTE DE BONUS QUOTIDIEN SPÉCIFIQUE AU DASHBOARD ---
router.post('/claim/:userId', async (req, res) => {
    const { userId } = req.params;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    try {
        const currencyData = await readCurrencyData();
        // Récupère les données de l'utilisateur ou initialise un nouvel objet.
        const userData = currencyData[userId] || { balance: 0, lastClaim: null };
        
        // Vérifie si 24h se sont écoulées depuis le dernier claim.
        if (userData.lastClaim && (now - userData.lastClaim < twentyFourHours)) {
            const timeLeft = twentyFourHours - (now - userData.lastClaim);
            return res.status(429).json({ 
                error: "Vous devez encore attendre avant de pouvoir réclamer votre prochain bonus.", 
                timeLeft 
            });
        }

        // Met à jour le solde et le timestamp du dernier claim.
        userData.balance = (userData.balance || 0) + 500;
        userData.lastClaim = now;
        currencyData[userId] = userData;
        
        // Sauvegarde les nouvelles données dans le fichier.
        await writeCurrencyData(currencyData);

        console.log(`[BONUS DASHBOARD] ${userId} a réclamé 500 pièces.`);
        res.json({ 
            success: true, 
            message: "Vous avez reçu votre bonus de 500 pièces !", 
            newBalance: userData.balance,
        });
    } catch (error) {
        console.error("[BONUS DASHBOARD ERROR]", error);
        res.status(500).json({ error: "Erreur interne du serveur lors de la réclamation." });
    }
});
// -----------------------------------------------------------

// Route pour récupérer le solde et le dernier claim d'un utilisateur.
router.get('/:userId', async (req, res) => {
    try {
        const currencyData = await readCurrencyData();
        const userCurrency = currencyData[req.params.userId] || { balance: 0, lastClaim: null };
        res.json({ 
            balance: userCurrency.balance || 0,
            lastClaim: userCurrency.lastClaim || null 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour modifier le solde d'un utilisateur (utilisée par le panneau admin).
router.post('/:userId', async (req, res) => {
    const { coins } = req.body;
    if (typeof coins !== 'number') {
        return res.status(400).json({ error: "Le montant des pièces (coins) doit être un nombre." });
    }

    try {
        const currencyData = await readCurrencyData();
        const oldData = currencyData[req.params.userId] || {};
        // Met à jour le solde tout en conservant le timestamp du dernier claim.
        currencyData[req.params.userId] = {
            balance: coins,
            lastClaim: oldData.lastClaim || null
        };
        await writeCurrencyData(currencyData);
        res.json({ success: true, userId: req.params.userId, coins });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour obtenir le classement des monnaies.
router.get('/', async (req, res) => {
    try {
        const currencyData = await readCurrencyData();
        const leaderboard = Object.entries(currencyData).map(([userId, data]) => ({
            userId,
            balance: data.balance || 0,
        }));
        leaderboard.sort((a, b) => b.balance - a.balance);
        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;