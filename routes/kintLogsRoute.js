// kintLogsRoute.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const KINT_DETAILED_LOGS_FILE = path.join(__dirname, '..', 'kint_detailed_logs.json');

// --- Votre fonction originale (conservée comme demandé) ---
const addDetailedKintLog = (logEntry) => {
    let logs = [];
    if (fs.existsSync(KINT_DETAILED_LOGS_FILE)) {
        const fileContent = fs.readFileSync(KINT_DETAILED_LOGS_FILE, 'utf8');
        try {
            logs = JSON.parse(fileContent);
            if (!Array.isArray(logs)) {
                console.warn(`Le fichier ${KINT_DETAILED_LOGS_FILE} n'est pas un tableau JSON valide. Réinitialisation.`);
                logs = [];
            }
        } catch (parseError) {
            console.error(`Erreur de parsing JSON pour ${KINT_DETAILED_LOGS_FILE} lors de l'ajout:`, parseError);
            logs = [];
        }
    }
    logs.push(logEntry);
    fs.writeFileSync(KINT_DETAILED_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
};

module.exports = (botClient) => {
    if (!botClient) {
        console.error("ERREUR: Le client Discord du bot n'a pas été fourni au routeur des logs Kint.");
        return router;
    }

    router.post('/log-kint-action', async (req, res) => {
        try {
            const { userId, username, avatar, actionType, points, currentBalance, effect, reason, date } = req.body;

            if (!userId || !username || !actionType || points === undefined || currentBalance === undefined || !reason) {
                return res.status(400).json({ error: 'Données de log Kint manquantes ou invalides.' });
            }

            const logChannel = await botClient.channels.fetch('1342558386507481145');

            if (logChannel && logChannel.isTextBased()) {
                
                // --- DÉBUT DE LA LOGIQUE D'EMBED CORRIGÉE ---
                const isProtected = reason === 'Protégé par KShield';

                const embed = {
                    color: isProtected ? 0x0099ff : (actionType === 'GAGNÉ' ? 0x00FF00 : 0xFF0000),
                    title: `${isProtected ? '🛡️' : (actionType === 'GAGNÉ' ? '✅' : '❌')} Rapport Dashboard KINT – ${username}`,
                    thumbnail: { url: avatar || 'https://cdn.discordapp.com/embed/avatars/0.png' },
                    fields: [
                        { name: '👤 Utilisateur', value: `<@${userId}>`, inline: false },
                        { name: '📌 Action effectuée', value: `**${isProtected ? 'PROTÉGÉ PAR KSHIELD' : actionType}**`, inline: true },
                        { name: '🏆 Points (concernés)', value: `\`${points.toLocaleString()}\``, inline: true },
                        { name: '🎯 Solde actuel', value: `\`${currentBalance.toLocaleString()}\``, inline: true },
                        { name: '✨ Effet actif', value: effect || 'Aucun effet', inline: true },
                        { name: 'Raison', value: reason, inline: false },
                        { name: 'Date', value: `<t:${Math.floor(new Date(date).getTime() / 1000)}:F>`, inline: false }
                    ],
                    footer: {
                        text: `KINT — Créé par Kyû`,
                        icon_url: botClient.user.displayAvatarURL()
                    },
                    timestamp: new Date().toISOString()
                };
                // --- FIN DE LA LOGIQUE D'EMBED CORRIGÉE ---

                await logChannel.send({ embeds: [embed] });

            } else {
                 console.error(`Impossible de trouver ou d'envoyer au canal de log avec l'ID: 1342558386507481145`);
            }
            
            // On continue d'écrire dans ce fichier de log même s'il n'est plus utilisé par le dashboard
            const newDetailedLogEntry = {
                userId, username, avatar, actionType, points,
                currentBalance, effect: effect || 'Aucun effet',
                date: new Date().toISOString(), reason, source: 'Dashboard'
            };
            addDetailedKintLog(newDetailedLogEntry);

            res.status(200).json({ success: true, message: 'Log Kint envoyé à Discord et enregistré.' });

        } catch (error) {
            console.error("Erreur lors de la réception du log Kint du dashboard:", error);
            res.status(500).json({ error: 'Erreur interne du serveur du bot.' });
        }
    });

    return router;
};