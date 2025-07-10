const { EmbedBuilder, ChannelType } = require('discord.js');

const LOG_CHANNEL_ID = '1376584692085686422'; // Remplace par l’ID de ton canal de log

async function handleDM(message, client) {
  if (message.author.bot || message.channel.type !== ChannelType.DM) return;

  console.log(`📩 DM reçu de ${message.author.tag} : ${message.content}`);

  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('📩 Nouveau message privé reçu')
      .setColor('Purple')
      .addFields(
        { name: 'Utilisateur', value: `${message.author.tag} (\`${message.author.id}\`)` },
        { name: 'Contenu', value: message.content || '*[Message vide]*' }
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({
        name: '📎 Pièces jointes',
        value: message.attachments.map(a => a.url).join('\n')
      });
    }

    if (logChannel?.isTextBased()) {
      await logChannel.send({ embeds: [embed] });
    }

  } catch (err) {
    console.error("❌ Erreur lors de la gestion du DM :", err);
  }
}

module.exports = { handleDM };
