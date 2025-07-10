const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const STATS_FILE = 'Statskint.json';

const command = new SlashCommandBuilder()
  .setName('kintstats')
  .setDescription('🚀 Affiche le leaderboard des Kints');

module.exports = {
  data: command,

  async execute(interaction) {
    let statsData = {};
    if (fs.existsSync(STATS_FILE)) {
      statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }

    // Convertir en tableau
    const allUsers = Object.entries(statsData)
      .map(([userId, stats]) => ({ userId, ...stats }));

    if (allUsers.length === 0) {
      return interaction.reply({ content: "Aucune donnée de Kint disponible.", ephemeral: true });
    }

    // Trier par total décroissant et prendre top 10
    const leaderboard = allUsers
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Trouver "le plus guez" sur *tous* les joueurs avec un minimum de parties
    const MIN_GAMES = 20;
    const candidates = allUsers.filter(user => user.total >= MIN_GAMES);

    let topUser;

    if (candidates.length > 0) {
      topUser = candidates.reduce((max, user) => {
        const userRatio = user.oui / user.total;
        const maxRatio = max.oui / max.total;
        return userRatio > maxRatio ? user : max;
      }, candidates[0]);
    } else {
      // Si personne ne dépasse le minimum, on prend le pire dans le top 10
      topUser = leaderboard.reduce((max, user) => {
        const userRatio = user.oui / user.total;
        const maxRatio = max.oui / max.total;
        return userRatio > maxRatio ? user : max;
      }, leaderboard[0]);
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Classement des Kints")
      .setColor(0xFFD700)
      .setDescription(
        leaderboard.map((user, index) => {
          const intRatio = ((user.oui / user.total) * 100).toFixed(2);
          return `**${index + 1}.** <@${user.userId}> — **${user.total}** Kints (✅ ${user.non} / ❌ ${user.oui}) - Taux d'int : **${intRatio}%**`;
        }).join('\n')
      );

    embed.addFields({
      name: "Le plus guez du serveur 💩",
      value: `<@${topUser.userId}> est le plus nul du serveur, avec un pourcentage d'int est de **${((topUser.oui / topUser.total) * 100).toFixed(2)}%** !`,
    });

    await interaction.reply({ embeds: [embed] });
  },

  updateStats(interaction, responseType) {
    console.log(`📊 Mise à jour des stats pour ${interaction.user.username} - Réponse : ${responseType}`);

    let statsData = {};
    if (fs.existsSync(STATS_FILE)) {
      statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }

    const userId = interaction.user.id;
    if (!statsData[userId]) {
      statsData[userId] = { total: 0, oui: 0, non: 0 };
    }

    statsData[userId].total += 1;
    if (responseType === 'oui') {
      statsData[userId].oui += 1;
    } else {
      statsData[userId].non += 1;
    }

    fs.writeFileSync(STATS_FILE, JSON.stringify(statsData, null, 2));
  }
};
