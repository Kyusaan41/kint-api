const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvocal')
    .setDescription('Définit le salon vocal modèle.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // ❗️ Réservé aux admins
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon vocal à utiliser comme modèle')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  async execute(interaction) {
    // Vérification de sécurité (optionnelle mais conseillée)
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Tu dois être administrateur pour utiliser cette commande.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('salon');
    const config = { channelId: channel.id };
    fs.writeFileSync('./voiceConfig.json', JSON.stringify(config, null, 2));

    await interaction.reply(`✅ Le salon vocal modèle est maintenant : **${channel.name}**`);
  }
};
