const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

const ticketCategoryId = '1384914029386141708'; // Remplace par l'ID de ta catégorie "Tickets"

// Map pour stocker les raisons des tickets (tu peux aussi la déplacer dans un fichier à part si besoin)
const ticketReasons = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('🎟️ Créer un ticket de support')
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Explique ta demande')
        .setRequired(true)
    ),

  async execute(interaction) {
    const raison = interaction.options.getString('raison');
    const user = interaction.user;
    const guild = interaction.guild;

    // Vérifier si l'utilisateur a déjà un ticket ouvert dans la catégorie
    const existingTicket = guild.channels.cache.find(c =>
      c.name.startsWith(`ticket-${user.username.toLowerCase()}`) && c.parentId === ticketCategoryId
    );

    if (existingTicket) {
      return interaction.reply({
        content: `🚫 Tu as déjà un ticket ouvert ici : <#${existingTicket.id}>`,
        ephemeral: true,
      });
    }

    const supportRoleIds = [
      '1383093816600563842', // Rôle 1
      '1219292967651512420', // Rôle 2
      '1114280839598067772',
    ];

    const ticketId = uuidv4().slice(0, 4);
    const channelName = `ticket-${user.username.toLowerCase()}-${ticketId}`;

    // Construction des permissions
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      ...supportRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
      }))
    ];

    // Création du salon
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategoryId,
      permissionOverwrites: overwrites,
    });

    // Stocker la raison du ticket dans la Map
    ticketReasons.set(channel.id, raison);

    // Embed d’accueil
    const embed = new EmbedBuilder()
      .setTitle('📩 Nouveau ticket de support')
      .setDescription(`**Utilisateur :** <@${user.id}>\n**Raison :** ${raison}`)
      .setColor('Blurple')
      .setTimestamp();

    // Boutons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_accept')
        .setLabel('Accepter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket_refuse')
        .setLabel('Refuser')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Fermer')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary)
    );

    // Mention des rôles support
    const mentionSupport = supportRoleIds.map(id => `<@&${id}>`).join(' ');

    await channel.send({
      content: `${mentionSupport}`,
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({
      content: `🎟️ Ton ticket a été créé ici : <#${channel.id}>`,
      ephemeral: true
    });
  },
  
  // Exporte la Map pour pouvoir l'utiliser ailleurs (optionnel)
  ticketReasons
};
