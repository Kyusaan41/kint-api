const express = require('express');
const { EmbedBuilder } = require('discord.js'); // Assurez-vous que discord.js est importé
const router = express.Router();

// --- À CONFIGURER ---
// Mettez ici l'ID du canal Discord où vous voulez recevoir les feedbacks
const FEEDBACK_CHANNEL_ID = '1391890682297319515'; 

// Le 'botClient' est votre instance du bot Discord, nous le passons en paramètre
module.exports = (botClient) => {
    
    // Cette route écoute les requêtes POST sur /api/submit-feedback
    router.post('/submit-feedback', async (req, res) => {
        try {
            // On récupère les données envoyées par le tableau de bord
            const { userId, username, avatarUrl, feedback } = req.body;

            // Vérification simple que le feedback n'est pas vide
            if (!feedback || !userId || !username) {
                return res.status(400).json({ message: "Données de feedback manquantes." });
            }

            // On va chercher le canal de destination sur Discord
            const channel = await botClient.channels.fetch(FEEDBACK_CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                console.error(`Le canal de feedback avec l'ID ${FEEDBACK_CHANNEL_ID} est introuvable.`);
                // On renvoie une erreur pour savoir que le problème vient de la config du bot
                return res.status(500).json({ message: "Le canal de destination est mal configuré sur le bot." });
            }

            // On construit l'embed avec les informations reçues
            const feedbackEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // Une belle couleur bleue
                .setAuthor({ name: `Nouveau Feedback de ${username}`, iconURL: avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png' })
                .setDescription(feedback) // Le contenu du feedback
                .addFields({ name: 'Utilisateur', value: `<@${userId}> (ID: ${userId})` })
                .setTimestamp();
            
            // On envoie l'embed dans le canal
            await channel.send({ embeds: [feedbackEmbed] });

            // On répond au tableau de bord que tout s'est bien passé
            res.status(200).json({ success: true, message: "Feedback reçu et posté." });

        } catch (error) {
            console.error("Erreur lors de la réception du feedback:", error);
            res.status(500).json({ message: "Erreur interne du bot lors du traitement du feedback." });
        }
    });

    return router;
};