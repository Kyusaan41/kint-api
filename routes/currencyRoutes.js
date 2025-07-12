const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

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
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

/**
 * Écrit les données dans le fichier currency.json.
 * @param {Object} data - Les données à écrire.
 */
async function writeCurrencyData(data) {
    await fs.writeFile(CURRENCY_FILE, JSON.stringify(data, null, 2));
}


// --- ROUTE DE RÉCOMPENSE MODIFIÉE ---
router.post('/claim/:userId', async (req, res) => {
    const { userId } = req.params;
    // ▼▼▼ MODIFICATION ICI ▼▼▼
    // On récupère le "type" envoyé par le dashboard ('bonus')
    const { type } = req.body; 
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Si aucun type n'est spécifié, c'est une erreur.
    if (!type) {
        return res.status(400).json({ error: "Le type de récompense ('bonus') est manquant." });
    }

    try {
        const currencyData = await readCurrencyData();
        const userData = currencyData[userId] || { balance: 0, lastDaily: null, lastBonus: null };
        
        // ▼▼▼ MODIFICATION ICI ▼▼▼
        // On choisit le champ à vérifier en fonction du type de récompense
        const fieldToCheck = 'lastBonus'; // Le dashboard n'enverra que pour le bonus
        const lastClaimTimestamp = userData[fieldToCheck];

        if (lastClaimTimestamp && (now - lastClaimTimestamp < twentyFourHours)) {
            const timeLeft = twentyFourHours - (now - lastClaimTimestamp);
            return res.status(429).json({
                error: "Vous devez encore attendre avant de pouvoir réclamer votre prochain bonus.",
                timeLeft
            });
        }

        // On met à jour le solde et le timestamp du bon minuteur
        userData.balance = (userData.balance || 0) + 500;
        userData[fieldToCheck] = now;
        currencyData[userId] = userData;
        
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

// Route pour récupérer le solde et les DEUX derniers claims.
router.get('/:userId', async (req, res) => {
    try {
        const currencyData = await readCurrencyData();
        const userCurrency = currencyData[req.params.userId] || { balance: 0, lastDaily: null, lastBonus: null };
        
        // ▼▼▼ MODIFICATION ICI ▼▼▼
        // On renvoie les deux champs au dashboard
        res.json({
            balance: userCurrency.balance || 0,
            lastDaily: userCurrency.lastDaily || null,
            lastBonus: userCurrency.lastBonus || null, 
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
        
        // ▼▼▼ MODIFICATION ICI ▼▼▼
        // On conserve les deux minuteurs lors de la mise à jour manuelle
        currencyData[req.params.userId] = {
            balance: coins,
            lastDaily: oldData.lastDaily || null,
            lastBonus: oldData.lastBonus || null
        };
        await writeCurrencyData(currencyData);
        res.json({ success: true, userId: req.params.userId, coins });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour obtenir le classement des monnaies (pas de changement ici).
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