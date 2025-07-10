const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription("ℹ️ Gestion du bot (Kyû).")
    .setDefaultMemberPermissions(0), // Seul toi y as accès avec le contrôle ci-dessous

  async execute(interaction) {
    const allowedUserId = '1206053705149841428'; // Ton ID

    if (interaction.user.id !== allowedUserId) {
      return interaction.reply({ content: "Tu n'as pas la permission d'exécuter cette commande.", ephemeral: true });
    }

    const guilds = interaction.client.guilds.cache.map(guild => ({
      name: guild.name,
      id: guild.id,
      memberCount: guild.memberCount
    }));

    if (guilds.length === 0) {
      return interaction.reply({ content: "Le bot n'est présent dans aucun serveur.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Liste des serveurs")
      .setDescription(guilds.map(g => `• **${g.name}** (${g.memberCount} membres) \`[${g.id}]\``).join("\n"))
      .setColor("DarkRed");

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_server_leave")
      .setPlaceholder("Sélectionne un serveur à quitter")
      .addOptions(guilds.map(g => ({
        label: g.name.slice(0, 100),
        description: `ID: ${g.id}`,
        value: g.id
      })).slice(0, 25)); // Max 25 options

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
