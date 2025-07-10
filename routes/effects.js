const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const EFFECTS_FILE_PATH = path.resolve(__dirname, '../effects.json');

// Fonction pour lire le fichier JSON des effets
async function getEffectsData() {
    try {
        const data = await fs.readFile(EFFECTS_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return {}; // Si le fichier n'existe pas, retourne un objet vide
        }
        throw err;
    }
}

// --- Route GET /api/effects/:userId ---
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const effectsData = await getEffectsData();
        const userEffect = effectsData[userId];

        // Si l'utilisateur n'a pas d'effet ou si l'effet a expiré
        if (!userEffect || new Date(userEffect.expiresAt).getTime() <= Date.now()) {
            // Vous pourriez aussi supprimer l'effet expiré du fichier ici si vous le souhaitez
            return res.status(404).json({ message: 'Aucun effet actif trouvé.' });
        }

        // Renvoie l'effet actif
        res.status(200).json({ effect: userEffect });

    } catch (error) {
        console.error(`Erreur sur la route /effects/${userId}:`, error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

module.exports = router;