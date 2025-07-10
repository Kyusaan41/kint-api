require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const BADGES_FILE = path.join(__dirname, '../badges.json');
const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const POINTS_FILE = path.join(__dirname, '../points.json');
const PURCHASE_LOG_FILE = path.join(__dirname, '../purchase_log.json');
const SUCCESS_FILE = path.join(__dirname, '../success.json');
const ACHIEVEMENTS_FILE = path.join(__dirname, '../datasucces.json');
const TITLES_FILE = path.join(__dirname, '../titles.json');
const TITLES_AVAILABLE_FILE = path.join(__dirname, '../titles_available.json');

let badges = fs.existsSync(BADGES_FILE) ? JSON.parse(fs.readFileSync(BADGES_FILE, 'utf8')) : {};
let achievements = fs.existsSync(ACHIEVEMENTS_FILE) ? JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE, 'utf8')) : {};

function sendSuccessMessage(userId, client, message) {
  if (client) {
    client.users.fetch(userId).then(user => {
      user.send(message);
    }).catch(err => console.error('Erreur lors de l\'envoi du MP:', err));
  }
}

function tryUnlockTitleFromSuccess(userId, successId) {
  const titlesAvailable = fs.existsSync(TITLES_AVAILABLE_FILE) ? JSON.parse(fs.readFileSync(TITLES_AVAILABLE_FILE, 'utf8')) : {};
  const titlesData = fs.existsSync(TITLES_FILE) ? JSON.parse(fs.readFileSync(TITLES_FILE, 'utf8')) : {};

  const matchingTitle = Object.entries(titlesAvailable).find(([title, data]) =>
    data.succes_id === successId
  );

  if (!matchingTitle) return null;

  const [titleName] = matchingTitle;

  if (!titlesData[userId]) {
    titlesData[userId] = { list: [], equipped: null };
  }

  if (!titlesData[userId].list.includes(titleName)) {
    titlesData[userId].list.push(titleName);
    fs.writeFileSync(TITLES_FILE, JSON.stringify(titlesData, null, 2));
    return titleName;
  }
  return null;
}

function syncTitlesWithUnlockedSuccesses(userId) {
  const successData = fs.existsSync(SUCCESS_FILE) ? JSON.parse(fs.readFileSync(SUCCESS_FILE, 'utf8')) : {};
  const userSuccesses = successData[userId] || [];
  userSuccesses.forEach(successId => tryUnlockTitleFromSuccess(userId, successId));
}

function checkAchievements(userId, client) {
  let successData = fs.existsSync(SUCCESS_FILE) ? JSON.parse(fs.readFileSync(SUCCESS_FILE, 'utf8')) : {};
  if (!successData[userId]) successData[userId] = [];

  Object.entries(achievements).forEach(([key, ach]) => {
    const condition = ach.condition;

    if (successData[userId].includes(key)) return;

    const unlockSuccess = () => {
      successData[userId].push(key);
      const unlockedTitle = tryUnlockTitleFromSuccess(userId, key);
      let message = `🏆 Félicitations ! Tu as débloqué le succès **${ach.name}** !`;
      if (unlockedTitle) message += `\n🎖️ Tu as également débloqué le titre **${unlockedTitle}** !`;
      sendSuccessMessage(userId, client, message);
    };

    if (condition === "purchase") {
      if (fs.existsSync(PURCHASE_LOG_FILE)) {
        const purchaseData = JSON.parse(fs.readFileSync(PURCHASE_LOG_FILE, 'utf8'));
        if (purchaseData[userId]) unlockSuccess();
      }
    } else if (condition.startsWith("balance>=")) {
      const requiredBalance = parseInt(condition.split(">=")[1]);
      const currencyData = JSON.parse(fs.readFileSync(CURRENCY_FILE, 'utf8'));
      if (currencyData[userId]?.balance >= requiredBalance) unlockSuccess();
    } else if (condition.startsWith("points>=")) {
      const requiredPoints = parseInt(condition.split(">=")[1]);
      const pointsData = JSON.parse(fs.readFileSync(POINTS_FILE, 'utf8'));
      if (pointsData[userId] >= requiredPoints) unlockSuccess();
    } else if (condition === "daily7") {
      const dailyData = JSON.parse(fs.readFileSync(path.join(__dirname, '../daily_activity.json'), 'utf8'));
      if (dailyData[userId]?.streak >= 7) unlockSuccess();
    } else if (condition.startsWith("curiosity>=")) {
      const required = parseInt(condition.split(">=")[1]);
      const curiosityFile = path.join(__dirname, '../curiosity.json');
      const curiosityData = fs.existsSync(curiosityFile) ? JSON.parse(fs.readFileSync(curiosityFile, 'utf8')) : {};
      if (curiosityData[userId] >= required) unlockSuccess();
    }
  });

  fs.writeFileSync(SUCCESS_FILE, JSON.stringify(successData, null, 2));
  syncTitlesWithUnlockedSuccesses(userId);
}

