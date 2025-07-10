const { SlashCommandBuilder } = require('discord.js');

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const LOTTERY_FILE = path.join(__dirname, '../lottery.json');
const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const JACKPOT_FILE = path.join(__dirname, '../jackpot.json'); // Nouveau fichier pour la cagnotte
const LOG_CHANNEL_ID = "1387426110207295508"; // ID du salon pour annoncer les résultats
const ANNOUNCE_CHANNEL_ID = "1387426110207295508"; // ID du salon pour annoncer la cagnotte quotidienne
const DAILY_JACKPOT_INCREASE = 7737; // Augmentation quotidienne
const TICKET_PRICE = 5000; // Prix d'un ticket

const readJSON = (filePath) => fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
const writeJSON = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

const loadLotteryData = () => {
  if (!fs.existsSync(LOTTERY_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOTTERY_FILE, 'utf8'));
};

module.exports = {
  data: new SlashCommandBuilder()
      .setName('lotterie')
      .setDescription('🎫 Affiche les participations à la loterie'),

  async execute(interaction) {
    let lotteryData = loadLotteryData();

    if (Object.keys(lotteryData).length === 0) {
        return await interaction.reply({ content: "🎟️ Il n'y a encore aucune participation à la loterie.", ephemeral: false });
    }

    let message = "🎟️ Voici les participations à la loterie :\n\n";
    for (const [userId, numbersList] of Object.entries(lotteryData)) {
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        const username = user ? user.username : `Utilisateur inconnu (${userId})`;
        
        numbersList.forEach((numbers, index) => {
            message += `**${username}** (Ticket #${index + 1}) : ${numbers.join(", ")}\n`;
        });
    }

    return await interaction.reply({ content: message, ephemeral: false });
  }
};

function generateWinningNumbers() {
  const numbers = new Set();
  while (numbers.size < 5) {
    numbers.add(Math.floor(Math.random() * 50) + 1);
  }
  return [...numbers].sort((a, b) => a - b);
}

function checkWinners(lotteryData, winningNumbers) {
  const results = [];
  for (const userId in lotteryData) {
    const userNumbers = lotteryData[userId];
    const matchedNumbers = userNumbers.filter(num => winningNumbers.includes(num)).length;
    if (matchedNumbers > 0) {
      results.push({ userId, matchedNumbers });
    }
  }
  return results;
}

client.once('ready', async () => {
  console.log(`✅ Tirage automatique activé.`);
  
  let jackpotData = readJSON(JACKPOT_FILE);
  if (!jackpotData.amount) jackpotData.amount = 50000; // Cagnotte de départ
  
  setInterval(async () => {
    const now = new Date();
    console.log(`⏳ Vérification du tirage à ${now.getHours()}h${now.getMinutes()}`);

    if (now.getHours() === 20 && now.getMinutes() === 0) {
      const winningNumbers = generateWinningNumbers();
      const lotteryData = readJSON(LOTTERY_FILE);
      const currencyData = readJSON(CURRENCY_FILE);
    
      let embed = new EmbedBuilder()
        .setTitle("🎰 **Résultats du CoinMillion !** 🎰")
        .setDescription("Voici les résultats du tirage d'aujourd'hui !")
        .setColor("#FFD700")
        .addFields(
          { name: "💰 **Cagnotte à gagner**", value: `🏆 **${jackpotData.amount.toLocaleString()}** pièces !`, inline: false },
          { name: "🔢 Numéros gagnants", value: `**${winningNumbers.join(', ')}**`, inline: true }
        )
        .setTimestamp();
    
      let winnerList = "";
      let jackpotWon = false;
    
      for (const userId in lotteryData) {
        const tickets = lotteryData[userId];
        for (const ticket of tickets) {
          const matchedNumbers = ticket.filter(num => winningNumbers.includes(num)).length;
    
          let reward = 0;
          if (matchedNumbers === 5) {
            reward = jackpotData.amount;
            jackpotData.amount = 50000; // reset le jackpot
            jackpotWon = true;
          } else if (matchedNumbers === 4) {
            reward = jackpotData.amount * 0.5;
          } else if (matchedNumbers === 3) {
            reward = jackpotData.amount / 3;
          } else if (matchedNumbers === 2) {
            reward = 3000;
          }
    
          if (reward > 0) {
            if (!currencyData[userId]) currencyData[userId] = { balance: 0 };
            currencyData[userId].balance += reward;
    
            const formattedReward = reward.toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
    
            winnerList += `<@${userId}> 🎉 a trouvé **${matchedNumbers}** numéros et gagne **${formattedReward} pièces** !\n`;
          }
        }
      }
    
      if (!jackpotWon) {
        jackpotData.amount += DAILY_JACKPOT_INCREASE;

        // Bloquer la cagnotte à 150000 pièces max
        if (jackpotData.amount > 150000) {
          jackpotData.amount = 150000;
        }
      
        const announceChannel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
        if (announceChannel) {
          const announceEmbed = new EmbedBuilder()
            .setColor("#00BFFF")
            .setTitle("📈 Augmentation de la Cagnotte")
            .setDescription(
              `Aucun joueur n’a trouvé les 5 bons numéros aujourd’hui...\n` +
              `💰 La cagnotte grimpe à **${jackpotData.amount.toLocaleString()} pièces** pour demain !`
            )
            .setFooter({ text: "Reviens tenter ta chance demain !" })
            .setTimestamp();
      
          announceChannel.send({ embeds: [announceEmbed] }).catch(console.error);
        }
      }

      if (winnerList !== "") {
        embed.addFields({ name: "🏆 Gagnants", value: winnerList });
      } else {
        embed.addFields({ name: "😢 Aucun gagnant aujourd'hui...", value: "Retente ta chance demain !" });
      }
    
      try {
        writeJSON(CURRENCY_FILE, currencyData);
        writeJSON(LOTTERY_FILE, {}); // reset la loterie
        writeJSON(JACKPOT_FILE, jackpotData);
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des fichiers JSON :", error);
      }
    
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [embed] }).catch(console.error);
    }
  }, 60 * 1000); // ⏰ Vérifie chaque minute
});

client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('Échec de connexion: Token invalide ou problème réseau', error);
});
