const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BIRTHDAYS_FILE = path.join(__dirname, '../birthdays.json');
const INVENTORY_FILE = path.join(__dirname, '../inventaire.json');
const POINTS_FILE = path.join(__dirname, '../points.json');    // pour KIP (points Kint)
const CURRENCY_FILE = path.join(__dirname, '../currency.json'); // pour les pièces

console.log('🎂 Birthday.js a bien été chargé.');

async function checkBirthdays(client) {
  if (!fs.existsSync(BIRTHDAYS_FILE)) return;

  const birthdaysData = JSON.parse(fs.readFileSync(BIRTHDAYS_FILE));
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const channelId = '1114274853764210860'; // ← Remplace par ton ID de canal
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    console.warn("❌ Le canal d'anniversaires n'a pas été trouvé !");
    return;
  }

  for (const userId in birthdaysData) {
    const bday = birthdaysData[userId];
    const parts = bday.split('/');
    if (parts.length < 2) continue;

    const bdayDay = parseInt(parts[0], 10);
    const bdayMonth = parseInt(parts[1], 10);

    if (bdayDay === day && bdayMonth === month) {
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      const mention = member ? `<@${userId}>` : "Quelqu'un";

      // Message public dans le channel
      channel.send(`🎉 Joyeux anniversaire ${mention} ! 🥳🎂`);

      // Envoi du message privé avec bouton cadeau
      try {
        const user = await client.users.fetch(userId);
        if (!user) continue;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`birthday_gift_${userId}`)
            .setLabel('🎁 Ouvrir cadeau')
            .setStyle(ButtonStyle.Primary)
        );

        await user.send({
          content: `🎉 Joyeux anniversaire ${user.username} ! Voici un cadeau pour toi : 5 000 pièces et 1 Kshield !`,
          components: [row]
        });
      } catch (err) {
        console.warn(`❌ Impossible d'envoyer le message privé à ${userId}`);
      }
    }
  }
}

// Fonction à appeler depuis ton client sur interactionCreate
async function handleBirthdayGift(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('birthday_gift_')) return false;

  const userId = interaction.user.id;
  const targetUserId = interaction.customId.split('_')[2];
  if (userId !== targetUserId) {
    return interaction.reply({ content: "❌ Ce cadeau n'est pas pour toi !", ephemeral: true });
  }

  // Charger inventaire, points et currency
  const inventoryData = fs.existsSync(INVENTORY_FILE) ? JSON.parse(fs.readFileSync(INVENTORY_FILE)) : {};
  const pointsData = fs.existsSync(POINTS_FILE) ? JSON.parse(fs.readFileSync(POINTS_FILE)) : {};
  const currencyData = fs.existsSync(CURRENCY_FILE) ? JSON.parse(fs.readFileSync(CURRENCY_FILE)) : {};

  // Ajouter 5 000 pièces (currency)
  if (!currencyData[userId]) currencyData[userId] = { pieces: 0 };
  currencyData[userId].pieces += 5000;

  // Ajouter 1 Kshield dans l'inventaire
  if (!inventoryData[userId]) inventoryData[userId] = {};
  if (!inventoryData[userId]['Kshield']) inventoryData[userId]['Kshield'] = { quantity: 0 };
  inventoryData[userId]['Kshield'].quantity += 1;

  // Sauvegarder
  fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventoryData, null, 2));

  await interaction.update({ content: "🎉 Tu as bien reçu ton cadeau d'anniversaire : 5 000 pièces et 1 Kshield ! Profites-en bien !", components: [] });

  return true;
}

module.exports = { checkBirthdays, handleBirthdayGift };
