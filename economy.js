const client = require('./index.js');

console.log('✅ economy.js a bien été chargé.');

const fs = require('fs');
const path = require('path');
const CURRENCY_FILE = path.join(__dirname, './currency.json');

// Délai anti-spam en millisecondes (ex: 60 secondes)
const ANTI_SPAM_DELAY = 60 * 1000;

// Stockage des timestamps des derniers messages pour chaque utilisateur
const lastMessageTime = {};

// Chargement des données de monnaie
const loadCurrencyData = () => {
  console.log('🔄 Chargement des données de currency.json');
  if (!fs.existsSync(CURRENCY_FILE)) {
    console.log('⚠️ currency.json n\'existe pas, création du fichier...');
    fs.writeFileSync(CURRENCY_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(CURRENCY_FILE, 'utf8'));
};

// Sauvegarde des données de monnaie
const saveCurrencyData = (data) => {
  console.log('💾 Sauvegarde des données dans currency.json');
  fs.writeFileSync(CURRENCY_FILE, JSON.stringify(data, null, 2));
};

// Ajout de pièces à un utilisateur
const addCoins = (userId, amount) => {
  console.log(`💰 Tentative d'ajout de ${amount} pièces pour l'utilisateur ${userId}`);
  const currencyData = loadCurrencyData();
  currencyData[userId] = currencyData[userId] || { balance: 0 };
  currencyData[userId].balance += amount;
  console.log(`✅ ${userId} a maintenant un solde de ${currencyData[userId].balance} pièces.`);
  saveCurrencyData(currencyData);
};

// Vérification et attribution des pièces à chaque message
client.on('messageCreate', (message) => {
  console.log(`📨 Message reçu de ${message.author.username}: ${message.content}`);

  // On ignore les messages du bot et les commandes
  if (message.author.bot) return;
  if (message.content.startsWith('/')) return;

  const userId = message.author.id;
  const now = Date.now();

  // Vérification anti-spam : 60 secondes entre chaque gain
  if (lastMessageTime[userId] && (now - lastMessageTime[userId]) < ANTI_SPAM_DELAY) {
    console.log('🚫 Anti-spam activé, aucun gain.');
    return;
  }

  // Mise à jour du timestamp du dernier message
  lastMessageTime[userId] = now;

  // Montant aléatoire entre 5 et 15 à chaque message
  const coinsEarned = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
  console.log(`🎲 Montant aléatoire généré: ${coinsEarned}`);

  addCoins(userId, coinsEarned);

});
