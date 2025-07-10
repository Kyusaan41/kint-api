const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const RESET_DATE_FILE = 'reset_date.json';
const ANNOUNCEMENT_CHANNEL_ID = '1114544739086241862';
const GUILD_ID = '950136485867307088';
const EVENT_NAME = "Reset KIP Approchant";
let manualResetDays = null;

// Variable globale pour éviter les annonces multiples à 10 minutes
let announced10min = false;

function getTimeUntilNextReset() {
    if (!fs.existsSync(RESET_DATE_FILE)) {
        console.error("❌ Le fichier reset_date.json est introuvable !");
        return { days: "ERREUR", hours: "ERREUR" };
    }

    try {
        const data = fs.readFileSync(RESET_DATE_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        let nextResetTimestamp = jsonData.nextReset;

        // Conversion si STRING
        if (typeof nextResetTimestamp === "string") {
            nextResetTimestamp = parseInt(nextResetTimestamp, 10);
            console.log("🔄 Conversion STRING -> TIMESTAMP :", nextResetTimestamp);
        }

        if (!nextResetTimestamp || isNaN(nextResetTimestamp)) {
            console.error("❌ La date de reset est invalide ou corrompue !");
            return { days: "ERREUR", hours: "ERREUR" };
        }

        const now = Date.now();
        const diff = nextResetTimestamp - now;

        if (diff <= 0) {
            console.log("🚨 Le reset des KIP est aujourd'hui !");
            return { days: 0, hours: 0, minutes: 0 };
        }

        const daysUntilNextReset = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hoursUntilNextReset = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesUntilNextReset = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        console.log(`📅 Temps avant reset : ${daysUntilNextReset} jours et ${hoursUntilNextReset} heures.`);
        return { 
            days: Number(daysUntilNextReset), 
            hours: Number(hoursUntilNextReset), 
            minutes: Number(minutesUntilNextReset) 
        };
    } catch (error) {
        console.error("❌ Erreur lors de la lecture de reset_date.json :", error);
        return { days: "ERREUR", hours: "ERREUR" };
    }
}

async function sendResetAnnouncement(client, daysLeft) {
    const lastAnnouncementFile = 'last_announcement.json';
    let lastAnnouncement = {};

    if (fs.existsSync(lastAnnouncementFile)) {
        lastAnnouncement = JSON.parse(fs.readFileSync(lastAnnouncementFile, 'utf8'));
    }

    const nextResetTimestamp = getTimeUntilNextReset().days; 

    if (lastAnnouncement.nextReset === nextResetTimestamp) {
        console.log("📢 [DEBUG] L'annonce a déjà été envoyée, pas besoin de la refaire.");
        return;
    }

    fs.writeFileSync(lastAnnouncementFile, JSON.stringify({ nextReset: nextResetTimestamp }));

    try {
        console.log(`📢 Tentative d'envoi de l'annonce pour ${daysLeft} jours restants...`);

        if (!client || !client.isReady()) {
            console.log("❌ Client Discord non prêt.");
            return;
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return console.log("❌ Serveur introuvable.");

        const channel = await guild.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
        if (!channel) return console.log("❌ Channel d’annonce introuvable.");

        const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚨 ALERTE RESET KIP !')
        .setDescription(`Le reset des points KIP aura lieu dans **${daysLeft} jours** !\n
        🎯 **Préparez-vous et essayez de monter votre score avant l'échéance !** 🚀`)
        .addFields(
            {
                name: "⚠️ Mode Chaos Activé !",
                value: "Pendant cet événement :\n" +
                       "✅ **+30 points bonus** si vous n'avez **pas INT**' !\n" +
                       "❌ **-35 points malus** si vous avez **INT** !\n\n" +
                       "⚡Faîtes de votre mieux pour éviter de perdre trop de points avant le reset !"
            }
        )
        .setFooter({ text: "Kint Bot - Système de reset KIP", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log("📢 Embed d'annonce envoyé !");
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'annonce :", error);
    }
}

async function createResetEvent(client, daysLeft) {
    console.log("📅 [DEBUG] createResetEvent() a été appelé !");

    if (!client || !client.isReady()) {
        console.log("❌ [DEBUG] Client non prêt !");
        return;
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.log("❌ [DEBUG] Impossible de récupérer la guild !");
        return;
    }

    const existingEvent = guild.scheduledEvents.cache.find(event => event.name === "Reset des KIP");
    if (existingEvent) {
        console.log("🔄 [DEBUG] L'événement existe déjà, pas besoin de le recréer.");
        return;
    }

    const now = Date.now();
    const startTime = new Date(now + daysLeft * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);

    if (startTime.getTime() <= now) {
        console.log("❌ [DEBUG] Impossible de créer l'événement : la date est déjà passée.");
        return;
    }

    try {
        console.log(`🚀 [DEBUG] Création d'un événement pour ${daysLeft} jours.`);
        await guild.scheduledEvents.create({
            name: "Reset des KIP",
            scheduledStartTime: startTime,
            scheduledEndTime: endTime,
            privacyLevel: 2,
            entityType: 3,
            entityMetadata: { location: "Discord Server" },
            description: `Le reset des KIP aura lieu dans ${daysLeft} jours !`,
        });

        console.log("✅ [DEBUG] Événement créé avec succès !");
    } catch (error) {
        console.error("❌ [DEBUG] Erreur lors de la création de l'événement :", error);
    }
}

function updateResetDate() {
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + (3 - (now.getMonth() % 3)), 1, 0, 0, 0);
    fs.writeFileSync(RESET_DATE_FILE, JSON.stringify({ nextReset: nextReset.getTime() }));
    console.log("✅ Nouvelle date de reset enregistrée dans reset_date.json");
}

function setResetInDays(days) {
    if (!isNaN(days) && days > 0) {
        const now = Date.now();
        const newResetTimestamp = now + days * 24 * 60 * 60 * 1000;

        const resetData = {
            nextReset: newResetTimestamp,
            manualResetDays: days
        };

        fs.writeFileSync(RESET_DATE_FILE, JSON.stringify(resetData, null, 2));
        console.log("✅ Nouvelle date de reset enregistrée dans reset_date.json :", resetData);
    } else {
        console.log("❌ Nombre invalide. Veuillez entrer un nombre valide supérieur à 0.");
    }
}

console.log("🚀 [DEBUG] startResetCheck() a bien été exécuté !");
async function startResetCheck(client) {
    if (!client || !client.isReady()) {
        console.log("❌ Client Discord non prêt, attente...");
        return;
    }
    
    console.log("🚀 [CRON] Vérification du reset activée !");
    cron.schedule('*/1 * * * *', async () => {
        const resetTime = getTimeUntilNextReset();
        console.log(`📅 [DEBUG] Temps avant le reset : ${resetTime.days} jours, ${resetTime.hours} heures, ${resetTime.minutes} minutes.`);
        
        // Annonce à 10 minutes restantes avec compte à rebours dynamique
        if (resetTime.days === 0 && resetTime.hours === 0 && resetTime.minutes === 10 && !announced10min) {
            console.log("🚨 [CRON] 10 minutes restantes - envoi de l'annonce !");
            announced10min = true;

            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const channel = await guild.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
                if (!channel) return console.log("❌ Channel introuvable pour annonce 10 minutes.");

                const msg = await channel.send("@here ⏰ **TEMPS RESTANT AVANT RESET : 10 minutes !** Compte à rebours en secondes...");

                let secondsLeft = 600; // 10 minutes * 60 secondes
                const interval = setInterval(async () => {
                    secondsLeft--;
                    if (secondsLeft <= 0) {
                        clearInterval(interval);
                        await msg.edit("@here ⏰ **LE RESET EST MAINTENANT !**");
                    } else {
                        await msg.edit(`@here ⏰ **TEMPS RESTANT AVANT RESET : ${secondsLeft} secondes...**`);
                    }
                }, 1000);
            } catch (error) {
                console.error("❌ Erreur lors de l'envoi du message 10 minutes :", error);
            }
        }
        
        if ((resetTime.days <= 7 && resetTime.days > 0) || (resetTime.days === 0 && resetTime.hours > 0)) { 
            console.log("🚨 [CRON] Condition validée : Création de l'événement et annonce.");
            await sendResetAnnouncement(client, resetTime.days);
            await createResetEvent(client, resetTime.days);
        } else {
            console.log("⏳ [CRON] Condition non remplie, aucune action.");
        }
    });
}

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    const args = input.trim().split(/\s+/);
    
    if (args[0] === 'setresetindays' && args.length === 2) {
        const days = parseInt(args[1], 10);
        if (!isNaN(days) && days > 0) {
            setResetInDays(days);
            console.log(`✅ Le reset est maintenant programmé dans ${days} jours.`);
        } else {
            console.log("❌ Veuillez entrer un nombre valide supérieur à 0.");
        }
    } else {
        console.log("❌ Commande inconnue. Utilisez : setResetInDays X (ex: setResetInDays 2)");
    }
});

module.exports = { getTimeUntilNextReset, setResetInDays, updateResetDate, startResetCheck, createResetEvent, sendResetAnnouncement };
