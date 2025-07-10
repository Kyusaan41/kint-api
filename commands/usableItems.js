const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');

const INVENTORY_FILE = 'inventaire.json';
const LOTTERY_FILE = 'lottery.json';
const POINTS_FILE = 'points.json';
const EFFECTS_FILE = 'effects.json';

const loadJSON = (path) => fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
const saveJSON = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('utilise')
    .setDescription("Utilise un item de ton inventaire"),

  async execute(interaction) {
    const userId = interaction.user.id;
    // Load data at the beginning of the command execution
    const inventoryData = loadJSON(INVENTORY_FILE);
    const lotteryData = loadJSON(LOTTERY_FILE);
    const pointsData = loadJSON(POINTS_FILE);
    const effectsData = loadJSON(EFFECTS_FILE);

    const userInventory = inventoryData[userId];
    if (!userInventory || Object.keys(userInventory).length === 0) {
      return interaction.reply({ content: "❌ Tu ne possèdes aucun item !", ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_item')
      .setPlaceholder('Choisis un item')
      .addOptions(
        Object.entries(userInventory).map(([name, data]) => ({
          label: name,
          value: name,
          description: `Quantité : ${data.quantity}`
        }))
      );

    await interaction.reply({
      content: "🎒 Choisis un item à utiliser :",
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === userId && i.customId === 'select_item',
      time: 30000,
      max: 1
    });

    collector.on('collect', async (i) => {
      // Defer the update immediately to prevent "Unknown interaction" error
      await i.deferUpdate(); 
      const itemName = i.values[0];

      // Re-load inventory data to ensure it's up-to-date within the collector
      const currentInventoryData = loadJSON(INVENTORY_FILE);
      const currentUserInventory = currentInventoryData[userId];

      // Defensive check to ensure the item still exists in the inventory
      if (!currentUserInventory || !currentUserInventory[itemName]) {
        return interaction.followUp({ content: "❌ Cet item n'est plus disponible dans ton inventaire ou a été utilisé.", ephemeral: true });
      }

      // 🎟️ Ticket Coin Million
      if (itemName === "Ticket Coin Million") {
        await interaction.followUp({ content: "🎟️ Envoie 5 numéros (1-50) séparés par des espaces ou tape `flash`", ephemeral: true });

        const msg = await interaction.channel.awaitMessages({
          filter: m => m.author.id === userId,
          max: 1,
          time: 30000
        });

        if (!msg.size) return interaction.followUp({ content: "⏰ Temps écoulé.", ephemeral: true });

        const input = msg.first().content.trim().toLowerCase();
        let numbers = [];

        if (input === 'flash') {
          while (numbers.length < 5) {
            const n = Math.floor(Math.random() * 50) + 1;
            if (!numbers.includes(n)) numbers.push(n);
          }
        } else {
          numbers = input.split(' ')
            .map(n => parseInt(n))
            .filter(n => !isNaN(n) && n >= 1 && n <= 50);
          if (numbers.length !== 5) {
            return interaction.followUp({ content: "❌ Tu dois entrer 5 numéros valides entre 1 et 50 !", ephemeral: true });
          }
        }

        if (!lotteryData[userId]) lotteryData[userId] = [];
        lotteryData[userId].push(numbers);
        saveJSON(LOTTERY_FILE, lotteryData);

        // Use currentUserInventory for modification and save currentInventoryData
        currentUserInventory[itemName].quantity--;
        if (currentUserInventory[itemName].quantity <= 0) delete currentUserInventory[itemName];
        saveJSON(INVENTORY_FILE, currentInventoryData);

        return interaction.followUp({
          content: `🎟️ Tu as joué : **${numbers.join(", ")}** — Bonne chance ! 🍀`,
          ephemeral: false
        });
      }

      // ⚔️ Épée du KINT
      if (itemName === "Épée du KINT") {
        const now = Date.now();
        const existing = effectsData[userId];
        if (existing && existing.type === "epee-du-kint" && now < new Date(existing.expiresAt).getTime()) {
          return interaction.followUp({ content: "⚔️ Tu as déjà une Épée du KINT active !", ephemeral: true });
        }

        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000);
        effectsData[userId] = {
          type: "epee-du-kint",
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString()
        };
        saveJSON(EFFECTS_FILE, effectsData);

        if (!pointsData[userId]) pointsData[userId] = { KIP: 0 };
        pointsData[userId].KIP += 10;
        saveJSON(POINTS_FILE, pointsData);

        // Use currentUserInventory for modification and save currentInventoryData
        currentUserInventory[itemName].quantity--;
        if (currentUserInventory[itemName].quantity <= 0) delete currentUserInventory[itemName];
        saveJSON(INVENTORY_FILE, currentInventoryData);

        return interaction.followUp({ content: "⚔️ Tu brandis l'Épée du KINT pour 2h ! (+10 KIP)", ephemeral: false });
      }

      // 🎭 My Champ
      if (itemName === "My Champ") {
        await interaction.followUp({ content: "👤 Mentionne un joueur + nom de champion dans un seul message", ephemeral: true });

        const msg = await interaction.channel.awaitMessages({
          filter: m => m.author.id === userId && m.mentions.users.size > 0,
          max: 1,
          time: 30000
        });
        if (!msg.size) return interaction.followUp({ content: "⏰ Temps écoulé.", ephemeral: true });

        const message = msg.first();
        const targetUser = message.mentions.users.first();
        const champName = message.content.replace(/<@!?\d+>/g, "").trim();

        if (!targetUser || targetUser.id === userId || !champName) {
          return interaction.followUp({ content: "❌ Mention ou nom invalide.", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mychamp_accept_${userId}`)
            .setLabel("Accepter ✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`mychamp_decline_${userId}`)
            .setLabel("Refuser ❌")
            .setStyle(ButtonStyle.Danger)
        );

        const confirmMsg = await interaction.followUp({
          content: `🎭 ${targetUser}, ${interaction.user} veut que tu joues **${champName}** ! Acceptes-tu ?`,
          components: [row],
          fetchReply: true
        });

        const buttonCollector = confirmMsg.createMessageComponentCollector({
          filter: btn => btn.user.id === targetUser.id,
          max: 1,
          time: 30000
        });

        buttonCollector.on('collect', async btn => {
          await btn.deferUpdate();
          const accepted = btn.customId.startsWith('mychamp_accept');

          if (accepted) {
            // Use currentUserInventory for modification and save currentInventoryData
            currentUserInventory[itemName].quantity--;
            if (currentUserInventory[itemName].quantity <= 0) delete currentUserInventory[itemName];
            saveJSON(INVENTORY_FILE, currentInventoryData);

            await interaction.followUp({ content: `✅ ${targetUser} accepte de jouer ${champName} !`, components: [] });
          } else {
            await interaction.followUp({ content: `❌ ${targetUser} refuse le défi.`, components: [] });
          }
        });

        return;
      }

      // 🔁 Swap Lane
      if (itemName === "Swap Lane") {
        await interaction.followUp({ content: "👤 Mentionne un joueur pour swap de lane :", ephemeral: true });

        const msg = await interaction.channel.awaitMessages({
          filter: m => m.author.id === userId && m.mentions.users.size > 0,
          max: 1,
          time: 30000
        });
        if (!msg.size) return interaction.followUp({ content: "⏰ Temps écoulé.", ephemeral: true });

        const targetUser = msg.first().mentions.users.first();
        if (!targetUser || targetUser.id === userId) {
          return interaction.followUp({ content: "❌ Mention invalide.", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`swaplane_accept_${userId}`)
            .setLabel("Accepter ✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`swaplane_decline_${userId}`)
            .setLabel("Refuser ❌")
            .setStyle(ButtonStyle.Danger)
        );

        const confirmMsg = await interaction.followUp({
          content: `🔁 ${targetUser}, acceptes-tu d’échanger ta lane avec ${interaction.user} ?`,
          components: [row],
          fetchReply: true
        });

        const buttonCollector = confirmMsg.createMessageComponentCollector({
          filter: btn => btn.user.id === targetUser.id,
          max: 1,
          time: 30000
        });

        buttonCollector.on('collect', async btn => {
          await btn.deferUpdate();
          const accepted = btn.customId.startsWith('swaplane_accept');

          if (accepted) {
            // Use currentUserInventory for modification and save currentInventoryData
            currentUserInventory[itemName].quantity--;
            if (currentUserInventory[itemName].quantity <= 0) delete currentUserInventory[itemName];
            saveJSON(INVENTORY_FILE, currentInventoryData);

            await interaction.followUp({ content: `✅ Swap lane accepté entre ${interaction.user} et ${targetUser} !`, components: [] });
            // Ici tu peux ajouter la logique réelle d'échange de lane dans ta base de données
          } else {
            await interaction.followUp({ content: `❌ ${targetUser} refuse le swap.`, components: [] });
          }
        });

        return;
      }

      // Default
      return interaction.followUp({ content: `✅ Tu as sélectionné **${itemName}**. La logique n'est pas encore implémentée.`, ephemeral: true });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.followUp({ content: "⏰ Tu n'as rien sélectionné, commande annulée.", ephemeral: true });
      }
    });
  }
};