module.exports = {
  checkAchievements,
  data: new SlashCommandBuilder()
    .setName('succès')
    .setDescription('💎 Affiche la liste des succès débloqués')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Afficher les succès de ce membre')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') || interaction.user;
    const userId = target.id;
    checkAchievements(userId, interaction.client);

    const successData = fs.existsSync(SUCCESS_FILE) ? JSON.parse(fs.readFileSync(SUCCESS_FILE, 'utf8')) : {};
    const unlocked = successData[userId] || [];
    const allSuccesses = Object.entries(achievements);

    const pageSize = 5;
    let page = 0;
    let showLocked = false;

    const getFilteredSuccesses = () =>
      allSuccesses.filter(([key, ach]) =>
        (showLocked || unlocked.includes(key)) && (!ach.hidden || unlocked.includes(key))
      );

    const getPageEmbed = (pageIndex) => {
      const filteredSuccesses = getFilteredSuccesses();
      const totalPages = Math.ceil(filteredSuccesses.length / pageSize);
      const start = pageIndex * pageSize;
      const end = start + pageSize;
      const currentSlice = filteredSuccesses.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Succès de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setColor(0xFFD700)
        .setFooter({ text: `Page ${pageIndex + 1}/${totalPages || 1}` });

      const badgeIcons = unlocked
        .filter(successId => badges[successId])
        .map(successId => badges[successId]);

      if (badgeIcons.length > 0) {
        embed.addFields({
          name: '🎖️ Badges Débloqués',
          value: badgeIcons.join(' '),
          inline: false
        });
      }

      currentSlice.forEach(([key, ach]) => {
        const isUnlocked = unlocked.includes(key);
        embed.addFields({
          name: ach.name,
          value: isUnlocked ? `✅ ${ach.description}` : `🔒 ${ach.description}`,
          inline: false
        });
      });

      return embed;
    };

    const prevBtn = {
      type: 2,
      style: 2,
      label: 'Précédent',
      custom_id: 'succès_prev_page',
      emoji: '⬅️'
    };

    const nextBtn = {
      type: 2,
      style: 2,
      label: 'Suivant',
      custom_id: 'succès_next_page',
      emoji: '➡️'
    };

    const toggleBtn = (showLocked) => ({
      type: 2,
      style: 1,
      label: showLocked ? 'Masquer les succès verrouillés' : 'Voir les succès non débloqués',
      custom_id: 'succès_toggle_locked',
      emoji: showLocked ? '🙈' : '🔓'
    });

    const row = (disabled = false) => {
      const filtered = getFilteredSuccesses();
      const totalPages = Math.ceil(filtered.length / pageSize);
      return {
        type: 1,
        components: [
          { ...prevBtn, disabled: page === 0 || disabled },
          { ...nextBtn, disabled: page >= totalPages - 1 || disabled },
          { ...toggleBtn(showLocked), disabled }
        ]
      };
    };

    const message = await interaction.reply({
      embeds: [getPageEmbed(page)],
      components: [row()],
      fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
      time: 60_000,
      filter: i => i.user.id === interaction.user.id
    });

    collector.on('collect', async i => {
      const filteredSuccesses = getFilteredSuccesses();
      const totalPages = Math.ceil(filteredSuccesses.length / pageSize);

      if (i.customId === 'succès_prev_page' && page > 0) page--;
      else if (i.customId === 'succès_next_page' && page < totalPages - 1) page++;
      else if (i.customId === 'succès_toggle_locked') {
        const curiosityFile = path.join(__dirname, '../curiosity.json');
        let curiosity = fs.existsSync(curiosityFile) ? JSON.parse(fs.readFileSync(curiosityFile, 'utf8')) : {};
        curiosity[userId] = (curiosity[userId] || 0) + 1;

        fs.writeFileSync(curiosityFile, JSON.stringify(curiosity, null, 2));

        checkAchievements(userId, interaction.client);

        showLocked = !showLocked;
        page = 0;
      }

      await i.update({
        embeds: [getPageEmbed(page)],
        components: [row()]
      });
    });

    collector.on('end', async () => {
      await message.edit({
        components: [row(true)]
      });
    });
  }
};
