const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const ADMIN_USER_ID = '1206053705149841428'; // Ton ID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-giveall')
        .setDescription('🔒 Donne des pièces à tous les membres du serveur.')
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Montant de pièces à donner à chaque membre')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message à envoyer à chaque membre (optionnel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Vérification de l'admin
        if (interaction.user.id !== ADMIN_USER_ID) {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        const montant = interaction.options.getInteger('montant');
        const message = interaction.options.getString('message') || `💸 Tu as reçu ${montant} pièces de la part de l'admin.`;

        if (montant <= 0) {
            return interaction.reply({ content: "❌ Le montant doit être supérieur à 0.", ephemeral: true });
        }

        // Lecture ou initialisation du fichier currency.json
        let currencyData = {};
        try {
            if (!fs.existsSync(CURRENCY_FILE)) {
                fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
            }
            const rawData = fs.readFileSync(CURRENCY_FILE, 'utf8');
            currencyData = rawData ? JSON.parse(rawData) : {};
        } catch (err) {
            console.error("Erreur lecture currency.json :", err);
            return interaction.reply("❌ Erreur lors de la lecture des données.");
        }

        const members = await interaction.guild.members.fetch();
        let count = 0;

        for (const member of members.values()) {
            if (member.user.bot) continue;

            const userId = member.user.id;

            if (!currencyData[userId]) {
                currencyData[userId] = { balance: 0, lastClaim: 0 };
            }

            currencyData[userId].balance += montant;
            count++;

            // DM
            try {
                await member.send(message);
            } catch {
                console.log(`DM impossible à ${member.user.tag}`);
            }
        }

        // Enregistrement
        try {
            fs.writeFileSync(CURRENCY_FILE, JSON.stringify(currencyData, null, 2));
        } catch (err) {
            console.error("Erreur sauvegarde currency.json :", err);
            return interaction.reply("❌ Erreur lors de la sauvegarde.");
        }

        return interaction.reply(`✅ ${montant} pièces envoyées à **${count}** membres.`);
    },
};
