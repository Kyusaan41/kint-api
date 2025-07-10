const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const ADMIN_USER_ID = '1206053705149841428';  // Remplace par ton UserID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-remove')
        .setDescription('🔒 Commande secrète pour retirer des pièces à un utilisateur.')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription("L'utilisateur à qui retirer des pièces")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription("Montant de pièces à retirer")
                .setRequired(true)
        ),

    async execute(interaction) {
        // Vérification de l'ID de l'utilisateur
        if (interaction.user.id !== ADMIN_USER_ID) {
            return interaction.reply({ content: "❌ Cette commande est réservée à mon créateur.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        if (amount <= 0) {
            return interaction.reply({ content: "❌ Le montant doit être positif.", ephemeral: true });
        }

        // Lecture du fichier currency.json
        let currencyData;
        try {
            if (!fs.existsSync(CURRENCY_FILE)) {
                fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
            }

            const rawData = fs.readFileSync(CURRENCY_FILE, 'utf8');
            currencyData = rawData ? JSON.parse(rawData) : {};
        } catch (error) {
            console.error("Erreur lors de la lecture du fichier currency.json :", error);
            return interaction.reply("❌ Erreur lors de la récupération des données de pièces.");
        }

        // Mise à jour des pièces de l'utilisateur cible
        const targetId = targetUser.id;
        if (!currencyData[targetId]) {
            currencyData[targetId] = {
                balance: 0,
                lastClaim: 0
            };
        }

        if (currencyData[targetId].balance < amount) {
            return interaction.reply({ content: `❌ ${targetUser} n'a pas assez de pièces.`, ephemeral: true });
        }

        currencyData[targetId].balance -= amount;

        // Enregistrement des données
        try {
            fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
        } catch (error) {
            console.error("Erreur lors de l'écriture dans currency.json :", error);
            return interaction.reply("❌ Erreur lors de la sauvegarde des données de pièces.");
        }

        return interaction.reply({ content: `${targetUser} Ton bot préféré a perdu sa femme, son travail et ses enfants. Il n'a plus un sou en poche. Il décide donc de te voler ${amount} pièces.`, ephemeral: false });
    }
};
