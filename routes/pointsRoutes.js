const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// --- Chemins vers les fichiers de données ---
const POINTS_FILE = path.join(__dirname, '../points.json');
const POINTS_LOG_FILE = path.join(__dirname, '../points_log.json');
const INVENTAIRE_FILE = path.join(__dirname, '../inventaire.json');

// Fonctions pour lire et écrire les fichiers de données
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

// [GET] /api/points/history/all - Récupère l'historique complet de tous les joueurs
router.get('/history/all', async (req, res) => {
    try {
        const allLogs = await readData(POINTS_LOG_FILE);
        res.json(allLogs);
    } catch (err) {
        console.error('GET all points history error:', err);
        res.status(500).json({ error: 'Erreur serveur lors de la lecture de l\'historique complet.' });
    }
});

// --- Les routes GET ne changent pas ---
router.get('/:userId/history', async (req, res) => {
    try {
        const logs = await readData(POINTS_LOG_FILE);
        const userHistory = logs[req.params.userId] || [];
        // Retourne les 10 dernières entrées, triées du plus récent au plus ancien.
        const recentHistory = Array.isArray(userHistory) ? userHistory.slice(-10).reverse() : [];
        res.json(recentHistory);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const pointsData = await readData(POINTS_FILE);
        const userPoints = pointsData[req.params.userId] || 0;
        res.json({ points: userPoints });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- ROUTE DE MISE À JOUR (POST) - CORRIGÉE ---
router.post('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { points: pointsDifference, source } = req.body;

    if (typeof pointsDifference !== 'number') {
        return res.status(400).json({ error: "Le montant des points doit être un nombre." });
    }

    try {
        const pointsData = await readData(POINTS_FILE);
        const inventaire = await readData(INVENTAIRE_FILE);
        const logs = await readData(POINTS_LOG_FILE);

        const currentPoints = pointsData[userId] || 0;

        // --- Logique automatique du KShield (CONDITION CORRIGÉE) ---
        // S'active si c'est une perte ET que la source n'est PAS le dashboard admin
        if (pointsDifference < 0 && source !== 'admin_dashboard' && inventaire[userId]?.KShield?.quantity > 0) {
            inventaire[userId].KShield.quantity -= 1;
            if (inventaire[userId].KShield.quantity === 0) {
                delete inventaire[userId].KShield;
            }
            await writeData(INVENTAIRE_FILE, inventaire);

            if (!logs[userId]) logs[userId] = [];
            // --- Log amélioré pour le KShield ---
            logs[userId].push({
                actionType: 'PERDU', // Techniquement c'est une perte
                points: Math.abs(pointsDifference), // On log le montant de la perte évitée
                currentBalance: currentPoints, // Le solde n'a pas changé
                effect: 'KShield', // On indique l'effet utilisé
                date: new Date().toISOString(),
                reason: `Protégé par KShield`, // Raison claire pour l'affichage
                source: source || 'Discord' // On conserve la source originale de l'action
            });
            await writeData(POINTS_LOG_FILE, logs);

            return res.json({
                success: true,
                message: 'Perte de points annulée grâce à un KShield.',
                kshieldUsed: true,
                newPoints: currentPoints
            });
        }

        // --- Logique normale de mise à jour ---
        const newPoints = currentPoints + pointsDifference;
        pointsData[userId] = newPoints;

        if (!logs[userId]) logs[userId] = [];

        // On détermine le type d'action pour le log
        const actionType = pointsDifference > 0 ? 'GAGNÉ' : 'PERDU';
        // On détermine la raison
        let reason = source === 'admin_dashboard' ? 'Action Administrateur' : (actionType === 'GAGNÉ' ? 'Victoire' : 'Défaite');


        logs[userId].push({
            actionType: actionType,
            points: Math.abs(pointsDifference), // On log la valeur absolue
            currentBalance: newPoints, // Le nouveau solde
            effect: 'Aucun effet',
            date: new Date().toISOString(),
            reason: reason,
            source: source || 'Discord'
        });

        await writeData(POINTS_FILE, pointsData);
        await writeData(POINTS_LOG_FILE, logs);

        res.json({ success: true, newPoints: newPoints });

    } catch (err) {
        console.error('POST points error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- La route de classement ne change pas ---
router.get('/', async (req, res) => {
    try {
        const pointsData = await readData(POINTS_FILE);
        const leaderboard = Object.entries(pointsData).map(([userId, points]) => ({
            userId,
            points,
        }));
        leaderboard.sort((a, b) => b.points - a.points);
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;