const fs = require('fs');
const path = require('path');

// Chemins vers vos fichiers de données
const INVENTORY_FILE_PATH = path.resolve(__dirname, './inventaire.json');
const EFFECTS_FILE_PATH = path.resolve(__dirname, './effects.json');

function loadData(filePath, fileName) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        if (data.trim() === '') return {};
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Fonctions spécifiques
const loadInventaire = () => loadData(INVENTORY_FILE_PATH, 'inventaire.json');
const saveInventaire = (data) => saveData(INVENTORY_FILE_PATH, data);
const loadEffects = () => loadData(EFFECTS_FILE_PATH, 'effects.json');
const saveEffects = (data) => saveData(EFFECTS_FILE_PATH, data);

function addPurchase(userId, itemId) {
    const inventaire = loadInventaire();
    if (!inventaire[userId]) inventaire[userId] = {};
    if (!inventaire[userId][itemId]) inventaire[userId][itemId] = { quantity: 0 };
    inventaire[userId][itemId].quantity += 1;
    saveInventaire(inventaire);
}

module.exports = {
    loadInventaire,
    addPurchase,
    saveInventaire,
    loadEffects,
    saveEffects
};