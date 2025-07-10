const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('annonce')
    .setDescription("📣 Envoie une annonce dans un salon.")

    // 🔒 Obligatoires
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon où envoyer l\'annonce')
        .setRequired(true))

    // 🧩 Optionnels
    .addStringOption(option =>
      option.setName('titre')
        .setDescription('Titre de l\'embed')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('contenu')
        .setDescription('Texte libre affiché en bas de l\'embed (\\n = saut de ligne)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('image')
        .setDescription('Lien d\'une image à afficher')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('couleur')
        .setDescription('Couleur hexadécimale ou nom (ex: #ff0000 ou BLUE)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('Texte affiché dans le pied de l\'embed')
        .setRequired(false))

    // Champs personnalisés (jusqu’à 5)
    .addStringOption(option => option.setName('field1_titre').setDescription('Titre du champ #1').setRequired(false))
    .addStringOption(option => option.setName('field1_valeur').setDescription('Contenu du champ #1 (\\n = saut de ligne)').setRequired(false))
    .addStringOption(option => option.setName('field2_titre').setDescription('Titre du champ #2').setRequired(false))
    .addStringOption(option => option.setName('field2_valeur').setDescription('Contenu du champ #2 (\\n = saut de ligne)').setRequired(false))
    .addStringOption(option => option.setName('field3_titre').setDescription('Titre du champ #3').setRequired(false))
    .addStringOption(option => option.setName('field3_valeur').setDescription('Contenu du champ #3 (\\n = saut de ligne)').setRequired(false))
    .addStringOption(option => option.setName('field4_titre').setDescription('Titre du champ #4').setRequired(false))
    .addStringOption(option => option.setName('field4_valeur').setDescription('Contenu du champ #4 (\\n = saut de ligne)').setRequired(false))
    .addStringOption(option => option.setName('field5_titre').setDescription('Titre du champ #5').setRequired(false))
    .addStringOption(option => option.setName('field5_valeur').setDescription('Contenu du champ #5 (\\n = saut de ligne)').setRequired(false)),

  async execute(interaction) {
    // ✅ Rôles autorisés (à remplacer par les IDs de ton serveur)
    const allowedRoles = ['1114280839598067772', '1219292967651512420', '1243401324943642676'];
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
    if (!hasPermission) {
      return interaction.reply({
        content: "❌ Tu n'as pas l'autorisation d'utiliser cette commande.",
        ephemeral: true
      });
    }

    const titre = interaction.options.getString('titre');
    const contenu = interaction.options.getString('contenu');
    const image = interaction.options.getString('image');
    const couleur = interaction.options.getString('couleur');
    const footer = interaction.options.getString('footer');
    const salon = interaction.options.getChannel('salon');

    const embed = new EmbedBuilder()
      .setColor(couleur || 0x2f3136)
      .setTitle(titre || null)
      .setImage(image || null)
      .setFooter({
        text: footer || `Annonce par ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      });

    // Ajout des champs personnalisés
    for (let i = 1; i <= 5; i++) {
      const fieldTitre = interaction.options.getString(`field${i}_titre`);
      const fieldValeur = interaction.options.getString(`field${i}_valeur`);
      if (fieldTitre && fieldValeur) {
        embed.addFields({ name: fieldTitre, value: fieldValeur.replace(/\\n/g, '\n'), inline: false });
      }
    }

    // Ajout du contenu libre en bas de l'embed
    addContenuFinal(embed, contenu);

    await salon.send({ embeds: [embed] });
    await interaction.reply({ content: "✅ Annonce envoyée avec succès !", ephemeral: true });
  }
};

// 🔧 Ajoute un bloc texte tout en bas via un champ spécial visuel
function addContenuFinal(embed, texte) {
  if (!texte) return;
  embed.addFields(
    { name: '\u200B', value: '‎', inline: false }, // invisible mais prend moins de place
    { name: '⠀', value: texte.replace(/\\n/g, '\n'), inline: false }
  );
}
