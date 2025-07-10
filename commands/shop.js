const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Fichiers JSON
const SHOP_FILE = path.join(__dirname, '../shop.json');
const CURRENCY_FILE = path.join(__dirname, '../currency.json');
const INVENTORY_FILE = path.join(__dirname, '../inventaire.json');
const PURCHASE_LOCKS_FILE = path.join(__dirname, '../purchase_locks.json');
const LOG_CHANNEL_ID = "1350544010241900604";
const PURCHASE_LOG_FILE = path.join(__dirname, '../purchase_log.json');
const TITLES_FILE = path.join(__dirname, '../titles.json');
const TITLES_AVAILABLE_FILE = path.join(__dirname, '../titles_available.json');
const { checkAchievements } = require('./succes.js');

// Données temporaires en mémoire
const shopStates = new Map();

const readJSON = (filePath) => fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
const writeJSON = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

const ITEMS_PER_PAGE = 5;

// 🔄 Injection dynamique des titres du titles_available.json dans le shop
const mergeTitlesIntoShop = () => {
  const shop = readJSON(SHOP_FILE);
  const titlesAvailable = readJSON(TITLES_AVAILABLE_FILE);

  for (const [name, data] of Object.entries(titlesAvailable)) {
    if (data.price) {
      shop[name] = {
        key: name,
        name,
        price: data.price, 
        description: data.description || 'Titre spécial.',
        type: 'Personnalisation',       // Sert pour l'affichage dans le shop
        isTitle: true,                  // 🔥 Sert à détecter que c'est un titre lors de l'achat
        category: data.rarete || 'Commun'
      };
    }
  }

  return shop;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique')
    .setDescription("✨ Affiche les objets disponibles à l'achat."),

  async execute(interaction) {
    const categoryMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop_category_select')
        .setPlaceholder('Choisis une catégorie')
        .addOptions([
          { label: 'Kint', value: 'Kint', emoji: '⚔️' },
          { label: 'Utilitaire', value: 'Utilitaire', emoji: '🛠️' },
          { label: 'Personnalisation', value: 'Personnalisation', emoji: '🎨' },
        ])
    );

const currencyData = readJSON(CURRENCY_FILE);
const userId = interaction.user.id;
const userBalance = currencyData[userId]?.balance || 0;

const shopIntroEmbed = new EmbedBuilder()
  .setTitle("🌟 Bienvenue dans la Boutique !")
  .setDescription(
    "💼 Ici, tu peux dépenser tes pièces pour obtenir des objets utiles, des cosmétiques et bien plus encore.\n\n" +
    "🔽 Utilise le menu déroulant ci-dessous pour explorer les différentes catégories."
  )
  .addFields(
    {
      name: "⚔️ Kint",
      value: "Objets liés aux **mini-jeux League of Legends**. Améliore tes performances ou débloque des bonus spéciaux.",
      inline: false
    },
    {
      name: "🛠️ Utilitaire",
      value: "Objets **pratiques ou temporaires** : boosts, consommables, outils utiles pour ta progression.",
      inline: false
    },
    {
      name: "🎨 Personnalisation",
      value: "**Cosmétiques** : titres exclusifs, rôles colorés. Montre ton style sur le serveur.",
      inline: false
    },
    {
      name: "💰 Ton solde actuel",
      value: `**${userBalance.toLocaleString()}** pièces`,
      inline: true
    },
    {
      name: "📝 Comment ça marche ?",
      value:
        "• Sélectionne une **catégorie** pour voir les objets.\n" +
        "• Choisis un **objet** pour voir ses détails et le confirmer.\n" +
        "• ⏳ Certains objets ont des **restrictions** (ex : achat 1x/semaine).\n" +
        "• 🚫 Tu ne peux pas acheter un objet déjà en ta possession (titre, item unique...)."
    }
  )
  .setColor('#FFD700') // Or doré, classe et visible
  .setFooter({
    text: "💡 Astuce : gagne des pièces avec /journalier ou lors d'événements spéciaux."
  })
  .setTimestamp();



await interaction.reply({
  embeds: [shopIntroEmbed],
  components: [categoryMenu],
  flags: 64
});
  }
};

