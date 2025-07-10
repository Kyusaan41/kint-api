const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const pointsPath = path.join(__dirname, 'points.json');
const backupPath = path.join(__dirname, 'kip_backup_mois.json');
const BADGESSEASON_FILE = path.join(__dirname, 'badgesseason.json');
const lastResetPath = path.join(__dirname, 'last_reset_time.txt');
const resetDatePath = path.join(__dirname, 'reset_date.json');
const statsKintPath = path.join(__dirname, 'Statskint.json');


function validateBadgesSeasonFile() {
    console.log("🔍 Vérification de badgesseason.json au démarrage...");

    if (!fs.existsSync(BADGESSEASON_FILE)) {
        console.warn("⚠️ Fichier badgesseason.json introuvable. Création d’un fichier vide.");
        fs.writeFileSync(BADGESSEASON_FILE, JSON.stringify({}, null, 2), 'utf8');
        return;
    }

    try {
        const rawData = fs.readFileSync(BADGESSEASON_FILE, 'utf8');
        const badgesData = JSON.parse(rawData);
        let modified = false;

        Object.keys(badgesData).forEach(userId => {
            const badges = badgesData[userId];

            if (!Array.isArray(badges) || badges.length === 0) {
                console.warn(`⚠️ ${userId} a un badge invalide. Réinitialisation...`);
                badgesData[userId] = [];
                modified = true;
            } else if (badges.length > 1) {
                const lastBadge = badges[badges.length - 1];
                console.warn(`🧼 ${userId} avait plusieurs badges. Gardé uniquement : ${lastBadge}`);
                badgesData[userId] = [lastBadge];
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(BADGESSEASON_FILE, JSON.stringify(badgesData, null, 2), 'utf8');
            console.log("✅ badgesseason.json corrigé.");
        } else {
            console.log("✅ badgesseason.json est déjà propre.");
        }

    } catch (err) {
        console.error("❌ Erreur lors de la vérification de badgesseason.json :", err);
        fs.writeFileSync(BADGESSEASON_FILE, JSON.stringify({}, null, 2), 'utf8');
    }
}

// Vérification et correction du fichier badgesseason.json
const fixJSONFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            console.warn(`⚠️ Fichier ${filePath} vide ou inexistant. Réinitialisation...`);
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
        } else {
            let content = fs.readFileSync(filePath, { encoding: 'utf8' }).trim();
            content = content.replace(/^﻿/, ''); // Supprime BOM UTF-8 si présent
            JSON.parse(content); // Vérifie si le JSON est valide
        }
    } catch (err) {
        console.error(`⚠️ Erreur avec ${filePath}, réinitialisation...`, err);
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
    }
};
fixJSONFile(BADGESSEASON_FILE);
validateBadgesSeasonFile(); 

function resetKIP() {
    console.log("🔄 Reset des points KIP en cours...");

    assignBadgesBeforeReset(); // Donne les badges AVANT de supprimer les points

    let pointsData = {};
    if (fs.existsSync(pointsPath)) {
        try {
            pointsData = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));
        } catch (err) {
            console.error("⚠️ Erreur lors de la lecture de points.json :", err);
            return;
        }
    } else {
        console.error("❌ Fichier points.json introuvable !");
        return;
    }

    // Sauvegarde dans kip_backup_mois.json
    try {
        fs.writeFileSync(backupPath, JSON.stringify(pointsData, null, 4));
        console.log("📂 Sauvegarde effectuée dans kip_backup_mois.json");
    } catch (err) {
        console.error("⚠️ Erreur lors de la sauvegarde :", err);
        return;
    }

    // Réinitialise Statskint.json
    try {
        fs.writeFileSync(statsKintPath, JSON.stringify({}, null, 2), 'utf8');
        console.log("🗑️ Statskint.json réinitialisé avec succès.");
    } catch (err) {
        console.error("⚠️ Erreur lors de la réinitialisation de Statskint.json :", err);
    }

    // Vide complètement points.json
    pointsData = {};

    try {
        fs.writeFileSync(pointsPath, JSON.stringify(pointsData, null, 4));
        console.log("✅ Reset des points KIP terminé (points.json vidé) !");
    } catch (err) {
        console.error("⚠️ Erreur lors de la réinitialisation :", err);
    }
}

