const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Assurez-vous que le chemin est correct
const CURRENCY_FILE = path.join(__dirname, '../currency.json'); 
const BONUS_ROLE_ID = '972561280344948747'; 
const BONUS_AMOUNT = 500; 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('journalier')
    .setDescription('🪙 Réclame ta récompense quotidienne'),
  
  async execute(interaction) {
    // Utilisez interaction.client.addLog si c'est la méthode de votre bot
    console.log(`🪙 Commande ${interaction.commandName} utilisée par ${interaction.user.tag}`);

    let currencyData;
    try {
      if (fs.existsSync(CURRENCY_FILE)) {
        currencyData = JSON.parse(fs.readFileSync(CURRENCY_FILE, 'utf8'));
      } else {
        currencyData = {};
      }
    } catch (err) {
      console.error("Erreur lecture currency.json:", err);
      return interaction.reply({ content: "Erreur interne (lecture).", ephemeral: true });
    }

    const userId = interaction.user.id;
    const now = new Date();

    if (!currencyData[userId]) {
      // On initialise l'objet avec tous les champs nécessaires
      currencyData[userId] = { balance: 0, lastDaily: null, lastBonus: null };
    }

    // ▼▼▼ MODIFICATION ICI ▼▼▼
    // On vérifie le minuteur "lastDaily"
    const lastClaim = currencyData[userId].lastDaily ? new Date(currencyData[userId].lastDaily) : null;
    const lastClaimDate = lastClaim ? `${lastClaim.getFullYear()}-${lastClaim.getMonth() + 1}-${lastClaim.getDate()}` : null;
    const nowDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    if (lastClaimDate && lastClaimDate === nowDate) {
      return interaction.reply({ content: "❌ Tu as déjà réclamé ta récompense quotidienne. Réessaie demain ! ❌", ephemeral: true });
    }

    const baseReward = 1000;
    let reward = baseReward;
    let message;

    if (interaction.member.roles.cache.has(BONUS_ROLE_ID)) {
      reward += BONUS_AMOUNT;
      message = `<@${userId}> Récompense quotidienne réclamée ! Tu reçois ${reward} pièces ! (Bonus Nitro 💜🚀) ✅`;
    } else {
      message = `<@${userId}> Récompense quotidienne réclamée ! Tu reçois ${reward} pièces ! ✅`;
    }

    currencyData[userId].balance += reward;
    // ▼▼▼ MODIFICATION ICI ▼▼▼
    // On met à jour le minuteur "lastDaily"
    currencyData[userId].lastDaily = now.toISOString();
      
    try {
      fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
    } catch (err) {
      console.error("Erreur écriture currency.json:", err);
      return interaction.reply({ content: "Erreur interne (écriture).", ephemeral: true });
    }
    
    // Log pour un canal Discord
     try {
      const logChannel = await interaction.client.channels.fetch("1346143580049379379");
       if (logChannel) {
       await logChannel.send(`📜 Daily Log: <@${userId}> a réclamé ${reward} pièces.`);
       }
     } catch (err) {
       console.error("Erreur envoi du log.", err);
     }

    return interaction.reply({ content: message });
  }
};