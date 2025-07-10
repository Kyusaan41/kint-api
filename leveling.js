const fs = require('fs');
const path = require('path');
const LEVEL_LOG_CHANNEL_ID = "1346157729919799417"; // Remplace "ID_DU_SALON" par l'ID du canal de logs XP

const XP_FILE = path.join(__dirname, './xp.json');
let client; // Définition de client ici



function init(botClient) {
    client = botClient;
    console.log("✅ Client reçu dans leveling.js !");
    
    function addLog(message) {
    const logChannel = client.channels.cache.get(LEVEL_LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send(message).catch(err => console.error("❌ Impossible d'envoyer le message de log :", err));
    } else {
        console.log("❌ Salon de logs non trouvé.");
    }
}

    // ==========================
    // 📝 SYSTEME XP POUR LES MESSAGES
    // ==========================

    const ANTI_SPAM_DELAY = 60 * 1000; // 1 minute
    const lastMessageTime = {};

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const guild = message.guild;
        if (!guild) return console.log("❌ Impossible de récupérer le serveur.");

        const userId = message.author.id;
        const now = Date.now();

        if (lastMessageTime[userId] && (now - lastMessageTime[userId]) < ANTI_SPAM_DELAY) {
            console.log(`🚫 ${message.author.username} a été bloqué par l'anti-spam.`);
            return;
        }

        lastMessageTime[userId] = now;
        const xpData = loadXP();
        if (!xpData[userId]) xpData[userId] = { xp: 0 };

        const xpGain = 5; // Gain fixe de 5 XP par message
        xpData[userId].xp += xpGain;
        
         // ✅ Ajout du log pour les messages
    console.log(`💬 ${message.author.username} a gagné ${xpGain} XP (message) sur ${guild.name}.`);
        

        const oldLevel = getLevel(xpData[userId].xp - xpGain);
        const newLevel = getLevel(xpData[userId].xp);

         // ==========================
    // 📝 SYSTEME XP POUR LES VOCALS
    // ==========================

    const VOICE_XP_INTERVAL = 15 * 60 * 1000; // 15 minutes
    const VOICE_XP_AMOUNT = 7;
    
    const giveVoiceXP = async () => {
        const xpData = loadXP();
    
        client.guilds.cache.forEach(guild => {
            guild.members.cache.forEach(async (member) => {
                if (!member.voice.channel) return;
                if (member.voice.mute || member.voice.deaf) return;
                if (guild.afkChannelId && member.voice.channelId === guild.afkChannelId) return;
    
                const userId = member.id;
                if (!xpData[userId]) xpData[userId] = { xp: 0 };
    
                xpData[userId].xp += VOICE_XP_AMOUNT;
    
                // ✅ Ajout du log pour voir l'XP gagné en vocal
                console.log(`🎤 ${member.user.username} a gagné ${VOICE_XP_AMOUNT} XP en vocal sur ${guild.name}.`);
                addLog(`🎤 ${member.user.username} a gagné ${VOICE_XP_AMOUNT} XP en vocal sur ${guild.name}.`);
    
                const oldLevel = getLevel(xpData[userId].xp - VOICE_XP_AMOUNT);
                const newLevel = getLevel(xpData[userId].xp);
    
                if (newLevel > oldLevel) {
                    console.log(`🔄 Vérification auto-rôle pour ${member.user.username} (Niveau ${newLevel}) sur ${guild.name}`);
    
                    await guild.roles.fetch();
                    ROLE_REWARDS.forEach(async reward => {
                        const role = guild.roles.cache.get(reward.roleId);
                        if (!role) return;
    
                        if (newLevel >= reward.level && !member.roles.cache.has(reward.roleId)) {
                            console.log(`🎭 Ajout du rôle ${role.name} à ${member.user.username} sur ${guild.name}`);
                            member.roles.add(role).catch(err => console.error(`❌ Impossible d'ajouter ${role.name} à ${member.user.username}:`, err));
                        }
                    });
    
                    const logChannel = client.channels.cache.get(LEVEL_LOG_CHANNEL_ID);
                    if (logChannel) {
                        logChannel.send(`🎉 ${member.user} a atteint le niveau **${newLevel}** sur **${guild.name}** ! 🚀`);
                    }
                }
            });
        });
    
        saveXP(xpData);
    };
    
    setInterval(giveVoiceXP, VOICE_XP_INTERVAL);


        // Vérifier si l'utilisateur a monté de niveau
        if (newLevel > oldLevel) {
            console.log(`🔄 Vérification auto-rôle pour ${message.author.username} sur ${guild.name}, Niveau atteint : ${newLevel}`);

            await guild.members.fetch();
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                console.log(`❌ Impossible de récupérer ${userId} sur ${guild.name}`);
                return;
            }

            let roleAdded = false;

            await guild.roles.fetch();

            ROLE_REWARDS.forEach(async reward => {
                const role = guild.roles.cache.get(reward.roleId);
                if (!role) return;
            
                if (newLevel >= reward.level) {
                    // 🔥 Supprime les anciens rôles avant d'ajouter le nouveau
                    const rolesToRemove = ROLE_REWARDS
                        .filter(r => r.level < reward.level) // Récupère tous les rôles de niveaux inférieurs
                        .map(r => r.roleId);
            
                    await member.roles.remove(rolesToRemove).catch(err => console.error(`❌ Impossible de retirer les anciens rôles de ${member.user.username}:`, err));
            
                    // ✅ Ajoute le nouveau rôle
                    if (!member.roles.cache.has(reward.roleId)) {
                        console.log(`🎭 Ajout du rôle ${role.name} à ${member.user.username} sur ${guild.name}`);
                        member.roles.add(role).catch(err => console.error(`❌ Impossible d'ajouter ${role.name} à ${member.user.username}:`, err));
                    }
                }
            });

            const logChannel = client.channels.cache.get(LEVEL_LOG_CHANNEL_ID);
            if (logChannel) {
                logChannel.send(`🎉 ${message.author.username} a atteint le niveau **${newLevel}** sur **${guild.name}** ! 🚀`);
                  addLog(`🎉 ${message.author.username} a atteint le niveau **${newLevel}** sur **${guild.name}** ! 🚀`);
            } else {
                console.log("❌ Channel de logs non trouvé");
            }
        }

        saveXP(xpData);
    });

    console.log("✅ Système d'XP activé !");
}

// Fonctions utilitaires
const loadXP = () => {
    if (!fs.existsSync(XP_FILE)) {
        fs.writeFileSync(XP_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
};

const saveXP = (data) => {
    fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
};

const getLevel = (xp) => Math.floor(0.1 * Math.sqrt(xp));

const ROLE_REWARDS = [
    { level: 4, roleId: "1383091570810687560" },
    { level: 8, roleId: "1219293513594966128" },
    { level: 12, roleId: "1219293886225059840" },
    { level: 16, roleId: "1219293891937701949" },
    { level: 20, roleId: "1219293892877357057" },
    { level: 24, roleId: "1219293893703630958" },
    { level: 28, roleId: "1219293894458478703" },
    { level: 32, roleId: "1219293650861948929" },
    { level: 36, roleId: "1219293737549565973" },
    { level: 40, roleId: "1383091258716717056" },
    { level: 44, roleId: "1383091399955841074" },
    { level: 48, roleId: "1254250618105888780" },
    { level: 52, roleId: "1254250953482305556" },
    { level: 56, roleId: "1254251073728675921" },
    { level: 60, roleId: "1254251153990877204" },
];

module.exports = { init, getLevel };
