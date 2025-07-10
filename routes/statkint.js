// /routes/statkint.js
const express = require('express');
const fs = require('fs');
const router = express.Router(); // On utilise le Router d'Express

const STATS_FILE = 'Statskint.json';

// 1. La route GET pour lire TOUTES les statistiques
router.get('/kint-stats-all', (req, res) => {
    if (!fs.existsSync(STATS_FILE)) {
        return res.status(404).json({});
    }
    const statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    res.json(statsData);
});

// 2. La route GET pour lire les statistiques d'un utilisateur
router.get('/kint-stats/:userId', (req, res) => {
    const { userId } = req.params;
    if (!fs.existsSync(STATS_FILE)) {
        return res.status(404).json({ total: 0, oui: 0, non: 0 });
    }
    const statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    const userStats = statsData[userId];

    if (userStats) {
        res.json(userStats);
    } else {
        res.status(404).json({ total: 0, oui: 0, non: 0 });
    }
});

// 3. La route POST pour METTRE À JOUR les statistiques d'un utilisateur
router.post('/kint-stats/:userId', (req, res) => {
    const { userId } = req.params;
    const { responseType } = req.body;

    if (!responseType) {
        return res.status(400).send({ error: 'responseType manquant' });
    }

    let statsData = {};
    if (fs.existsSync(STATS_FILE)) {
        statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }

    if (!statsData[userId]) {
        statsData[userId] = { total: 0, oui: 0, non: 0 };
    }

    statsData[userId].total += 1;
    if (responseType === 'oui') { // Défaite
        statsData[userId].oui += 1;
    } else { // Victoire
        statsData[userId].non += 1;
    }

    fs.writeFileSync(STATS_FILE, JSON.stringify(statsData, null, 2));
    res.status(200).json(statsData[userId]);
});

// On exporte le routeur pour qu'il puisse être utilisé par l'application principale
module.exports = router;