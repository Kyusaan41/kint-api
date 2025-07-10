const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, '../currency.json');
// Ajoute l'ID du channel où tu veux envoyer les logs
const LOG_CHANNEL_ID = "1346148703228006531"; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('paie')
        .setDescription("🪙 Transfère des pièces à un autre utilisateur.")
        .addUserOption(option => 
            option.setName('utilisateur')
                .setDescription("L'utilisateur qui recevra les pièces.")
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('montant')
                .setDescription("Le montant à transférer.")
                .setRequired(true)),

    async execute(interaction) {
        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        if (amount <= 0) {
            return interaction.reply("❌ Le montant doit être supérieur à 0.");
        }

        if (receiver.id === senderId) {
            return interaction.reply("❌ Tu ne peux pas t'envoyer des pièces à toi-même !");
        }

        let currencyData;
        try {
            if (!fs.existsSync(CURRENCY_FILE)) {
                fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
            }
            
            const rawData = fs.readFileSync(CURRENCY_FILE, 'utf8');
            currencyData = rawData ? JSON.parse(rawData) : {};
        } catch (error) {
            console.error("Erreur lors de la lecture du fichier currency.json :", error);
            return interaction.reply("❌ Erreur lors de la récupération des données. Réessaie plus tard.");
        }

        const senderData = currencyData[senderId] || { balance: 0 };
        const receiverData = currencyData[receiver.id] || { balance: 0 };

        if (senderData.balance < amount) {
            return interaction.reply("❌ Tu n'as pas assez de pièces pour faire ce transfert.");
        }

        senderData.balance -= amount;
        receiverData.balance += amount;
        currencyData[senderId] = senderData;
        currencyData[receiver.id] = receiverData;

        // Sauvegarde dans le fichier JSON
        try {
            fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
        } catch (error) {
            console.error("Erreur lors de l'écriture dans currency.json :", error);
            return interaction.reply("❌ Erreur lors de la sauvegarde de la transaction. Réessaie plus tard.");
        }

        // Envoi du log dans le channel spécifique
        try {
            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(
                    `:moneybag: **Log Paie** : <@${senderId}> a envoyé **${amount}** pièces à <@${receiver.id}> le ${new Date().toLocaleString()}`
                );
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi du log dans le canal :", error);
        }

        // Réponse finale à l'utilisateur
        return interaction.reply(`✅ ${interaction.user} a envoyé **${amount}** pièces à ${receiver} ! 💸`);
    }
};
