const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Charge les succès depuis un fichier JSON
const successData = require('../datasucces.json');
const successDataPath = path.join(__dirname, '../success.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-givesuccess')
        .setDescription('🔐 Attribue un succès à un membre.')
        .addUserOption(option => option.setName('membre').setDescription('Le membre à qui attribuer le succès').setRequired(true))
        .addStringOption(option => option.setName('id').setDescription('ID du succès à attribuer').setRequired(true)),
    

    async execute(interaction) {
        if (interaction.user.id !== '1206053705149841428') {
            return interaction.reply({
                content: 'Désolé, tu n\'as pas la permission d\'utiliser cette commande.',
                ephemeral: true,
            });
        }

        const member = interaction.options.getUser('membre');
        const successId = interaction.options.getString('id');

        if (!successData[successId]) {
            return interaction.reply({
                content: 'Succès invalide. Vérifie l\'ID et réessaie.',
                ephemeral: true,
            });
        }

        const successName = successData[successId].name;

        // Lecture explicite du fichier sans cache
        let memberSuccessData = {};
        if (fs.existsSync(successDataPath)) {
            const rawData = fs.readFileSync(successDataPath, 'utf-8');
            memberSuccessData = JSON.parse(rawData);
            console.log('Données des succès chargées :', memberSuccessData);
        }

        if (!memberSuccessData[member.id]) {
            memberSuccessData[member.id] = [];
        }

        console.log('Succès actuel du membre:', memberSuccessData[member.id]);

        if (!memberSuccessData[member.id].includes(successName)) {
            memberSuccessData[member.id].push(successId);
            console.log(`Succès ajouté: ${successName} pour ${member.tag}`);

            try {
                fs.writeFileSync(successDataPath, JSON.stringify(memberSuccessData, null, 2), 'utf-8');
                console.log('Données sauvegardées dans success.json');

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`Succès attribué à ${member.tag} 😉`)
                    .setDescription(`Le succès **${successName}** a été attribué à <@${member.id}>.`)
                    .setFooter({
                        text: `✨ Le succès a été attribué par ${interaction.user.tag} ✨`,
                    });

                return interaction.reply({ embeds: [embed] });

            } catch (err) {
                console.error('Erreur lors de la sauvegarde :', err);
                return interaction.reply({
                    content: 'Erreur lors de la sauvegarde. Réessaie plus tard.',
                    ephemeral: true,
                });
            }
        } else {
            return interaction.reply({
                content: `Le membre **${member.tag}** a déjà le succès **${successName}**.`,
                ephemeral: true,
            });
        }
    },
};
