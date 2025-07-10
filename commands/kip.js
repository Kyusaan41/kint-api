const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const POINTS_FILE = path.join(__dirname, '../points.json');

const tiers = [
  { name: "Iron", min: 0, max: 700, colors: ['#4f4f4f', '#2c2c2c'] },
  { name: "Bronze", min: 700, max: 1400, colors: ['#8d5524', '#3e2723'] },
  { name: "Silver", min: 1400, max: 2100, colors: ['#bdc3c7', '#2c3e50'] },
  { name: "Gold", min: 2100, max: 2800, colors: ['#f1c40f', '#b8860b'] },
  { name: "Platinum", min: 2800, max: 3500, colors: ['#00d2ff', '#3a6073'] },
  { name: "Diamond", min: 3500, max: 4200, colors: ['#7f7fd5', '#86a8e7'] },
  { name: "Master", min: 4200, max: 5500, colors: ['#8e2de2', '#4a00e0'] },
  { name: "Grandmaster", min: 5500, max: 8000, colors: ['#ff416c', '#ff4b2b'] },
  { name: "Challenger", min: 8000, max: Infinity, colors: ['#00c6ff', '#0072ff'] }
];

const tierLogos = {
  Iron: "iron",
  Bronze: "bronze",
  Silver: "silver",
  Gold: "gold",
  Platinum: "platinium",
  Diamond: "diamond",
  Master: "master",
  Grandmaster: "grandmaitre",
  Challenger: "challenger"
};

function getRankInfo(points) {
  for (const tier of tiers) {
    if (points < tier.max) {
      if (["Master", "Grandmaster", "Challenger"].includes(tier.name)) {
        return { tier: tier.name, division: "", colors: tier.colors };
      }
      const interval = (tier.max - tier.min) / 5;
      const division = Math.max(1, 5 - Math.floor((points - tier.min) / interval));
      return { tier: tier.name, division, colors: tier.colors };
    }
  }
  return { tier: "Noob", division: "", colors: ['#333', '#111'] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kip')
    .setDescription('🐸 Affiche tes Points KIP, ton rang et ta position sur le leaderboard.'),

  async execute(interaction) {
    const user = interaction.user;
    const userId = user.id;
    const username = user.username;
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });

    const pointsData = fs.existsSync(POINTS_FILE) ? JSON.parse(fs.readFileSync(POINTS_FILE)) : {};
    const points = pointsData[userId] || 0;

    const { tier, division, colors } = getRankInfo(points);
    const fullRank = `${tier}${division ? ' ' + division : ''}`;
    const rankLogo = tierLogos[tier];

    const leaderboard = Object.entries(pointsData).sort(([, a], [, b]) => b - a);
    const position = leaderboard.findIndex(entry => entry[0] === userId) + 1;
    const nextTier = tiers.find(t => t.min > points);
    const toNext = nextTier ? nextTier.min - points : 0;

    const file = await generateKIPCard({
      username,
      avatarURL,
      points,
      rank: fullRank,
      rankLogo,
      position,
      toNext,
      bgColors: colors
    });

    await interaction.reply({ files: [file] });
  }
};

async function generateKIPCard(user) {
  const canvas = createCanvas(1000, 400);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, user.bgColors[0]);
  gradient.addColorStop(1, user.bgColors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const res = await fetch(user.avatarURL);
  const avatarImg = await loadImage(await res.buffer());
  const avatarX = 80, avatarY = 130, size = 120;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImg, avatarX, avatarY, size, size);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2 + 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 🎯 Nom
  ctx.font = 'bold 38px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00000090';
  ctx.shadowBlur = 5;
  ctx.fillText(user.username.toUpperCase(), 250, 100);
  ctx.shadowBlur = 0;

  // 📊 Statistiques
  ctx.font = '18px Arial';
  ctx.fillStyle = '#00ffffcc';
  ctx.fillText("POINTS KIP", 250, 160);
  ctx.fillText("RANG", 250, 220);
  ctx.fillText("POSITION", 550, 160);
  ctx.fillText("PROCHAIN RANG", 550, 220);

  ctx.font = '28px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(user.points.toString(), 250, 190);
  ctx.fillText(`#${user.position}`, 550, 190);
  ctx.fillText(`${user.toNext} pts`, 550, 250);

  // Rang texte + logo centré
  ctx.fillText(user.rank, 250, 250);
  const textWidth = ctx.measureText(user.rank).width;
  const logoX = 250 + textWidth + 10;
  const logoY = 250 - 28;

  const logoPath = path.join(__dirname, '../assets/ranks/');
  if (fs.existsSync(logoPath)) {
    const files = fs.readdirSync(logoPath);
    const logoFile = files.find(f => f.toLowerCase().includes(user.rankLogo.toLowerCase()));
    if (logoFile) {
      const logoImg = await loadImage(path.join(logoPath, logoFile));
      ctx.drawImage(logoImg, logoX, logoY, 38, 38);
    }
  }

  // 🐸 Punchline
  const punchline = "You bon, you montes.";
  ctx.font = 'italic 22px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00000090';
  ctx.shadowBlur = 4;
  const pWidth = ctx.measureText(punchline).width;
  ctx.fillText(punchline, (canvas.width - pWidth) / 2, canvas.height - 30);
  ctx.shadowBlur = 0;

  const outDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const filePath = path.join(outDir, `${user.username}_kipcard.png`);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  return filePath;
}
