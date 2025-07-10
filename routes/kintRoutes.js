// Dans un fichier de routes de votre bot (ex: kintRoutes.js)

// POST /api/kint/use-shield
router.post('/use-shield', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID manquant.' });
    }

    try {
        const inventaire = await readData(INVENTAIRE_FILE); // Assurez-vous d'avoir accès à cette fonction
        const userInventory = inventaire[userId];

        // Vérifier si l'utilisateur possède un KShield
        if (userInventory && userInventory.KShield && userInventory.KShield.quantity > 0) {
            // Décrémenter la quantité
            userInventory.KShield.quantity -= 1;

            // Si la quantité tombe à 0, supprimer l'objet
            if (userInventory.KShield.quantity === 0) {
                delete userInventory.KShield;
            }

            await writeData(INVENTAIRE_FILE, inventaire); // Sauvegarder l'inventaire
            res.json({ success: true, message: 'KShield utilisé avec succès !' });
        } else {
            res.status(400).json({ error: 'Aucun KShield disponible dans l\'inventaire.' });
        }
    } catch (error) {
        console.error("Erreur lors de l'utilisation du KShield:", error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});