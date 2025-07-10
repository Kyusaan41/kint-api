const { SlashCommandBuilder, ActivityType } = require('discord.js');
const OWNER_ID = '1206053705149841428'; // Remplace par ton vrai ID Discord

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('🔴 Active/désactive le mode maintenance (réservé au propriétaire)'),
    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "Tu n'es pas autorisé à utiliser cette commande.", ephemeral: true });
        }

        const isActive = interaction.client.maintenance.isActive;

        if (!isActive) {
            interaction.client.maintenance.isActive = true;
            interaction.client.maintenance.startedAt = new Date();

            await interaction.client.user.setPresence({
                activities: [{ name: '🔴 Maintenance en cours...', type: ActivityType.Watching }],
                status: 'dnd'
            });

            await interaction.reply({ content: "🔧 Le mode maintenance a été **activé**.", ephemeral: true });
        } else {
            interaction.client.maintenance.isActive = false;
            interaction.client.maintenance.startedAt = null;

            await interaction.client.user.setPresence({
                activities: [{ name: 'Version 3.2 | By Kyû ⚡', type: ActivityType.Playing }],
                status: 'online'
            });

            await interaction.reply({ content: "✅ Le mode maintenance a été **désactivé**.", ephemeral: true });

        }
    }
};
