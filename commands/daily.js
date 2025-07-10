const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { addLog } = require('../index'); 

const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const BONUS_ROLE_ID = '972561280344948747'; 
const BONUS_AMOUNT = 500; 
const LOG_CHANNEL_ID_1 = "1346143580049379379"; 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('journalier')
    .setDescription('🪙 Réclame ta récompense quotidienne'),
  
  async execute(interaction) {
    addLog(`🪙 Commande ${interaction.commandName} utilisée par ${interaction.user.tag}`);

    let currencyData;
    try {
      if (fs.existsSync(CURRENCY_FILE)) {
        currencyData = JSON.parse(fs.readFileSync(CURRENCY_FILE, 'utf8'));
      } else {
        currencyData = {};
      }
    } catch (err) {
      console.error("Erreur lors de la lecture de currency.json :", err);
      return interaction.reply({ content: "Erreur lors de la lecture des données.", ephemeral: true });
    }

    const userId = interaction.user.id;
    const now = new Date();

    if (!currencyData[userId]) {
      currencyData[userId] = { balance: 0, lastClaim: null };
    }

    const lastClaim = currencyData[userId].lastClaim ? new Date(currencyData[userId].lastClaim) : null;
    const lastClaimDate = lastClaim ? `${lastClaim.getFullYear()}-${lastClaim.getMonth() + 1}-${lastClaim.getDate()}` : null;
    const nowDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    if (lastClaimDate && lastClaimDate === nowDate) {
      return interaction.reply({ content: "❌ Tu as déjà réclamé ta récompense quotidienne. Réessaie plus tard. ❌", ephemeral: true });
    }

    const baseReward = 1000;
    let reward = baseReward;
    let message;

    if (interaction.member.roles.cache.has(BONUS_ROLE_ID)) {
      reward += BONUS_AMOUNT;
      message = `<@${userId}> Récompense quotidienne réclamée ! Tu reçois ${reward} pièces ! (Bonus Nitro 💜🚀) ✅`;
    } else {
      message = `<@${userId}> Récompense quotidienne réclamée ! Tu reçois ${reward} pièces ! ✅`;
        interaction.client.addLog(`💰 ${interaction.user.tag} a réclamé ${reward} pièces (daily).`);
    }

    currencyData[userId].balance += reward;
    currencyData[userId].lastClaim = now.toISOString();
      

    try {
      fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
    } catch (err) {
      console.error("Erreur lors de l'écriture dans currency.json :", err);
      return interaction.reply({ content: "Erreur lors de la mise à jour des données.", ephemeral: true });
    }

    try {
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID_1);
      if (logChannel) {
        await logChannel.send(`📜 **Daily Log** : <@${userId}> a réclamé sa récompense quotidienne de ${reward} pièces le <t:${Math.floor(Date.now() / 1000)}:F>`);
      }
    } catch (err) {
      console.error("Erreur lors de l'envoi du log dans le canal spécifique :", err);
    }

    return interaction.reply({ content: message });
  }
};
