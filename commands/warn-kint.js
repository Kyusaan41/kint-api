const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const pointsPath = './points.json';
const warnsPath = './kintwarns.json';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn-kint')
    .setDescription('Préviens les joueurs qu’ils ont un délai pour payer leurs KINTS, sinon -100 points.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Annule la sanction KINT pour un joueur qui a payé.')
        .addUserOption(option => option.setName('joueur').setDescription('Joueur ayant payé').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('warn')
        .setDescription('Préviens un ou plusieurs joueurs d’une sanction pour non-paiement des KINTS.')
        .addUserOption(option => option.setName('joueur1').setDescription('Premier joueur').setRequired(true))
        .addUserOption(option => option.setName('joueur2').setDescription('Deuxième joueur').setRequired(false))
        .addUserOption(option => option.setName('joueur3').setDescription('Troisième joueur').setRequired(false))
        .addUserOption(option => option.setName('joueur4').setDescription('Quatrième joueur').setRequired(false))
        .addIntegerOption(option =>
          option.setName('delai')
            .setDescription('Délai avant sanction en minutes (défaut : 60)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const allowedUsers = ['185180198075891712', '1206053705149841428'];
    const ownerId = '1206053705149841428';
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: "🚫 Tu n'as pas la permission d’utiliser cette commande.", ephemeral: true });
    }

    await interaction.deferReply();
    const channelId = '1340723882256236626'; // Salon des sanctions

    if (interaction.options.getSubcommand() === 'cancel') {
      const user = interaction.options.getUser('joueur');
      const warns = fs.existsSync(warnsPath) ? JSON.parse(fs.readFileSync(warnsPath)) : [];

      if (!Array.isArray(warns)) {
        return interaction.followUp({ content: 'Erreur interne, les données de sanction sont corrompues.', ephemeral: true });
      }

      const warnEntries = warns.filter(warn => warn.userId === user.id && !warn.done && !warn.paid);

      if (warnEntries.length === 0) {
        return interaction.followUp({ content: `Il n'y a pas de sanction en cours pour ${user.tag}.`, ephemeral: true });
      }

      const commonMessageId = warnEntries[0].messageId;
      const affectedUsers = warns.filter(warn => warn.messageId === commonMessageId && !warn.done && !warn.paid);

      affectedUsers.forEach(warn => {
        warn.paid = true;
        warn.done = true;
      });

      fs.writeFileSync(warnsPath, JSON.stringify(warns, null, 2));

      try {
        const targetChannel = await interaction.client.channels.fetch(channelId);
        const warningMessage = await targetChannel.messages.fetch(commonMessageId);

        await warningMessage.edit(`✅ Tous les joueurs ont payé leur KINT !\nMerci de respecter les règles et à bientôt pour un prochain défi 😉`);
      } catch (error) {
        if (error.code === 10008) {
          console.error(`Le message d'avertissement a été supprimé.`);
          return interaction.followUp({
            content: `Le message d'avertissement a été supprimé avant que nous puissions le modifier.`,
            ephemeral: true
          });
        }
        console.error("Erreur lors de l'édition du message d'avertissement :", error);
        return interaction.followUp({ content: 'Une erreur s\'est produite lors de la modification du message.', ephemeral: true });
      }

      return interaction.followUp({ content: `✅ La sanction a été annulée pour tous les joueurs du message original.`, ephemeral: true });

    } else if (interaction.options.getSubcommand() === 'warn') {
      const users = [];
      for (let i = 1; i <= 4; i++) {
        const user = interaction.options.getUser(`joueur${i}`);
        if (user) {
          if (user.id === ownerId) {
            return interaction.followUp({ content: `❌ Tu ne peux pas mentionner le propriétaire du bot.`, ephemeral: true });
          }
          users.push(user);
        }
      }

      const delaiMinutes = interaction.options.getInteger('delai') || 60;
      const deadlineTimestamp = Math.floor((Date.now() + delaiMinutes * 60000) / 1000); // UNIX timestamp
      const targetChannel = await interaction.client.channels.fetch(channelId);
      const mentions = users.map(user => `<@${user.id}>`).join(' ');

      const message = await targetChannel.send({
        content: `⚠️ **Attention !** ${mentions}\n\n` +
          `Vous n'avez pas payé votre **KINT** !\n` +
          `Si ce n’est pas fait dans ${delaiMinutes} minute(s) : **-100 points** chacun !\n\n` +
          `Tous les joueurs mentionnés ne sont pas obligés de payer, à vous de désigner le fautif, dans le temps imparti 🐵\n` +
          `⏳ Temps restant : <t:${deadlineTimestamp}:R>`
      });

      let warns = fs.existsSync(warnsPath) ? JSON.parse(fs.readFileSync(warnsPath)) : [];
      if (!Array.isArray(warns)) warns = [];

      users.forEach(user => {
        warns.push({
          userId: user.id,
          deadline: deadlineTimestamp,
          paid: false,
          done: false,
          messageId: message.id
        });
      });

      fs.writeFileSync(warnsPath, JSON.stringify(warns, null, 2));

      return interaction.followUp({ content: '✅ Avertissement envoyé à tous les joueurs concernés.', ephemeral: true });
    }
  }
};
