const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const POLL_FILE = path.join(__dirname, 'active_polls.json');

function loadPolls() {
  if (!fs.existsSync(POLL_FILE)) return [];
  return JSON.parse(fs.readFileSync(POLL_FILE, 'utf8'));
}

function savePolls(polls) {
  fs.writeFileSync(POLL_FILE, JSON.stringify(polls, null, 2));
}

async function checkPolls(client) {
  const polls = loadPolls();
  const now = Date.now();
  const remainingPolls = [];

  for (const poll of polls) {
    if (now >= poll.endTimestamp) {
      try {
        const channel = await client.channels.fetch(poll.channelId);
        const message = await channel.messages.fetch(poll.messageId);

        const totalVotes = poll.votes.reduce((a, b) => a + b, 0) || 1;
        const maxVotes = Math.max(...poll.votes);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const winners = poll.choices
          .map((c, i) => ({ choice: c, votes: poll.votes[i] }))
          .filter(c => c.votes === maxVotes)
          .map(c => c.choice);

const embed = new EmbedBuilder()
  .setColor('#00FFF7') // Bleu néon cyan très vif, futuriste
  .setTitle('🚀 Résultats du Sondage')
  .setDescription(`🔹 **${poll.question}**`)
  .addFields(
    poll.choices.map((choice, i) => {
      const voteCount = poll.votes[i];
      const percent = ((voteCount / totalVotes) * 100).toFixed(1);
      const filled = Math.round(percent / 5); // barre sur 20 segments
      const empty = 20 - filled;
      // barre néon avec blocs pleins et vides en Unicode
      const bar = '▇'.repeat(filled) + '—'.repeat(empty);

      const isWinner = voteCount === maxVotes && voteCount > 0;
      const trophy = isWinner ? '🏆 ' : '';

      return {
        name: `${trophy}🔸 ${choice}`,
        value: `\`${bar}\`  **${percent}%**  (${voteCount} vote${voteCount > 1 ? 's' : ''})`,
        inline: false
      };
    }),
    {
      name: '👥 Total des votants',
      value: `**${totalVotes}**`,
      inline: true
    },
    {
      name: '🏅 Gagnant(s)',
      value: winners.length ? winners.join(', ') : '_Aucun vote_',
      inline: true
    }
  )
  .setFooter({ text: '⌛ Sondage terminé', iconURL: client.user.displayAvatarURL() })
  .setTimestamp()



await message.edit({ embeds: [embed], components: [] });
console.log(`✅ Résultat du sondage envoyé pour ${poll.question}`);
      } catch (err) {
        console.error("❌ Erreur lors de l'affichage des résultats :", err);
      }
    } else {
      remainingPolls.push(poll); // encore valide
    }
  }

  savePolls(remainingPolls);
}

module.exports = { checkPolls, loadPolls, savePolls };
