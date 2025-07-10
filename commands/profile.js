const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// --- CHEMINS DES FICHIERS DE DONNÉES ---
const INVENTORY_FILE = path.join(__dirname, '../inventaire.json');
const POINTS_FILE = path.join(__dirname, '../points.json');
const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const XP_FILE = path.join(__dirname, '../xp.json');
const BADGES_SEASON_FILE = path.join(__dirname, '../badgesseason.json');
const TITLES_FILE = path.join(__dirname, '../titles.json');
const BIRTHDAYS_FILE = path.join(__dirname, '../birthdays.json');

// --- CONFIGURATIONS & FONCTIONS UTILITAIRES ---
const tierLogos = {
    "Iron": "iron",
    "Bronze": "bronze",
    "Silver": "silver",
    "Gold": "gold",
    "Platinium": "platinium",
    "Diamond": "diamond",
    "Master": "master",
    "Grandmaster": "grandmaitre",
    "Challenger": "challenger"
};

const tiers = [
    { name: "Iron", min: 0, max: 700 },
    { name: "Bronze", min: 700, max: 1400 },
    { name: "Silver", min: 1400, max: 2100 },
    { name: "Gold", min: 2100, max: 2800 },
    { name: "Platinum", min: 2800, max: 3500 },
    { name: "Diamond", min: 3500, max: 4200 },
    { name: "Master", min: 4200, max: 5500 },
    { name: "Grandmaster", min: 5500, max: 8000 },
    { name: "Challenger", min: 8000, max: Infinity }
];

function getRankInfo(points) {
    if (points < 0) return { tier: "Noob", division: "" };
    for (const tier of tiers) {
        if (points < tier.max) {
            if (["Master", "Grandmaster", "Challenger"].includes(tier.name)) {
                return { tier: tier.name, division: "" };
            }
            const divisionCount = 5;
            const interval = (tier.max - tier.min) / divisionCount;
            let division = divisionCount - Math.floor((points - tier.min) / interval);
            division = Math.max(1, Math.min(division, divisionCount));
            const tierName = tier.name === 'Platinium' ? 'Platinum' : tier.name;
            return { tier: tierName, division };
        }
    }
    return { tier: "Noob", division: "" };
}

