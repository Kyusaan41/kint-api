const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('effacer')
        .setDescription('🚮 Supprime un certain nombre de messages dans le salon.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Nombre de messages à supprimer')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // 🔥 Restriction aux admins

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        // Vérifier si le nombre est valide
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: "❌ Vous devez choisir un nombre entre **1 et 100**.", ephemeral: true });
        }

        // Supprimer les messages
        await interaction.channel.bulkDelete(amount, true)
            .then(messages => {
                interaction.reply({ content: `✅ **${messages.size}** messages supprimés avec succès !`, ephemeral: true });
            })
            .catch(error => {
                console.error("Erreur lors de la suppression des messages :", error);
                interaction.reply({ content: "❌ Une erreur est survenue lors de la suppression des messages.", ephemeral: true });
            });
    }
};
