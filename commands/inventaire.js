const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const INVENTORY_FILE = path.join(__dirname, '../inventaire.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription("🎒 Affiche les objets possédés par l'utilisateur."),

  async execute(interaction) {
    const userId = interaction.user.id;
    let inventoryData;

    try {
      if (!fs.existsSync(INVENTORY_FILE)) {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify({}));
      }
      
      const rawData = fs.readFileSync(INVENTORY_FILE, 'utf8');
      inventoryData = rawData ? JSON.parse(rawData) : {};
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier inventaire.json :", error);
      return interaction.reply("❌ Erreur lors de la récupération de l'inventaire. Réessaie plus tard.");
    }
    
    const userInventory = inventoryData[userId] || [];

    // Si l'inventaire est un objet (ancienne structure), on le convertit en tableau
    let inventoryList = [];
    if (Array.isArray(userInventory)) {
      inventoryList = userInventory;
    } else if (typeof userInventory === 'object') {
      for (const [item, details] of Object.entries(userInventory)) {
        if (details && typeof details === 'object' && details.quantity) {
          inventoryList.push(`${item} x${details.quantity}`);
        } else {
          inventoryList.push(item);
        }
      }
    }
    
    if (inventoryList.length === 0) {
      return interaction.reply("🎒 Ton inventaire est vide !");
    }
    
    let inventoryMessage = "🎒 **Ton inventaire :**\n";
    inventoryMessage += inventoryList.map(item => `- ${item}`).join('\n');
    
    return interaction.reply(inventoryMessage);
  }
};
