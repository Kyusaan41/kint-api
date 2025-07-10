const express = require('express');
const router = express.Router();

// Chemin corrigé pour remonter du dossier 'routes' à la racine
const {
    loadInventaire,
    addPurchase,
    saveInventaire,
    loadEffects,
    saveEffects
} = require('../inventaire');

// Vos routes GET et POST existantes restent ici...
router.get('/:userId', (req, res) => {
    try {
        const inventaire = loadInventaire();
        res.json(inventaire[req.params.userId] || {});
    } catch (e) { res.status(500).json({e})}
});

router.post('/:userId', (req, res) => {
    try {
        addPurchase(req.params.userId, req.body.itemId);
        res.json({ success: true });
    } catch (e) { res.status(500).json({e})}
});


// --- ROUTE MANQUANTE À AJOUTER ---
router.post('/use', (req, res) => {
    const { userId, itemId } = req.body;

    if (!userId || !itemId) {
        return res.status(400).json({ message: "Données manquantes." });
    }

    try {
        const inventaire = loadInventaire();
        const effects = loadEffects();
        const userInventory = inventaire[userId];

        if (!userInventory || !userInventory[itemId] || userInventory[itemId].quantity < 1) {
            return res.status(400).json({ message: "Vous ne possédez pas cet objet." });
        }

        if (itemId === 'kint_sword') {
            const currentEffect = effects[userId];
            if (currentEffect && new Date(currentEffect.expiresAt).getTime() > Date.now()) {
                return res.status(400).json({ message: 'Un effet de l\'épée est déjà actif.' });
            }

            userInventory[itemId].quantity -= 1;
            if (userInventory[itemId].quantity === 0) delete userInventory[itemId];

            effects[userId] = {
                type: 'epee-du-kint',
                expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
            };

            saveInventaire(inventaire);
            saveEffects(effects);

            return res.status(200).json({ message: 'Épée du KINT activée !' });
        }

        return res.status(400).json({ message: "Cet objet n'est pas utilisable." });

    } catch (error) {
        console.error(`ERREUR DANS /api/inventory/use:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur du bot.' });
    }
});

module.exports = router;