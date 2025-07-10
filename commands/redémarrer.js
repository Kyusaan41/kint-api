const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redemarrer')
    .setDescription('🔐 Redémarre le bot (admin uniquement)'),
    
  async execute(interaction) {
    const owners = ['1206053705149841428', '185180198075891712']; // Ajoute ici les ID autorisés

    if (!owners.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Tu n\'as pas la permission.', ephemeral: true });
    }

    await interaction.reply({ content: '🔄 Le bot redémarre...', ephemeral: true });

    setTimeout(() => {
      process.exit(1); // Katabump redémarrera le bot
    }, 1000);
  },
};
