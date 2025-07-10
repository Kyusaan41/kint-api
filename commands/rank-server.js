const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('classement-serveur')
        .setDescription("✨ Affiche le classement des utilisateurs selon leur XP"),

    async execute(interaction) {
        await interaction.deferReply();

        const filePath = path.join(__dirname, '../xp.json');

        if (!fs.existsSync(filePath)) {
            return interaction.editReply({ content: "❌ Fichier XP introuvable !", ephemeral: true });
        }

        const rawData = fs.readFileSync(filePath);
        const xpData = JSON.parse(rawData);

        const calculateLevel = (xp) => Math.floor(0.1 * Math.sqrt(xp));

        const sortedUsers = Object.entries(xpData)
            .map(([id, data]) => ({ id, xp: data.xp, level: calculateLevel(data.xp) }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 20); // 🔄 Top 20 au lieu de 10

        if (sortedUsers.length === 0) {
            return interaction.editReply({ content: "📉 Aucun utilisateur classé." });
        }

        let leaderboard = "";
        for (let i = 0; i < sortedUsers.length; i++) {
            const { id, xp, level } = sortedUsers[i];
            leaderboard += `**#${i + 1}** | <@${id}> - Niveau **${level}** (**${xp} XP**)\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle("🏆 Classement du Serveur (Top 20)")
            .setDescription(leaderboard)
            .setColor("#FFD700")
            .setFooter({ text: `Demandé par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};