async function drawEmoji(ctx, emojiName, x, y, size = 24) {
    const emojiPath = path.join(__dirname, `../assets/emojis/${emojiName}.png`);
    if (fs.existsSync(emojiPath)) {
        try {
            const emojiImg = await loadImage(emojiPath);
            ctx.drawImage(emojiImg, x, y, size, size);
        } catch (err) {
            console.warn(`⚠️ Erreur chargement emoji "${emojiName}" :`, err.message);
        }
    } else {
        console.warn(`❌ Emoji introuvable : ${emojiPath}`);
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function isValidDate(input) {
    const regex = /^(\d{1,2})\/(\d{1,2})(\/(\d{4}))?$/;
    const match = input.match(regex);
    if (!match) return false;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (month < 1 || month > 12) return false;
    const daysInMonth = [31, (isLeapYear(match[4]) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > daysInMonth[month - 1]) return false;
    return true;
}

function isLeapYear(year) {
    if (!year) return false;
    year = parseInt(year, 10);
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// --- COMMANDE DISCORD.JS ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("✨ Affiche le profil d'un utilisateur.")
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription("Utilisateur ciblé")
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
        const userId = targetUser.id;

        if (targetUser.bot) {
            return interaction.reply({ content: "🚫 Les bots n'ont pas de profil à afficher.", ephemeral: true });
        }

        const inventoryData = fs.existsSync(INVENTORY_FILE) ? JSON.parse(fs.readFileSync(INVENTORY_FILE)) : {};
        const pointsData = fs.existsSync(POINTS_FILE) ? JSON.parse(fs.readFileSync(POINTS_FILE)) : {};
        const currencyData = fs.existsSync(CURRENCY_FILE) ? JSON.parse(fs.readFileSync(CURRENCY_FILE)) : {};
        const xpData = fs.existsSync(XP_FILE) ? JSON.parse(fs.readFileSync(XP_FILE)) : {};
        const badgesSeasonData = fs.existsSync(BADGES_SEASON_FILE) ? JSON.parse(fs.readFileSync(BADGES_SEASON_FILE)) : {};
        const titlesData = fs.existsSync(TITLES_FILE) ? JSON.parse(fs.readFileSync(TITLES_FILE)) : {};
        const birthdaysData = fs.existsSync(BIRTHDAYS_FILE) ? JSON.parse(fs.readFileSync(BIRTHDAYS_FILE)) : {};

        if (!birthdaysData[userId]) {
            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply(`${targetUser}, entre ta date d'anniversaire 🎂 au format **JJ/MM** (ex: 25/12)`);
            const filter = m => m.author.id === userId && m.channel.id === interaction.channelId;
            try {
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
                const response = collected.first().content.trim();
                await collected.first().delete();
                if (!isValidDate(response)) {
                    return interaction.followUp({ content: "❌ Date invalide, veuillez réessayer plus tard.", ephemeral: true });
                }
                birthdaysData[userId] = response;
                fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(birthdaysData, null, 2));
                await interaction.followUp({ content: `✅ Date d'anniversaire enregistrée : **${response}**`, ephemeral: true });
            } catch (err) {
                return interaction.followUp({ content: "⏳ Temps écoulé, tu n'as pas répondu à temps.", ephemeral: true });
            }
        } else {
            await interaction.deferReply({ ephemeral: false });
            await interaction.editReply("🚀 Chargement du profil...");
        }

        const points = pointsData[userId] ?? 0;
        const balance = currencyData[userId]?.balance ?? 0;
        const xpInfo = xpData[userId] || { xp: 0 };
        const level = Math.floor(0.1 * Math.sqrt(xpInfo.xp));
        const xpNeeded = Math.pow(level + 1, 2) * 100;
        let oldRankRaw = Array.isArray(badgesSeasonData[userId]) ? badgesSeasonData[userId][0] : null;
        let oldRank = null;
        if (oldRankRaw && typeof oldRankRaw === 'string') {
            const match = oldRankRaw.match(/<:([a-zA-Z0-9_]+):\d+>/);
            oldRank = match ? match[1] : oldRankRaw;
        }
        const { tier, division } = getRankInfo(points);
        const equippedTitle = titlesData[userId]?.equipped || null;
        const birthday = birthdaysData[userId] || "Non renseigné";
        const rankTierName = tier === "Platinum" ? "Platinium" : tier;
        
        const userData = {
            username: targetUser.username,
            avatarURL: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
            level, xp: xpInfo.xp, xpNeeded, balance, kip: points, oldRank,
            currentRank: `${tier}${division ? " " + division : ""}`,
            rankLogo: tierLogos[rankTierName],
            title: equippedTitle,
            birthday
        };

        const userInventory = inventoryData[userId] || {};
        const hasVipAccess = 'VIP_access' in userInventory;
        
        let file;
        if (hasVipAccess) {
            file = await generateVipRankCard(userId, userData);
        } else {
            file = await generateRankCard(userId, userData);
        }

        await interaction.editReply({ content: "\u200B", files: [file] });
    }
};

// --- FONCTION DE GÉNÉRATION DE CARTE STANDARD (inchangée) ---
async function generateRankCard(userId, user) {
    const canvas = createCanvas(1000, 400);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#0d1117');
    gradient.addColorStop(1, '#1a1d23');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, 0, 0, 1000, 400, 30);
    ctx.fill();
    const res = await fetch(user.avatarURL);
    const avatarBuffer = await res.buffer();
    const avatarImg = await loadImage(avatarBuffer);
    const avatarSize = 120;
    const avatarX = 80;
    const avatarY = 140;
    const centerX = avatarX + avatarSize / 2;
    const centerY = avatarY + avatarSize / 2;
    const halo = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, avatarSize);
    halo.addColorStop(0, '#00ffff08');
    halo.addColorStop(0.5, '#00ffff22');
    halo.addColorStop(1, '#8a2be255');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffffcc';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000a0';
    ctx.shadowBlur = 6;
    ctx.fillText(user.username.toUpperCase(), 250, 100);
    ctx.shadowBlur = 0;
    if (user.title) {
        const usernameWidth = ctx.measureText(user.username.toUpperCase()).width;
        ctx.font = 'italic 20px Arial';
        ctx.fillStyle = '#f0c674';
        ctx.fillText(`« ${user.title} »`, 250 + usernameWidth + 15, 100);
    }
    if (user.oldRank && typeof user.oldRank === 'string') {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#f0c674';
        const resetText = `Rang avant reset : ${capitalize(user.oldRank)}`;
        ctx.fillText(resetText, 250, 130);
        const resetTextWidth = ctx.measureText(resetText).width;
        const resetIconX = 250 + resetTextWidth + 10;
        const ranksDir = path.join(__dirname, '../assets/ranks/');
        if (fs.existsSync(ranksDir)) {
            const allFiles = fs.readdirSync(ranksDir);
            const badgeFile = allFiles.find(file => file.toLowerCase().includes(user.oldRank.toLowerCase()));
            if (badgeFile) {
                try {
                    const badgeImg = await loadImage(path.join(ranksDir, badgeFile));
                    ctx.drawImage(badgeImg, resetIconX, 110, 28, 28);
                } catch (e) { console.warn(`⚠️ Badge logo reset error "${badgeFile}" :`, e.message); }
            }
        }
    }
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(240, 140, 700, 2);
    await drawEmoji(ctx, 'level', 250, 148);
    ctx.fillStyle = '#00ffffcc';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('NIVEAU', 280, 170);
    await drawEmoji(ctx, 'xp', 450, 148);
    ctx.fillText('EXP', 480, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px Arial';
    ctx.fillText(`${user.level}`, 250, 200);
    ctx.fillText(`${user.xp} / ${user.xpNeeded}`, 450, 200);
    const barX = 250, barY = 225, barW = 500, barH = 20;
    const xpRatio = Math.min(user.xp / user.xpNeeded, 1);
    drawRoundedRect(ctx, barX, barY, barW, barH, 10);
    ctx.fillStyle = '#2c2c2c';
    ctx.fill();
    if (xpRatio > 0) {
        const xpGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        xpGradient.addColorStop(0, '#00ffff');
        xpGradient.addColorStop(1, '#8a2be2');
        drawRoundedRect(ctx, barX, barY, barW * xpRatio, barH, 10);
        ctx.fillStyle = xpGradient;
        ctx.fill();
    }
    ctx.fillStyle = '#00ffffcc';
    ctx.font = 'bold 18px Arial';
    await drawEmoji(ctx, 'coins', 250, 258);
    ctx.fillText('PIÈCES', 280, 280);
    await drawEmoji(ctx, 'kip', 450, 258);
    ctx.fillText('POINTS KIP', 480, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px Arial';
    ctx.fillText(`${user.balance}`, 250, 310);
    ctx.fillText(`${user.kip}`, 450, 310);
    ctx.fillStyle = '#00ffffcc';
    ctx.font = 'bold 18px Arial';
    await drawEmoji(ctx, 'rank', 650, 258);
    ctx.fillText('RANG', 680, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px Arial';
    ctx.fillText(user.currentRank, 650, 310);
    const rankTextWidth = ctx.measureText(user.currentRank).width;
    const iconX = 650 + rankTextWidth + 10;
    if (user.rankLogo) {
        const ranksDir = path.join(__dirname, '../assets/ranks/');
        if (fs.existsSync(ranksDir)) {
            const allFiles = fs.readdirSync(ranksDir);
            const badgeFile = allFiles.find(file => file.toLowerCase().includes(user.rankLogo.toLowerCase()));
            if (badgeFile) {
                try {
                    const badgeImg = await loadImage(path.join(ranksDir, badgeFile));
                    ctx.drawImage(badgeImg, iconX, 278, 40, 40);
                } catch (e) { console.warn(`⚠️ Badge logo error "${badgeFile}" :`, e.message); }
            }
        }
    }
    ctx.fillStyle = '#f0c674';
    ctx.font = '20px Arial';
    const birthdayText = `${user.birthday}`;
    const textWidth = ctx.measureText(birthdayText).width;
    ctx.fillText(birthdayText, 1000 - textWidth - 30, 130);
    return { attachment: canvas.toBuffer(), name: `profil_${userId}.png` };
}

// --- FONCTION DE GÉNÉRATION DE CARTE VIP (MODIFIÉE) ---
async function generateVipRankCard(userId, user) {
    const canvas = createCanvas(1000, 400);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1000, 0);
    gradient.addColorStop(0.7, '#1a1a1a'); 
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, 0, 0, 1000, 400, 30);
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 2, 2, 996, 396, 28);
    ctx.stroke();
    const res = await fetch(user.avatarURL);
    const avatarBuffer = await res.buffer();
    const avatarImg = await loadImage(avatarBuffer);
    const avatarSize = 120;
    const avatarX = 80;
    const avatarY = 140;
    const centerX = avatarX + avatarSize / 2;
    const centerY = avatarY + avatarSize / 2;
    const halo = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, avatarSize + 20);
    halo.addColorStop(0, 'rgba(255, 215, 0, 0)');
    halo.addColorStop(0.8, 'rgba(255, 215, 0, 0.1)');
    halo.addColorStop(1, 'rgba(255, 215, 0, 0.4)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700cc';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // --- DÉBUT DE LA MODIFICATION : Couronne et texte VIP ---
    const crownSize = 35;
    const crownX = 25; // Position X (proche du bord gauche)
    const crownY = 25; // Position Y (proche du bord haut)
    await drawEmoji(ctx, 'crown', crownX, crownY, crownSize);

    // Ajouter le texte "VIP"
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#000000a0';
    ctx.shadowBlur = 4;
    ctx.textBaseline = 'middle';
    ctx.fillText('VIP', crownX + crownSize + 8, crownY + crownSize / 2);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic'; // Réinitialiser pour les autres textes
    // --- FIN DE LA MODIFICATION ---

    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000a0';
    ctx.shadowBlur = 8;
    ctx.fillText(user.username.toUpperCase(), 250, 100);
    ctx.shadowBlur = 0;
    if (user.title) {
        const usernameWidth = ctx.measureText(user.username.toUpperCase()).width;
        ctx.font = 'italic 20px Arial';
        ctx.fillStyle = '#f0c674';
        ctx.fillText(`« ${user.title} »`, 250 + usernameWidth + 15, 100);
    }
    if (user.oldRank && typeof user.oldRank === 'string') {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#f0c674';
        const resetText = `Rang avant reset : ${capitalize(user.oldRank)}`;
        ctx.fillText(resetText, 250, 130);
        const resetTextWidth = ctx.measureText(resetText).width;
        const resetIconX = 250 + resetTextWidth + 10;
        const ranksDir = path.join(__dirname, '../assets/ranks/');
        if (fs.existsSync(ranksDir)) {
            const allFiles = fs.readdirSync(ranksDir);
            const badgeFile = allFiles.find(file => file.toLowerCase().includes(user.oldRank.toLowerCase()));
            if (badgeFile) {
                try {
                    const badgeImg = await loadImage(path.join(ranksDir, badgeFile));
                    ctx.drawImage(badgeImg, resetIconX, 110, 28, 28);
                } catch (e) { console.warn(`⚠️ Badge logo reset error "${badgeFile}" :`, e.message); }
            }
        }
    }
    ctx.fillStyle = '#444444';
    ctx.fillRect(240, 140, 700, 2);
    const statTitleColor = '#ffd700cc';
    const statValueColor = '#ffffff';
    const statLabelFont = 'bold 18px Arial';
    const statValueFont = '26px Arial';
    await drawEmoji(ctx, 'levelVIP', 250, 148);
    ctx.fillStyle = statTitleColor;
    ctx.font = statLabelFont;
    ctx.fillText('NIVEAU', 280, 170);
    await drawEmoji(ctx, 'xpVIP', 450, 148);
    ctx.fillText('EXP', 480, 170);
    ctx.fillStyle = statValueColor;
    ctx.font = statValueFont;
    ctx.fillText(`${user.level}`, 250, 200);
    ctx.fillText(`${user.xp} / ${user.xpNeeded}`, 450, 200);
    const barX = 250, barY = 225, barW = 500, barH = 20;
    const xpRatio = Math.min(user.xp / user.xpNeeded, 1);
    drawRoundedRect(ctx, barX, barY, barW, barH, 10);
    ctx.fillStyle = '#2c2c2c';
    ctx.fill();
    if (xpRatio > 0) {
        const xpGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        xpGradient.addColorStop(0, '#ffb700');
        xpGradient.addColorStop(1, '#ffd700');
        drawRoundedRect(ctx, barX, barY, barW * xpRatio, barH, 10);
        ctx.fillStyle = xpGradient;
        ctx.fill();
    }
    ctx.fillStyle = statTitleColor;
    ctx.font = statLabelFont;
    await drawEmoji(ctx, 'coinsVIP', 250, 258);
    ctx.fillText('PIÈCES', 280, 280);
    await drawEmoji(ctx, 'kipVIP', 450, 258);
    ctx.fillText('POINTS KIP', 480, 280);
    ctx.fillStyle = statValueColor;
    ctx.font = statValueFont;
    ctx.fillText(`${user.balance}`, 250, 310);
    ctx.fillText(`${user.kip}`, 450, 310);
    ctx.fillStyle = statTitleColor;
    ctx.font = statLabelFont;
    await drawEmoji(ctx, 'rankVIP', 650, 258);
    ctx.fillText('RANG', 680, 280);
    ctx.fillStyle = statValueColor;
    ctx.font = statValueFont;
    ctx.fillText(user.currentRank, 650, 310);
    const rankTextWidth = ctx.measureText(user.currentRank).width;
    const iconX = 650 + rankTextWidth + 10;
    if (user.rankLogo) {
        const ranksDir = path.join(__dirname, '../assets/ranks/');
        if (fs.existsSync(ranksDir)) {
            const allFiles = fs.readdirSync(ranksDir);
            const badgeFile = allFiles.find(file => file.toLowerCase().includes(user.rankLogo.toLowerCase()));
            if (badgeFile) {
                try {
                    const badgeImg = await loadImage(path.join(ranksDir, badgeFile));
                    ctx.drawImage(badgeImg, iconX, 278, 40, 40);
                } catch (e) { console.warn(`⚠️ Badge logo error "${badgeFile}" :`, e.message); }
            }
        }
    }
    ctx.fillStyle = '#f0c674';
    ctx.font = '20px Arial';
    const birthdayText = `${user.birthday}`;
    const textWidth = ctx.measureText(birthdayText).width;
    ctx.fillText(birthdayText, 1000 - textWidth - 30, 130);
    return { attachment: canvas.toBuffer(), name: `profil_vip_${userId}.png` };
}