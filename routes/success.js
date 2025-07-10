const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// --- Chemins des fichiers de données ---
const SUCCESS_FILE = path.join(__dirname, '../success.json');
// On ajoute le chemin vers votre fichier de configuration des succès
const DATASUCCES_FILE = path.join(__dirname, '../datasucces.json');


// --- NOUVELLE ROUTE ---
// [GET] /api/success/all - Récupère la configuration de tous les succès
router.get('/all', (req, res) => {
    try {
        if (fs.existsSync(DATASUCCES_FILE)) {
            const configData = fs.readFileSync(DATASUCCES_FILE, 'utf8');
            res.json(JSON.parse(configData));
        } else {
            // Si le fichier n'existe pas, on renvoie un objet vide
            res.json({});
        }
    } catch (error) {
        console.error('Erreur lors de la lecture de datasucces.json:', error);
        res.status(500).json({ error: 'Impossible de lire le fichier de configuration des succès.' });
    }
});
// --- FIN DE LA NOUVELLE ROUTE ---


// 🔹 GET succès d'un utilisateur
router.get('/:userId', (req, res) => {
    const userId = req.params.userId;

    if (!fs.existsSync(SUCCESS_FILE)) {
        fs.writeFileSync(SUCCESS_FILE, JSON.stringify({}));
    }

    const successData = JSON.parse(fs.readFileSync(SUCCESS_FILE, 'utf8'));
    const userSuccess = successData[userId] || [];

    res.json({
        userId,
        succes: userSuccess
    });
});

// 🔹 POST pour mettre à jour les succès d’un utilisateur
router.post('/:userId', (req, res) => {
    const userId = req.params.userId;
    const { succes } = req.body;

    if (!Array.isArray(succes)) {
        return res.status(400).json({ error: "Le champ 'succes' doit être un tableau." });
    }

    let successData = {};
    if (fs.existsSync(SUCCESS_FILE)) {
        successData = JSON.parse(fs.readFileSync(SUCCESS_FILE, 'utf8'));
    }

    successData[userId] = succes;
    fs.writeFileSync(SUCCESS_FILE, JSON.stringify(successData, null, 2));

    console.log(`Succès mis à jour pour ${userId}:`, succes);
    res.json({ success: true, userId, succes });
});

module.exports = router;