function assignBadgesBeforeReset() {
    console.log("🔄 Exécution de assignBadgesBeforeReset()...");

    if (!fs.existsSync(pointsPath)) {
        console.log("❌ Fichier points.json introuvable.");
        return;
    }

    let pointsData;
    try {
        pointsData = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));
    } catch (err) {
        console.error("⚠️ Erreur lors de la lecture de points.json :", err);
        return;
    }

    let badgesData = {};
    if (fs.existsSync(BADGESSEASON_FILE)) {
        try {
            badgesData = JSON.parse(fs.readFileSync(BADGESSEASON_FILE, 'utf8'));

            // Vérifie et garde uniquement le dernier badge si plusieurs
            Object.keys(badgesData).forEach(userId => {
                if (Array.isArray(badgesData[userId]) && badgesData[userId].length > 1) {
                    const lastBadge = badgesData[userId][badgesData[userId].length - 1];
                    badgesData[userId] = [lastBadge];
                    console.warn(`⚠️ Utilisateur ${userId} avait plusieurs badges, seul le dernier a été conservé : ${lastBadge}`);
                }
            });
        } catch (err) {
            console.error("⚠️ Erreur lors de la lecture de badgesseason.json, réinitialisation...");
            badgesData = {};
        }
    }

    const tiers = [
        { max: 700, badge: "<:iron:1343990244214571010>" },
        { max: 1400, badge: "<:bronze:1343990190443880448>" },
        { max: 2100, badge: "<:silver:1343990178010890240>" },
        { max: 2800, badge: "<:gold:1343990168343347200>" },
        { max: 3500, badge: "<:platinium:1343990142624600127>" },
        { max: 4200, badge: "<:diamond:1343990185511092254>" },
        { max: 5500, badge: "<:master:1343990151780503635>" },
        { max: 8000, badge: "<:grandmaster:1343990159053553664>" },
        { max: Infinity, badge: "<:challenger:1343990166896902205>" }
    ];

    Object.keys(pointsData).forEach(userId => {
        const pointsEntry = pointsData[userId];
        const pointsValue = typeof pointsEntry === 'number' ? pointsEntry : (pointsEntry?.points || 0);

        let badge = "<:unranked:1343990203745288202>";
        for (const tier of tiers) {
            if (pointsValue < tier.max) {
                badge = tier.badge;
                break;
            }
        }

        badgesData[userId] = [badge]; // Remplace toujours par un tableau avec le dernier badge
        console.log(`✅ Badge défini pour ${userId} : ${badge}`);
    });

    try {
        fs.writeFileSync(BADGESSEASON_FILE, JSON.stringify(badgesData, null, 2), 'utf8');
        console.log("✅ Fichier badgesseason.json mis à jour avec les nouveaux badges !");
    } catch (error) {
        console.error("❌ Erreur lors de l'écriture dans badgesseason.json :", error);
    }

    setTimeout(() => {
        try {
            const verifyBadgesData = JSON.parse(fs.readFileSync(BADGESSEASON_FILE, 'utf8'));
            console.log("📝 Vérification finale après écriture :", verifyBadgesData);
        } catch (err) {
            console.error("❌ Erreur lors de la vérification après écriture :", err);
        }
    }, 500);
}


function getTimeUntilNextReset() {
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + (3 - (now.getMonth() % 3)), 1, 0, 0, 0);
    const diff = nextReset - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${days} jours, ${hours} heures, ${minutes} minutes`;
}

cron.schedule('*/1 * * * *', () => {
    const now = Date.now();

    // Charger la date de reset depuis reset_date.json
    let resetData;
    if (fs.existsSync(resetDatePath)) {
        try {
            resetData = JSON.parse(fs.readFileSync(resetDatePath, 'utf8'));
            if (!resetData.nextReset) {
                console.error("⚠️ reset_date.json ne contient pas de clé nextReset");
                return;
            }
        } catch (err) {
            console.error("⚠️ Erreur lors de la lecture de reset_date.json :", err);
            return;
        }
    } else {
        console.error("⚠️ reset_date.json introuvable !");
        return;
    }

    const nextResetDate = resetData.nextReset;

    // Lecture de la dernière date de reset
    let lastReset = 0;
    if (fs.existsSync(lastResetPath)) {
        try {
            lastReset = parseInt(fs.readFileSync(lastResetPath, 'utf8'), 10) || 0;
        } catch (err) {
            console.error("⚠️ Erreur lecture last_reset_time.txt :", err);
        }
    }

    if (now >= nextResetDate && lastReset < nextResetDate) {
        console.log("🚨 Date de reset atteinte, lancement du reset KIP...");
        resetKIP();

        try {
            // Enregistrer la date du reset dans last_reset_time.txt
            fs.writeFileSync(lastResetPath, String(nextResetDate), 'utf8');

            // Calculer la prochaine date de reset = nextResetDate + 3 mois (même heure)
            const nextReset = new Date(nextResetDate);
            nextReset.setMonth(nextReset.getMonth() + 3);

            // Mettre à jour reset_date.json avec la nouvelle date de reset
            resetData.nextReset = nextReset.getTime();
            fs.writeFileSync(resetDatePath, JSON.stringify(resetData, null, 2), 'utf8');

            console.log(`✅ Prochain reset planifié le : ${nextReset.toISOString()}`);
        } catch (err) {
            console.error("⚠️ Erreur lors de la mise à jour des fichiers après reset :", err);
        }
    } else {
        const secondsLeft = Math.floor((nextResetDate - now) / 1000);
        console.log(`⏳ Pas encore l'heure du reset. Prochain reset dans ${secondsLeft}s.`);
    }
});


module.exports = { resetKIP, assignBadgesBeforeReset, getTimeUntilNextReset };
