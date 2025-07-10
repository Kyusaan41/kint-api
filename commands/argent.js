const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, '../currency.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('argent')
        .setDescription("💰 Affiche ton solde actuel de pièces."),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        let currencyData;
        try {
            if (!fs.existsSync(CURRENCY_FILE)) {
                fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
            }
            
            const rawData = fs.readFileSync(CURRENCY_FILE, 'utf8');
            currencyData = rawData ? JSON.parse(rawData) : {};
        } catch (error) {
            console.error("Erreur lors de la lecture du fichier currency.json :", error);
            return interaction.reply("❌ Erreur lors de la récupération de ton solde. Réessaie plus tard.");
        }
        
        const userBalance = currencyData[userId]?.balance || 0;
        
        return interaction.reply(`💰 ${interaction.user}, tu as actuellement **${userBalance}** pièces !`);
    }
};
