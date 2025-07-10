// admin-kip.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const POINTS_FILE = path.join(__dirname, '../points.json');

// IDs autorisés
const AUTHORIZED_USERS = [
  '1206053705149841428',
  '185180198075891712'
];

// ID de votre salon de logs
const LOG_CHANNEL_ID = '1350017049858146314';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-kip')
    .setDescription('Permet d’ajouter ou retirer des points KIP à un utilisateur.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('🔒 Ajoute des points KIP à un utilisateur.')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à créditer')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Nombre de points à ajouter')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('🔒 Retire des points KIP à un utilisateur.')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à débiter')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Nombre de points à retirer')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    // Vérifier si la personne exécutant la commande est autorisée
    if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Tu n'as pas l'autorisation d'utiliser cette commande.",
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('utilisateur');
    const amount = interaction.options.getInteger('montant');

    // Lecture du fichier points.json
    let pointsData = {};
    try {
      if (fs.existsSync(POINTS_FILE)) {
        const rawData = fs.readFileSync(POINTS_FILE, 'utf8');
        pointsData = rawData ? JSON.parse(rawData) : {};
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier points.json:', error);
      return interaction.reply({
        content: '❌ Impossible de charger les points.',
        ephemeral: true
      });
    }

    // Initialiser à 0 si l’utilisateur n’existe pas encore
    if (!pointsData[targetUser.id]) {
      pointsData[targetUser.id] = 0;
    }

    let actionText = '';
    if (subcommand === 'add') {
      pointsData[targetUser.id] += amount;
      actionText = `ajouté ${amount} point(s)`;
    } else if (subcommand === 'remove') {
      pointsData[targetUser.id] -= amount;
      actionText = `retiré ${amount} point(s)`;
    }

    // Réponse au staff en mode éphémère (visible uniquement par l'utilisateur)
    await interaction.reply({
      content:
        `✅ ${actionText} à ${targetUser.username}. ` +
        `Nouveau total: **${pointsData[targetUser.id]}**\n`,
      ephemeral: true
    });

    // Écriture dans points.json
    try {
      fs.writeFileSync(POINTS_FILE, JSON.stringify(pointsData, null, 2));
    } catch (error) {
      console.error('Erreur lors de l’écriture dans points.json:', error);
      return interaction.followUp({ 
        content: "⚠️ Les points ont été modifiés, mais n'ont pas pu être sauvés correctement.",
        ephemeral: true
      });
    }

    // ---- LOGS DANS LE SALON SPÉCIFIQUE ----
    // On essaie d'envoyer un message dans le canal de logs
    try {
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(
          `✅**${interaction.user.tag}** a ${actionText} à **${targetUser.tag}**. ` +
          `(Nouveau total: ${pointsData[targetUser.id]} 🐸)`
        );
      }
    } catch (err) {
      console.error('Impossible d’envoyer le log:', err);
    }
  }
};
