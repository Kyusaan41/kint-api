const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kmsg')
        .setDescription('Fait parler le bot avec un message personnalisé')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message que le bot doit envoyer')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // 🚨 Seuls les admins peuvent utiliser cette commande

    async execute(interaction) {
        // Récupérer le message de l'utilisateur
        const message = interaction.options.getString('message');

        // Supprime l'interaction pour ne pas afficher "Commande exécutée par ..."
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();

        // Envoyer le message dans le même salon
        await interaction.channel.send(message);
    }
};
