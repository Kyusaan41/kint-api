const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const POINTS_LOG_FILE = path.join(__dirname, '..', 'points_log.json');
const BOT_API_URL = 'http://51.83.103.24:20077/api';

async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

router.get('/kint-detailed-logs', async (req, res) => {
    try {
        const targetUserId = req.query.userId;

        const [allPointsLogs, serverInfoRes] = await Promise.all([
            readJsonFile(POINTS_LOG_FILE),
            fetch(`${BOT_API_URL}/serverinfo`)
        ]);

        const members = serverInfoRes.ok ? (await serverInfoRes.json()).members || [] : [];
        const membersMap = new Map(members.map(m => [m.id, m]));

        let logsToProcess = [];

        // On ne change pas la logique ici, car la page Admin a besoin de tous les logs
        if (targetUserId) {
            const userLogs = allPointsLogs[targetUserId] || [];
            if (Array.isArray(userLogs)) {
                logsToProcess = userLogs.map(log => ({ ...log, userId: targetUserId }));
            }
        } else {
            for (const userId in allPointsLogs) {
                if (Array.isArray(allPointsLogs[userId])) {
                    allPointsLogs[userId].forEach(log => {
                        logsToProcess.push({ ...log, userId: userId });
                    });
                }
            }
        }

        const enrichedLogs = logsToProcess.map(log => {
            const memberInfo = membersMap.get(log.userId);
            return {
                ...log,
                username: memberInfo?.username || `ID: ${log.userId}`,
                avatar: memberInfo?.avatar,
            };
        });

        // --- FILTRAGE DES LOGS ADMIN ---
        // On ne garde que les logs dont la source n'est PAS 'admin_dashboard'
        // pour ne pas les afficher sur le tableau de bord de l'utilisateur.
        const filteredLogsForDisplay = enrichedLogs.filter(log => log.source !== 'admin_dashboard');

        // On trie les logs restants par date
        filteredLogsForDisplay.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json(filteredLogsForDisplay);

    } catch (error) {
        console.error("Erreur dans la route /kint-detailed-logs:", error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

module.exports = router;