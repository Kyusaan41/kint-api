const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, './currency.json');
const TITLES_FILE = path.join(__dirname, './titles.json');
const TITLES_AVAILABLE_FILE = path.join(__dirname, './titles_available.json');

const CHANNEL_ID = ''; // Remplace par l'ID du salon

function loadCurrencyData() {
  if (!fs.existsSync(CURRENCY_FILE)) {
    fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(CURRENCY_FILE, 'utf8'));
}

function saveCurrencyData(data) {
  fs.writeFileSync(CURRENCY_FILE, JSON.stringify(data, null, 2));
}

function getRandomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomLoot() {
  const roll = Math.random() * 100;
  if (roll < 1) return 'title';
  if (roll < 40) return 'nothing';
  return 'money';
}

function getRandomLootableTitle() {
  const titlesAvailable = JSON.parse(fs.readFileSync(TITLES_AVAILABLE_FILE, 'utf8'));
  const lootableTitles = Object.entries(titlesAvailable).filter(([_, data]) => data.loot).map(([title]) => title);
  if (lootableTitles.length === 0) return null;
  return lootableTitles[Math.floor(Math.random() * lootableTitles.length)];
}

const INTERVAL = 5 * 60 * 60 * 1000;
const TIMEOUT = 10 * 1000;

async function sendAirdrop(client) {
  console.log('🚀 Début de la fonction sendAirdrop()...');
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.log(`❌ Aucun salon trouvé avec l'ID: ${CHANNEL_ID}`);
    return;
  }

  const botPermissions = channel.permissionsFor(client.user);
  if (!botPermissions.has(PermissionsBitField.Flags.ViewChannel) ||
      !botPermissions.has(PermissionsBitField.Flags.SendMessages) ||
      !botPermissions.has(PermissionsBitField.Flags.MentionEveryone)) {
    console.log("🚫 Le bot n'a pas les permissions nécessaires pour envoyer un message dans ce salon.");
    return;
  }
  console.log('✅ Le bot a les permissions nécessaires pour envoyer un message.');

  const embed = new EmbedBuilder()
    .setTitle('🎁 LARGAGE DE RAVITAILLEMENT 🎁')
    .setDescription("Un largage de ravitaillement est arrivé ! Clique sur le bouton pour l'ouvrir.")
    .setColor(0x00AE86);

  const button = new ButtonBuilder()
    .setCustomId('airdrop_open')
    .setLabel('Ouvrir le largage')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);

  try {
    const message = await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Message de largage envoyé avec succès.');

    const filter = (interaction) => interaction.customId === 'airdrop_open';
    const collector = message.createMessageComponentCollector({ filter, time: TIMEOUT });

    let isClaimed = false;

    collector.on('collect', async (interaction) => {
      if (isClaimed) return;
      isClaimed = true;

      const userId = interaction.user.id;
      const currencyData = loadCurrencyData();
      const lootType = getRandomLoot();

      let messageContent = '';
      let logMessage = '';

      if (lootType === 'money') {
        const amount = getRandomAmount(250, 500);
        currencyData[userId] = currencyData[userId] || { balance: 0 };
        currencyData[userId].balance += amount;
        saveCurrencyData(currencyData);

        messageContent = `🎉 Félicitations ${interaction.user} ! Tu as récupéré le largage et gagné **${amount}** pièces !`;
        logMessage = `<@${userId}> a récupéré ${amount} pièces dans un largage le <t:${Math.floor(Date.now() / 1000)}:F>`;

      } else if (lootType === 'nothing') {
        messageContent = `😢 Pas de chance ${interaction.user}... Le largage était vide !`;
        logMessage = `<@${userId}> a ouvert un largage vide le <t:${Math.floor(Date.now() / 1000)}:F>`;

      } else if (lootType === 'title') {
        const titleName = getRandomLootableTitle();
        if (!titleName) {
          messageContent = `😢 Le largage était vide ! Aucun titre lootable disponible.`;
          logMessage = `<@${userId}> a tenté de looter un titre mais aucun disponible.`;
        } else {
          const titlesData = fs.existsSync(TITLES_FILE) ? JSON.parse(fs.readFileSync(TITLES_FILE, 'utf8')) : {};
          if (!titlesData[userId]) titlesData[userId] = { list: [], equipped: null };
          if (!titlesData[userId].list.includes(titleName)) {
            titlesData[userId].list.push(titleName);
            fs.writeFileSync(TITLES_FILE, JSON.stringify(titlesData, null, 2));
          }

          messageContent = `🏷️ Incroyable ${interaction.user} ! Tu as looté le titre **${titleName}** dans le largage !`;
          logMessage = `<@${userId}> a looté le titre **${titleName}** dans un largage le <t:${Math.floor(Date.now() / 1000)}:F>`;
        }
      }

      await interaction.update({ content: messageContent, embeds: [], components: [] });

      const LOG_CHANNEL_ID = '1346142836080246926';
      const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send(logMessage);
    });

    collector.on('end', async () => {
      console.log('⏰ Temps écoulé pour le largage.');
      await message.delete();

      if (!isClaimed) {
        channel.send("❌ Personne n'est venu récupérer le largage, je rentre à la base !")
          .then(sentMsg => setTimeout(() => sentMsg.delete(), 10000));
        console.log('❌ Largage expiré, aucun gagnant.');
      }
    });
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi du message de largage :", error);
    console.error('🔎 Erreur complète :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
}

/**
 * Fonction qui INITIE le système de largage :
 * - 1er largage après 5 secondes
 * - Ensuite toutes les 5 heures
 * @param {import('discord.js').Client} client
 */
function initAirdrop(client) {
  console.log('✅ initAirdrop : Système de largage activé.');

  // Largage forcé après 5 secondes
  setTimeout(() => {
    console.log('🚀 Envoi forcé du premier largage maintenant !');
    sendAirdrop(client);
  }, 5000);

  // Largages répétés toutes les 5 heures
  setInterval(() => {
    console.log('⏰ Envoi du prochain largage programmé.');
    sendAirdrop(client);
  }, INTERVAL);
}

module.exports = {
  initAirdrop
};
