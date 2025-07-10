const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// Route POST pour redémarrer le bot via PM2
router.post('/', (req, res) => {
    // Assurez-vous que le nom 'kint-bot' correspond bien au nom de votre processus PM2
    const pm2ProcessName = 'kint';

    console.log(`[ADMIN] Demande de redémarrage pour le processus PM2 : ${pm2ProcessName}`);
    
    exec(`pm2 restart ${pm2ProcessName}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erreur lors du redémarrage PM2: ${error.message}`);
            return res.status(500).json({ success: false, error: "Erreur lors du redémarrage du bot." });
        }
        if (stderr) {
            console.error(`Erreur PM2 (stderr): ${stderr}`);
            // On continue même en cas de stderr car pm2 peut quand même réussir
        }
        
        console.log(`[ADMIN] Redémarrage réussi. stdout: ${stdout}`);
        res.json({ success: true, message: `Le bot '${pm2ProcessName}' a été redémarré.` });
    });
});

module.exports = router;