const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const POLL_FILE = path.join(__dirname, '../active_polls.json');

// 🔧 ID du salon log
const LOG_CHANNEL_ID = '1387087969243893871'; // ← Remplace ça !

function loadPolls() {
  if (!fs.existsSync(POLL_FILE)) return [];
  return JSON.parse(fs.readFileSync(POLL_FILE, 'utf8'));
}

function savePolls(polls) {
  try {
    fs.writeFileSync(POLL_FILE, JSON.stringify(polls, null, 2));
  } catch (err) {
    console.error('Erreur sauvegarde sondages :', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('📊 Crée un sondage interactif avec jusqu’à 4 choix.')
    .addStringOption(opt => opt.setName('question').setDescription('Question du sondage').setRequired(true))
    .addStringOption(opt => opt.setName('choix1').setDescription('Choix 1').setRequired(true))
    .addStringOption(opt => opt.setName('choix2').setDescription('Choix 2').setRequired(true))
    .addStringOption(opt => opt.setName('choix3').setDescription('Choix 3').setRequired(false))
    .addStringOption(opt => opt.setName('choix4').setDescription('Choix 4').setRequired(false))
    .addStringOption(opt => opt.setName('durée').setDescription('Durée (ex: 30s, 1m, 2h)').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const rawDuration = interaction.options.getString('durée') || '1m';

    const parseDuration = (input) => {
      const match = input.match(/^(\d+)(s|m|h)$/);
      if (!match) return null;
      const value = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === 's') return value * 1000;
      if (unit === 'm') return value * 60 * 1000;
      if (unit === 'h') return value * 60 * 60 * 1000;
      return null;
    };

    const durationMs = parseDuration(rawDuration);
    if (!durationMs || durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: '❌ Durée invalide (ex: 30s, 1m, 2h). Max: 24h.', ephemeral: true });
    }

    const endTime = Date.now() + durationMs;

    const choix = [
      interaction.options.getString('choix1'),
      interaction.options.getString('choix2'),
      interaction.options.getString('choix3'),
      interaction.options.getString('choix4')
    ].filter(Boolean);

    if (choix.length < 2) {
      return interaction.reply({ content: '❌ Tu dois fournir au moins 2 choix.', ephemeral: true });
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const votes = new Array(choix.length).fill(0);
    const usersVoted = new Set();

    const buttons = new ActionRowBuilder().addComponents(
      choix.map((text, i) =>
        new ButtonBuilder()
          .setCustomId(`vote_${i}`)
          .setLabel(`${emojis[i]} ${text}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    const formatTimeLeft = () => {
      const msLeft = Math.max(endTime - Date.now(), 0);
      const sec = Math.floor((msLeft / 1000) % 60);
      const min = Math.floor((msLeft / (1000 * 60)) % 60);
      const hrs = Math.floor(msLeft / (1000 * 60 * 60));
      return [hrs ? `${hrs}h` : null, min ? `${min}m` : null, `${sec}s`].filter(Boolean).join(' ');
    };

    const generateEmbed = () => {
      const totalVotes = votes.reduce((a, b) => a + b, 0) || 1;
      const desc = choix.map((text, i) => {
        const pct = ((votes[i] / totalVotes) * 100).toFixed(1);
        const barsCount = Math.round(pct / 10);
        const barEmojis = ['⬜', '🟦', '🟩', '🟨', '🟧', '🟥'];
        const barColorIndex = Math.min(Math.floor(pct / 20), barEmojis.length - 1);
        const filledBar = barEmojis[barColorIndex].repeat(barsCount);
        const emptyBar = '⬛'.repeat(10 - barsCount);
        const maxVotes = Math.max(...votes);
        const isLeader = votes[i] === maxVotes && maxVotes > 0;
        const leaderEmoji = isLeader ? '🚀' : '·';
        return `${leaderEmoji} **${emojis[i]} ${text}**\n\`${votes[i]} vote${votes[i] > 1 ? 's' : ''} | ${pct}%\`\n${filledBar}${emptyBar}`;
      }).join('\n\n');

      return new EmbedBuilder()
        .setColor('#0fffc1')
        .setTitle('🚀 Sondage Interactif — En cours')
        .setDescription(`**🗨️ Question:** ${question}\n\n${desc}\n\n⏳ **Temps restant :** ${formatTimeLeft()}`)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2921/2921222.png')
        .setFooter({
          text: `🎯 Votez avec les boutons ci-dessous | Créé par ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp()
        .setFields(
          { name: '👥 Participants', value: `**${usersVoted.size}**`, inline: true },
          { name: '💡 Astuce', value: 'Chaque vote compte !', inline: true }
        );
    };

    const generateLogEmbed = async (guild, question, choix, votes, voters) => {
      const voteMap = new Map();
      choix.forEach((_, i) => voteMap.set(i, []));
      for (const v of voters) {
        const member = await guild.members.fetch(v.id).catch(() => null);
        const username = member ? member.user.tag : `Inconnu (${v.id})`;
        voteMap.get(v.vote).push(username);
      }

      const desc = choix.map((text, i) => {
        const users = voteMap.get(i).map(u => `• ${u}`).join('\n') || '_Aucun vote_';
        return `**${emojis[i]} ${text}**\n${users}`;
      }).join('\n\n');

      return new EmbedBuilder()
        .setColor('#00ffaa')
        .setTitle('📄 Copie du Sondage (Logs)')
        .setDescription(`**🗨️ Question :** ${question}\n\n${desc}`)
        .setFooter({ text: 'Mise à jour en temps réel des votes' })
        .setTimestamp();
    };

    await interaction.reply({ embeds: [generateEmbed()], components: [buttons] });
    const message = await interaction.fetchReply();

    // Log channel embed
    const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
    let logMessage;
    if (logChannel) {
      const logButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_close_${message.id}`)
          .setLabel('🛑 Fermer')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`poll_refresh_${message.id}`)
          .setLabel('🔄 Rafraîchir')
          .setStyle(ButtonStyle.Primary)
      );

      const logEmbed = await generateLogEmbed(interaction.guild, question, choix, votes, []);
      logMessage = await logChannel.send({
        embeds: [logEmbed],
        components: [logButtons]
      });
    }

    const pollObj = {
      messageId: message.id,
      channelId: message.channel.id,
      question,
      choices: choix,
      votes,
      voters: [],
      endTimestamp: endTime
    };

    savePolls([...loadPolls(), pollObj]);

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) return clearInterval(interval);
      try {
        await message.edit({ embeds: [generateEmbed()] });
      } catch (err) {
        clearInterval(interval);
        console.error('Erreur mise à jour embed :', err.message);
      }
    }, 1000);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: durationMs
    });

    collector.on('collect', async i => {
      if (usersVoted.has(i.user.id)) {
        return i.reply({ content: '❌ Tu as déjà voté.', ephemeral: true });
      }

      const index = parseInt(i.customId.split('_')[1], 10);
      votes[index]++;
      usersVoted.add(i.user.id);
      pollObj.votes = votes;
      pollObj.voters.push({ id: i.user.id, vote: index });
      savePolls([...loadPolls().filter(p => p.messageId !== message.id), pollObj]);

      await i.update({ embeds: [generateEmbed()] });

      // 🔁 Mise à jour du log
      if (logChannel && logMessage) {
        const updatedLogEmbed = await generateLogEmbed(interaction.guild, question, choix, votes, pollObj.voters);
        await logMessage.edit({ embeds: [updatedLogEmbed] });
      }
    });

    collector.on('end', async () => {
      clearInterval(interval);
    });

    if (logMessage) {
      const logCollector = logMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: durationMs
      });

      logCollector.on('collect', async i => {
        if (!i.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          return i.reply({ content: '❌ Tu n’as pas la permission de gérer ce sondage.', ephemeral: true });
        }

        if (i.customId === `poll_close_${message.id}`) {
          clearInterval(interval);
          collector.stop(); // Arrête les votes

          const totalVotes = votes.reduce((a, b) => a + b, 0);
          const resultEmbed = new EmbedBuilder()
            .setColor('#ff4e4e')
            .setTitle('📊 Résultat du Sondage')
            .setDescription(`**🗨️ ${question}**\n\n${choix.map((c, idx) =>
              `${emojis[idx]} **${c}** — \`${votes[idx]} vote${votes[idx] > 1 ? 's' : ''}\``).join('\n')}`)
            .setFooter({ text: `Sondage fermé manuellement par ${i.user.tag}` })
            .setTimestamp();

          await message.edit({ embeds: [resultEmbed], components: [] });
          await logMessage.edit({ embeds: [resultEmbed], components: [] });
          savePolls(loadPolls().filter(p => p.messageId !== message.id));

          return i.reply({ content: '✅ Sondage fermé avec succès.', ephemeral: true });
        }

        if (i.customId === `poll_refresh_${message.id}`) {
          const refreshedEmbed = await generateLogEmbed(interaction.guild, question, choix, votes, pollObj.voters);
          await logMessage.edit({ embeds: [refreshedEmbed] });
          return i.reply({ content: '🔄 Sondage mis à jour.', ephemeral: true });
        }
      });
    }
  }
};