module.exports.handleMenuInteraction = async (interaction) => {
  const shopData = mergeTitlesIntoShop(); // utilise les titres injectés
  const currencyData = readJSON(CURRENCY_FILE);
  const inventoryData = readJSON(INVENTORY_FILE);
  const purchaseLocks = readJSON(PURCHASE_LOCKS_FILE);
  const userId = interaction.user.id;
  const userTag = interaction.user.tag;

  if (interaction.customId === 'shop_category_select') {
    const selectedCategory = interaction.values[0];
    const items = Object.entries(shopData)
      .filter(([_, data]) => data.type === selectedCategory && data.price !== null)
      .map(([key, data]) => ({ key, ...data }));

    if (items.length === 0) {
      return interaction.update({
        content: `❌ Aucun objet dans la catégorie **${selectedCategory}**.`,
        components: [],
        embeds: []
      });
    }

    shopStates.set(userId, {
      category: selectedCategory,
      page: 0,
      items
    });

    return updateShopEmbed(interaction, userId, false);
  }

  if (interaction.customId === 'shop_back_to_categories') {
    shopStates.delete(userId);
    const categoryMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop_category_select')
        .setPlaceholder('Choisis une catégorie')
        .addOptions([
          { label: 'Kint', value: 'Kint', emoji: '⚔️' },
          { label: 'Utilitaire', value: 'Utilitaire', emoji: '🛠️' },
          { label: 'Personnalisation', value: 'Personnalisation', emoji: '🎨' },
        ])
    );

    return interaction.update({
      content: '🛍️ Choisis une catégorie pour voir les objets disponibles :',
      components: [categoryMenu],
      flags: 64
    });
  }

    if (interaction.customId.startsWith('shop_confirm_')) {
      const itemName = interaction.customId.replace('shop_confirm_', '');

      const shopData = mergeTitlesIntoShop(); // 🔥 remet ça ici aussi !
      const shopItem = shopData[itemName];

      if (!shopItem || shopItem.price == null) {
        return interaction.reply({ content: "❌ Cet objet n'existe pas ou n'est pas disponible.", flags: 64 });
      }

    const userBalance = currencyData[userId]?.balance || 0;
    if (userBalance < shopItem.price) {
      return interaction.reply({ content: "❌ T'es trop pauvre.", flags: 64 });
    }

    const now = Date.now();
    if (itemName === "KShield") {
  // Vérifie si l'utilisateur possède déjà un KShield
  if (inventoryData[userId]?.[itemName]?.quantity > 0) {
    return interaction.reply({
      content: `🛡️ Tu possèdes déjà un **KShield** ! Tu ne peux pas en acheter plusieurs.`,
      flags: 64
    });
  }

  const lastPurchase = purchaseLocks[userId]?.[itemName] || 0;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (now - lastPurchase < oneWeek) {
    const remaining = oneWeek - (now - lastPurchase);
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return interaction.reply({
      content: `⏳ Tu peux acheter **KShield** une fois par semaine. Réessaie dans **${days}j ${hours}h ${minutes}min**.`,
      flags: 64
    });
  }

  if (!purchaseLocks[userId]) purchaseLocks[userId] = {};
  purchaseLocks[userId][itemName] = now;
  writeJSON(PURCHASE_LOCKS_FILE, purchaseLocks);
}

    // Retirer l'argent
    currencyData[userId].balance = userBalance - shopItem.price;
    writeJSON(CURRENCY_FILE, currencyData);

    // Gestion des titres
    if (shopItem.isTitle) {
      const titlesData = readJSON(TITLES_FILE);
      if (!titlesData[userId]) titlesData[userId] = [];

      const userTitles = titlesData[userId];

    // 🔄 Si l'utilisateur est encore en ancien format, on le convertit
    if (Array.isArray(userTitles)) {
      titlesData[userId] = {
        list: userTitles,
        equipped: userTitles[0] || null
      };
      writeJSON(TITLES_FILE, titlesData);
    }

    // Vérifie à nouveau après conversion
    if (titlesData[userId].list.includes(itemName)) {

        return interaction.reply({
          content: `❌ Tu possèdes déjà ce titre.`,
          flags: 64
        });
      }

      titlesData[userId].list.push(itemName);
      writeJSON(TITLES_FILE, titlesData);
    } else {
      // Gestion des objets classiques (inventaire)
      if (!inventoryData[userId]) inventoryData[userId] = {};
      if (!inventoryData[userId][itemName]) inventoryData[userId][itemName] = { quantity: 0 };
      inventoryData[userId][itemName].quantity += 1;
      writeJSON(INVENTORY_FILE, inventoryData);
    }

    // Log de l'achat pour les succès
    let purchaseLog = fs.existsSync(PURCHASE_LOG_FILE)
      ? JSON.parse(fs.readFileSync(PURCHASE_LOG_FILE, 'utf8'))
      : {};

    // Attribution de rôle Discord si applicable
if (shopItem.action === 'role' || shopItem.action === 'color') {
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    const roleId = shopItem.roleId;
    const role = guild.roles.cache.get(roleId);
    if (role) {
      // Pour les couleurs : retirer les autres couleurs d'abord
      if (shopItem.action === 'color') {
        const allColorRoles = Object.values(shopData)
          .filter(item => item.action === 'color')
          .map(item => item.roleId);
        await member.roles.remove(allColorRoles).catch(() => {});
      }
      await member.roles.add(role).catch(() => {});
    }
  }
}


    if (!purchaseLog[userId]) purchaseLog[userId] = [];

    purchaseLog[userId].push({
      item: itemName,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(PURCHASE_LOG_FILE, JSON.stringify(purchaseLog, null, 2));

    checkAchievements(userId, interaction.client);


    // Envoi d'un log dans le salon prévu
const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
if (logChannel && logChannel.isTextBased()) {
  const logEmbed = new EmbedBuilder()
    .setTitle("🛍️ Nouvel achat")
    .setDescription(`**${interaction.user.tag}** a acheté **${itemName}** pour 💰 **${shopItem.price}** pièces.`)
    .setColor('#FFD700')
    .setTimestamp()
    .setFooter({ text: `ID: ${userId}` });

  if (shopItem.action === 'color' || shopItem.action === 'role') {
    logEmbed.addFields({ name: "🎨 Type", value: shopItem.action === 'color' ? "Couleur" : "Rôle", inline: true });
  }

  logChannel.send({ embeds: [logEmbed] }).catch(() => {});
}
    return interaction.reply({
      content: `✅ Tu as acheté **${itemName}** pour **${shopItem.price}** pièces.`,
      flags: 64
    });

  }

  if (interaction.customId === 'shop_page_next' || interaction.customId === 'shop_page_prev') {
    const state = shopStates.get(userId);
    if (!state) return;

    const maxPages = Math.ceil(state.items.length / ITEMS_PER_PAGE);
    state.page += interaction.customId === 'shop_page_next' ? 1 : -1;
    if (state.page < 0) state.page = 0;
    if (state.page >= maxPages) state.page = maxPages - 1;

    shopStates.set(userId, state);
    return updateShopEmbed(interaction, userId, true);
  }

  if (interaction.customId === 'shop_select_item') {
    const itemName = interaction.values[0];
    const item = shopData[itemName];
    const confirmEmbed = new EmbedBuilder()
      .setTitle(`🛒 Confirmer l'achat`)
      .setDescription(`Veux-tu acheter **${itemName}** pour **💰 ${item.price}** ?\n_${item.description || 'Pas de description'}_`)
      .setColor('#00AE86');

    const confirmButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_confirm_${itemName}`)
        .setLabel('Confirmer l’achat')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmButton],
      flags: 64
    });
  }
};

async function updateShopEmbed(interaction, userId, isEdit) {
  const state = shopStates.get(userId);
  if (!state) return;

  const pageItems = state.items.slice(state.page * ITEMS_PER_PAGE, (state.page + 1) * ITEMS_PER_PAGE);
  const categories = {
    "Légendaire": { emoji: "⭐", items: [] },
    "Épique": { emoji: "🟣", items: [] },
    "Rare": { emoji: "🔵", items: [] },
    "Commun": { emoji: "🟢", items: [] }
  };

  for (const item of pageItems) {
    if (categories[item.category]) {
      categories[item.category].items.push(item);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🛍️ Boutique - ${state.category}`)
    .setDescription(`Page ${state.page + 1}/${Math.ceil(state.items.length / ITEMS_PER_PAGE)}`)
    .setColor(0x00AE86);

  for (const [rarity, data] of Object.entries(categories)) {
    if (data.items.length > 0) {
      embed.addFields({
        name: `${data.emoji} **${rarity}**`,
        value: data.items.map(i => `**${i.name}** - 💰 ${i.price}\n_${i.description || 'Pas de description'}_`).join('\n'),
        inline: false
      });
    }
  }

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_page_prev').setLabel('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop_page_next').setLabel('▶').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop_back_to_categories').setLabel('Retour aux catégories').setStyle(ButtonStyle.Danger)
  );

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('shop_select_item')
      .setPlaceholder('Sélectionne un objet à acheter')
      .addOptions(pageItems.map(i => ({
        label: `${i.name} - ${i.price}💰`,
        value: i.key
      })))
  );

  const payload = {
    embeds: [embed],
    components: [buttons, selectMenu]
  };

  await interaction.update(payload);
}
