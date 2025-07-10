const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CURRENCY_FILE = path.join(__dirname, '../currency.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement-argent')
    .setDescription("💰 Affiche le classement des utilisateurs en fonction de leurs pièces."),

  async execute(interaction) {
    await interaction.deferReply();

    // Lecture des données de currency.json
    let currencyData = {};
    try {
      if (fs.existsSync(CURRENCY_FILE)) {
        const rawData = fs.readFileSync(CURRENCY_FILE, 'utf8');
        currencyData = JSON.parse(rawData);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la lecture du fichier JSON:", error);
      return interaction.editReply({ content: "Une erreur est survenue lors de la lecture des pièces.", ephemeral: true });
    }

    // Vérification s'il y a des utilisateurs avec des pièces
    if (Object.keys(currencyData).length === 0) {
      return interaction.editReply({ content: "Aucune pièce enregistrée pour le moment.", ephemeral: true });
    }

    // Tri des utilisateurs par solde de pièces (du plus riche au plus pauvre)
    const leaderboard = Object.entries(currencyData)
      .map(([id, data]) => ({ id, balance: data.balance || 0 }))
      .sort((a, b) => b.balance - a.balance);

    // Afficher toute la liste ou un minimum de 10 joueurs
    const topList = leaderboard.length >= 20 ? leaderboard.slice(0, 20) : leaderboard;

    const embed = new EmbedBuilder()
      .setTitle("💰 **Classement des Plus Riches !**")
      .setColor(0xFFD700)
      .setThumbnail(interaction.client.user.displayAvatarURL()) // Avatar du bot
      .setDescription("Voici le classement des utilisateurs avec le plus de pièces :")
      .setFooter({ text: `💸 Total utilisateurs: ${Object.keys(currencyData).length} | Mis à jour en temps réel.` })
      .setTimestamp();

    // Compactage du classement
    let rankText = '';
    for (const [index, user] of topList.entries()) {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const mention = member 
        ? `<@${user.id}>` // Mention cliquable de l'utilisateur
        : "Utilisateur Inconnu";
      
      // Emojis de médaille
      const rankEmoji = index === 0 
        ? "🥇" 
        : index === 1 
        ? "🥈" 
        : index === 2 
        ? "🥉" 
        : "🔸";

      // Ajout en ligne
      rankText += `${rankEmoji} ${mention} - **${user.balance}** pièces\n`;
    }

    // Affichage compact dans une seule valeur
    embed.addFields({
      name: "Classement",
      value: rankText,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
