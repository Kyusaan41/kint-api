const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction-role')
    .setDescription('Ajoute un bouton à un message pour donner un rôle.')
    .addStringOption(option =>
      option.setName('messageid')
        .setDescription('ID du message auquel ajouter le bouton')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('label')
        .setDescription('Texte du bouton (ex: Accepté le règlement)')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Rôle à attribuer')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const messageId = interaction.options.getString('messageid');
    const label = interaction.options.getString('label');
    const role = interaction.options.getRole('role');

    // Chercher le message
    const channel = interaction.channel;
    try {
      const message = await channel.messages.fetch(messageId);

      const button = new ButtonBuilder()
        .setCustomId(`reaction_role_${role.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      await message.edit({ components: [row] });
      await interaction.reply({ content: '✅ Bouton ajouté au message avec succès.', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Erreur : message introuvable ou problème lors de l\'édition.', ephemeral: true });
    }
  }
};
