const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const BIRTHDAY_FILE = 'birthdays.json';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription("📅 Affiche la liste des anniversaires enregistrés."),

  async execute(interaction) {
    if (!fs.existsSync(BIRTHDAY_FILE)) {
      return interaction.reply({ content: "❌ Aucun anniversaire n'a encore été enregistré.", ephemeral: true });
    }

    const data = JSON.parse(fs.readFileSync(BIRTHDAY_FILE, 'utf8'));

    if (Object.keys(data).length === 0) {
      return interaction.reply({ content: "📭 Aucun anniversaire enregistré pour le moment.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎉 Liste des anniversaires enregistrés")
      .setColor(0xFFC0CB)
      .setDescription(
        Object.entries(data)
          .map(([userId, date]) => `👤 <@${userId}> — 🎂 ${date}`)
          .join('\n')
      )
      .setFooter({ text: `📆 Total: ${Object.keys(data).length} anniversaire(s) enregistrés.` });

    return interaction.reply({ embeds: [embed] });
  }
};
