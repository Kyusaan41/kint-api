const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription("✨ Donne ou propose ton avis sur le bot, le serveur.")
    .addStringOption(option =>
      option.setName('message')
            .setDescription("Ton feedback")
            .setRequired(true)
    ),
  async execute(interaction) {
    const feedbackMessage = interaction.options.getString('message');
    const feedbackChannelId = process.env.FEEDBACK_CHANNEL_ID;
    if (!feedbackChannelId) {
      return interaction.reply({ content: "Le canal de feedback n'est pas configuré.", ephemeral: true });
    }
    
    const feedbackChannel = await interaction.client.channels.fetch(feedbackChannelId).catch(console.error);
    if (!feedbackChannel) {
      return interaction.reply({ content: "Le canal de feedback est introuvable.", ephemeral: true });
    }
    
    // Création d'un embed embelli
    const embed = new EmbedBuilder()
      .setTitle(`Feedback de ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(feedbackMessage)
      .addFields(
        { name: "Utilisateur", value: `<@${interaction.user.id}>`, inline: true },
        { name: "ID", value: interaction.user.id, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: "Feedback envoyé via /feedback" });
    
    await feedbackChannel.send({ embeds: [embed] });
    
    return interaction.reply({ content: "Merci pour ton feedback !", ephemeral: true });
  }
};
