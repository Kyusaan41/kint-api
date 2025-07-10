const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TITLES_FILE = path.join(__dirname, '../titles.json');
const TITLES_AVAILABLE_FILE = path.join(__dirname, '../titles_available.json');

const readJSON = (filePath) =>
  fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
const writeJSON = (filePath, data) =>
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('titre')
    .setDescription('🌸 Affiche tes titres et te permet d’en équiper un'),

  async execute(interaction) {
    const userId = interaction.user.id;
const titlesData = readJSON(TITLES_FILE);
const titlesAvailable = readJSON(TITLES_AVAILABLE_FILE);

let userEntry = titlesData[userId];

// 🔄 Convertit l'ancien format (tableau simple) si besoin
if (Array.isArray(userEntry)) {
  userEntry = {
    list: userEntry,
    equipped: userEntry[0] || null
  };
  titlesData[userId] = userEntry;
  writeJSON(TITLES_FILE, titlesData);
}

// 🛡️ Vérifie après conversion
if (!userEntry || !Array.isArray(userEntry.list) || userEntry.list.length === 0) {
  return interaction.reply({
    content: `❌ Tu ne possèdes encore aucun titre.`,
    ephemeral: true
  });
}

const userTitles = userEntry.list;
const equipped = userEntry.equipped || "Aucun";


    const getEmojiByRarity = (rarete) => {
      switch ((rarete || "").toLowerCase()) {
        case "légendaire": return "⭐";
        case "épique": return "🟣";
        case "rare": return "🔵";
        case "commun": return "🟢";
        default: return "🔘";
      }
    };

    const embed = new EmbedBuilder()
      .setTitle(`🏷️ Tes Titres`)
      .setDescription(userTitles.map(title => {
        const data = titlesAvailable[title] || {};
        const emoji = getEmojiByRarity(data.rarete);
        return `${emoji} ${title}`;
      }).join('\n'))
      .addFields({ name: '😎 Titre actuellement équipé', value: equipped })
      .setColor('#00AE86')
      .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('equip_title_select')
      .setPlaceholder('Sélectionne un titre à équiper')
      .addOptions(
        userTitles.map(title => ({
          label: title,
          value: title,
          description: titlesAvailable[title]?.description || "Titre personnalisé"
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  },

  // gestion du menu déroulant (à placer dans l'interaction handler global)
async handleSelect(interaction) {
  try {
    const selected = interaction.values[0];
    const userId = interaction.user.id;

    const titlesData = readJSON(TITLES_FILE);
    if (!titlesData[userId]) titlesData[userId] = { list: [], equipped: "" };

    titlesData[userId].equipped = selected;
    writeJSON(TITLES_FILE, titlesData);

    await interaction.reply({
      content: `✅ Tu as équipé le titre : **${selected}**`,
      ephemeral: true
    });
  } catch (error) {
    console.error("Erreur lors de la sélection de titre :", error);
    await interaction.reply({
      content: `❌ Une erreur est survenue lors de l'équipement du titre.`,
      ephemeral: true
    });
  }
 }
}
