const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const POINTS_FILE = 'points.json';
const RESET_INTERVAL = 2 * 30 * 24 * 60 * 60 * 1000; // 2 mois en millisecondes
const RESET_DATE_FILE = 'reset_date.json';
const { getTimeUntilNextReset } = require ('../event-reset-Kint.js')

// Définition des tiers
const rankTiers = [
  { name: 'Iron', min: 0, max: 700 },
  { name: 'Bronze', min: 700, max: 1400 },
  { name: 'Silver', min: 1400, max: 2100 },
  { name: 'Gold', min: 2100, max: 2800 },
  { name: 'Platinum', min: 2800, max: 3500 },
  { name: 'Diamond', min: 3500, max: 4200 },
  { name: 'Master', min: 4200, max: 5500 },
  { name: 'Grandmaster', min: 5500, max: 8000 },
  { name: 'Challenger', min: 8000, max: Infinity }
];

// Ordre des tiers du meilleur au moins bon
const tierOrder = ['Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Iron'];

// Mapping des logos via des émojis personnalisés (remplace les IDs par les tiens)
const tierLogos = {
  "Iron": "<:iron:1343990244214571010>",
  "Bronze": "<:bronze:1343990222089752596>",
  "Silver": "<:silver:1343990116120526950>",
  "Gold": "<:gold:1343990134437052456>",
  "Platinum": "<:platinium:1343990142624600127>",
  "Diamond": "<:diamond:1343990185511092254>",
  "Master": "<:master:1343990151780503635>",
  "Grandmaster": "<:grandmaster:1343990159053553664>",
  "Challenger": "<:challenger:1343990166896902205>"
};

// Fonction pour déterminer le tier à partir des points
function getTier(points) {
  const effective = points < 0 ? 0 : points;
  for (const tier of rankTiers) {
    if (effective >= tier.min && effective < tier.max) {
      return tier.name;
    }
  }
  return "Unranked";
}

function getTimeUntilReset() {
  if (!fs.existsSync(RESET_DATE_FILE)) {
      console.error("❌ Le fichier reset_date.json est introuvable !");
      return "Date de reset non disponible.";
  }

  try {
      const data = fs.readFileSync(RESET_DATE_FILE, 'utf8');
      const jsonData = JSON.parse(data);

      let nextResetTimestamp = jsonData.nextReset;

      // Convertir en timestamp si c'est une string
      if (typeof nextResetTimestamp === "string") {
          nextResetTimestamp = new Date(nextResetTimestamp).getTime();
      }

      if (!nextResetTimestamp || isNaN(nextResetTimestamp)) {
          console.error("❌ La date de reset est invalide !");
          return "Date de reset corrompue.";
      }

      const now = Date.now();
      const diff = nextResetTimestamp - now;

      if (diff <= 0) {
          return "Le reset a déjà eu lieu !";
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      return `${days} jours et ${hours} heures`;
  } catch (error) {
      console.error("❌ Erreur lors de la lecture de reset_date.json :", error);
      return "Erreur de lecture.";
  }
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement-kint')
    .setDescription("🔝 Affiche le classement des points."),
  async execute(interaction) {
    let pointsData = {};
    try {
      if (fs.existsSync(POINTS_FILE)) {
        const data = fs.readFileSync(POINTS_FILE, 'utf8').trim();
        pointsData = data ? JSON.parse(data) : {};
      }
    } catch (error) {
      console.error("❌ Erreur lors de la lecture du fichier JSON:", error);
      return interaction.reply({ content: "Une erreur est survenue lors de la lecture des points.", ephemeral: true });
    }

    if (Object.keys(pointsData).length === 0) {
      return interaction.reply({ content: "Aucun point enregistré pour le moment.", ephemeral: true });
    }

    const userId = interaction.user.id;
    const userPoints = pointsData[userId] || 0;

    // Calcul du classement global
    const overallSorted = Object.entries(pointsData).sort(([, a], [, b]) => b - a);
    const globalRanks = {};
    overallSorted.forEach(([id, pts], index) => {
      globalRanks[id] = index + 1;
    });
    const userGlobalRank = globalRanks[userId];

    // Regroupement des joueurs par tier en intégrant leur rang global
    const grouped = {};
    for (const [id, pts] of Object.entries(pointsData)) {
      const tier = getTier(pts);
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push({ userId: id, points: pts, globalRank: globalRanks[id] });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Classement des Points !")
      .setColor(0xFFD700)
      .setFooter({ text: `🌍 Total joueurs: ${Object.keys(pointsData).length} | Mis à jour en temps réel.` })
      .setDescription(`🚀 Voici le classement des meilleurs joueurs ! 🚀`);

    // Pour chaque tier, afficher la liste des joueurs avec leur rang global, en préfixant par le logo
    for (const tier of tierOrder) {
      if (grouped[tier] && grouped[tier].length > 0) {
        const sortedTier = grouped[tier].sort((a, b) => a.globalRank - b.globalRank);
        const tierText = sortedTier
          .map(player => `**#${player.globalRank}** <@${player.userId}> = ${player.points} points.`)
          .join('\n');
        embed.addFields({ name: `${tierLogos[tier] || ""} **${tier}**`, value: tierText });
      }
    }
    
    const resetTime = getTimeUntilNextReset();
embed.addFields({ 
  name: "⏳ Temps restant avant reset", 
  value: `Le reset aura lieu dans **${resetTime.days} jours, ${resetTime.hours} heures et ${resetTime.minutes} minutes**.` 
});
    await interaction.reply({ embeds: [embed] });
  }
};