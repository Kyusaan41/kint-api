// index.js (ou bot.js)

require('dotenv').config();
console.log("Token chargé:", process.env.BOT_TOKEN);

const http = require('http');
const { Server } = require("socket.io");

const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Collection, ActivityType } = require('discord.js');
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const cron = require('node-cron');
const express = require("express");
const cors = require("cors");
const app = express();

const server = http.createServer(app); // On crée un serveur HTTP qui utilise Express
const io = new Server(server, {
    cors: {
        origin: "https://dashboard-kint-bot.vercel.app", // Pour le développement. Mettez l'URL de votre dashboard en production ici.
        methods: ["GET", "POST"]
    }
});

// --- Importation des modules locaux ---
const { checkAchievements } = require('./commands/succes.js');
const { initAirdrop } = require('./airdrop.js');
const shop = require('./commands/shop.js'); // S'il exporte une instance, sinon 'shopRoutes' est plus pertinent.
const leveling = require('./leveling.js');
const { getLevel } = require('./leveling.js');
const { resetKIP, assignBadgesBeforeReset } = require('./resetKIP');
const {
    getTimeUntilNextReset,
    startResetCheck,
    sendResetAnnouncement
} = require('./event-reset-Kint');
const { handleButton } = require('./commands/kint');
const { handleMenuInteraction } = require('./commands/shop');
const { updateDailyStreak } = require('./activityTracker.js');
require('./welcomer.js'); // S'il s'auto-exécute
const { checkKintWarns } = require('./kintwarns-checker');
const { checkPolls } = require('./pollManager');
const { checkBirthdays } = require('./birthdayChecker');

// --- Importation des Routes API (Express) ---
const xpRoutes = require('./routes/xpRoutes');
const pointsRoutes = require('./routes/pointsRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const messagesRoute = require('./routes/messages');
const patchnoteRoute = require('./routes/patchnote');
const titreRoutes = require('./routes/titre');
const successRoute = require('./routes/success');
const inventaireRoutes = require('./routes/inventaire');
const shopRoutes = require('./routes/shop.js'); // Route /api/shop
const kintLogsRoute = require('./routes/kintLogsRoute'); // <-- VOTRE NOUVELLE ROUTE POUR LES LOGS KINT
const kintDetailedLogsRoute = require('./routes/kintDetailedLogsRoute'); // <-- NOUVEAU: Votre route pour récupérer les logs détaillés
const statKintRoutes = require('./routes/statkint'); 
const effectsRoutes = require('./routes/effects');

// --- Chemins des fichiers de données ---
const serverInfoPath = path.join(__dirname, 'serverInfo.json');
const XP_FILE = path.join(__dirname, './xp.json');
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

// --- Initialisation du Client Discord.js ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

client.commands = new Collection();
client.maintenance = {
    isActive: false,
    startedAt: null
};
const OWNER_ID = '1206053705149841428'; // Assurez-vous que cet ID est correct.

// --- Fonctions de Logs Internes du Bot ---
let logs = []; // Définition du tableau des logs
const addLog = (message) => {
    const logEntry = { timestamp: new Date().toISOString(), log: message };
    logs.push(logEntry);
    if (logs.length > 100) logs.shift(); // Limite les logs à 100 entrées.
};
client.addLog = addLog; // Assigne la fonction addLog au client Discord
client.logs = logs; // Assigne le tableau des logs au client Discord

const userSockets = {}; // Dictionnaire pour lier userId -> socketId
io.on('connection', (socket) => {
    console.log(`[Socket.io] Un utilisateur s'est connecté: ${socket.id}`);

    // Quand un utilisateur s'identifie depuis le dashboard
    socket.on('register', (userId) => {
        console.log(`[Socket.io] L'utilisateur ${userId} est enregistré avec le socket ${socket.id}`);
        userSockets[userId] = socket.id;
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Un utilisateur s'est déconnecté: ${socket.id}`);
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
    });
});

// --- Fonctions de gestion de serverInfo.json ---
function initServerInfo() {
    if (!fs.existsSync(serverInfoPath)) {
        fs.writeFileSync(
            serverInfoPath,
            JSON.stringify(
                {
                    guildId: '',
                    guildName: '',
                    guildIcon: '',
                    memberCount: 0,
                    messageCount: 0,
                    messagesLast7Days: [0, 0, 0, 0, 0, 0, 0],
                    members: [],
                },
                null,
                2
            )
        );
    }
}

function loadServerInfo() {
    initServerInfo(); // S'assure que le fichier existe avant de le lire
    return JSON.parse(fs.readFileSync(serverInfoPath, 'utf-8'));
}

function saveServerInfo(data) {
    fs.writeFileSync(serverInfoPath, JSON.stringify(data, null, 2));
}

// --- Fonctions de gestion d'XP ---
function loadXP() {
    if (!fs.existsSync(XP_FILE)) fs.writeFileSync(XP_FILE, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
}

// --- Configuration Express App ---
app.use(cors()); // Permet les requêtes cross-origin, essentiel pour le dashboard.
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json()); // Pour parser les corps de requête JSON.
app.use(express.urlencoded({ extended: true })); // Pour parser les corps de requête URL-encoded.

app.use((req, res, next) => {
    req.app.set('discordClient', client);
    req.app.set('socketio', io);
    req.app.set('userSockets', userSockets);
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- Définition des Routes API Express ---
// Ces routes doivent être définies AVANT que le serveur n'écoute.
app.use('/api/xp', xpRoutes);
app.use('/api/inventaire', inventaireRoutes);
app.use('/api/success', successRoute);
app.use('/api', titreRoutes);
app.use('/api', patchnoteRoute);
app.use('/api/points', pointsRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api', messagesRoute);
app.use('/api/shop', shopRoutes(client)); // Passez l'instance 'client' si la route en a besoin.
app.use('/api', kintDetailedLogsRoute);
app.use('/api', statKintRoutes);
app.use('/api/effects', effectsRoutes);

// --- VOTRE NOUVELLE ROUTE POUR LES LOGS KINT ---
// Cette route est cruciale pour que le dashboard puisse envoyer des logs à Discord.
app.use('/api', kintLogsRoute(client)); // Passez l'instance 'client' à votre routeur.
const feedbackRoute = require('./routes/feedbackRoute')(client); // On passe le 'client' du bot
app.use('/api', feedbackRoute);
// --- Points KIP Legacy (potentiellement obsolète avec dashboard) ---
// Ces routes semblent être pour une ancienne interface locale ou directe.
// Si le dashboard gère désormais tout, ces routes pourraient être retirées.
app.post('/kint', (req, res) => {
    const { userId, points, action } = req.body;
    const kipData = require('./kip.json'); // Assurez-vous que kip.json existe

    if (!kipData[userId]) kipData[userId] = { kip: 0 };

    const value = parseInt(points);
    if (action === 'gain') {
        kipData[userId].kip += value;
    } else if (action === 'perdu') {
        kipData[userId].kip = Math.max(0, kipData[userId].kip - value);
    }

    fs.writeFileSync('./kip.json', JSON.stringify(kipData, null, 2));
    res.redirect('/minijeux');
});

app.get('/minijeux', (req, res) => {
    const kipData = require('./kip.json');
    const users = Object.entries(kipData)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.kip - a.kip);

    // Nécessite un moteur de template (ex: EJS, Pug) si vous utilisez res.render
    // res.render('minijeux', { users });
    res.json(users); // Alternative simple pour voir les données
});

// --- Routes API de base du bot ---
app.get('/api/serverinfo', async (req, res) => {
    try {
        const guild = client.guilds.cache.first(); // Adaptez si vous avez plusieurs serveurs.
        if (!guild) return res.status(404).json({ error: 'Serveur non trouvé.' });

        await guild.members.fetch(); // Assurez-vous d'avoir tous les membres.

        const info = {
            guildId: guild.id,
            guildName: guild.name,
            guildIcon: guild.icon,
            memberCount: guild.memberCount,
            messageCount: loadServerInfo().messageCount,
            messagesLast7Days: loadServerInfo().messagesLast7Days,
            members: guild.members.cache.map((member) => ({
                id: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ format: 'png', size: 128, dynamic: true }),
                joinedAt: member.joinedAt,
                status: member.presence?.status || 'offline',
            })),
        };

        fs.writeFileSync(serverInfoPath, JSON.stringify(info, null, 2)); // Écriture dans le fichier.

        res.json(info);
    } catch (error) {
        console.error('Erreur API /api/serverinfo :', error);
        res.status(500).json({ error: 'Impossible de récupérer les infos serveur.' });
    }
});

app.get("/api/logs", (req, res) => res.json({ logs })); // Expose les logs internes du bot.
app.get("/api/bot-info", (req, res) => res.json({ botName: "Kint", status: "✅ En ligne", servers: client.guilds.cache.size }));
app.get("/", (req, res) => res.send("API du bot est en ligne !"));
app.get("/api/test", (req, res) => res.json({ message: "Ça fonctionne !" }));

// --- Démarrage du serveur Express ---
const PORT = process.env.PORT || 20077;
server.listen(PORT, () => console.log(`✅ Serveur API (avec WebSockets) lancé sur le port ${PORT}`));

// --- Gestion des commandes Slash (déploiement) ---
// Déploiement des commandes au démarrage du bot.
const deployCommands = async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    const commands = [];

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if (!command.data || !command.data.name) continue;
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }

    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Commandes déployées !");
    } catch (error) {
        console.error("Erreur lors du déploiement des commandes :", error);
    }
};

// --- Initialisation au démarrage du Client Discord ---
client.once('ready', async () => {
    console.log('✅ Bot est en ligne !');
    addLog("🚀 Bot démarré...");

    // Déploiement des commandes Slash
    await deployCommands();

    // Initialisations qui dépendent du client Discord.
    leveling.init(client);
    initAirdrop(client); // Assurez-vous que initAirdrop prend le client.
    startResetCheck(client); // Assurez-vous que startResetCheck prend le client.

    client.user.setPresence({ activities: [{ name: 'Version 3.2 | By Kyû ⚡', type: ActivityType.Playing }], status: 'dnd' });

    // Mise à jour initiale des infos du serveur.
    let info = loadServerInfo();
    const guild = client.guilds.cache.get('950136485867307088'); // ID de votre serveur Discord
    if (guild) {
        info.memberCount = guild.memberCount;
        saveServerInfo(info);
        console.log(`Bot prêt, membres : ${info.memberCount}`);
    } else {
        console.warn("❌ Guild ID '950136485867307088' non trouvée au démarrage. Les infos du serveur pourraient être inexactes.");
    }

    // Chargement des XP et vérification des rôles.
    const xpData = loadXP();
    for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch();
        await guild.roles.fetch();

        for (const member of guild.members.cache.values()) {
            const userId = member.id;
            const userXP = xpData[userId]?.xp || 0;
            const userLevel = getLevel(userXP);
            const memberRoles = member.roles.cache.map(r => r.id);
            let highestReward = null;
            for (const reward of ROLE_REWARDS) {
                if (userLevel >= reward.level && (!highestReward || reward.level > highestReward.level)) {
                    highestReward = reward;
                }
            }
            if (highestReward) {
                const highestRoleId = highestReward.roleId;
                const rolesToRemove = ROLE_REWARDS.map(r => r.roleId).filter(roleId => roleId !== highestRoleId && memberRoles.includes(roleId));
                if (rolesToRemove.length > 0) {
                    await member.roles.remove(rolesToRemove).catch(console.error);
                }
                if (!member.roles.cache.has(highestRoleId)) {
                    const role = guild.roles.cache.get(highestRoleId);
                    if (role) await member.roles.add(role).catch(console.error);
                }
            }
        }
    }
    console.log("✅ Vérification des rôles terminée !");
    addLog("✅ Vérification des rôles terminée !");

    // Message de reset KIP au démarrage
    const resetTime = getTimeUntilNextReset();
    console.log(`📅 Il reste ${resetTime.days} jours et ${resetTime.hours} heures avant le reset des KIP.`);
    addLog(`📅 Il reste ${resetTime.days} jours avant le reset des KIP.`);
});

// --- Listeners Discord ---
client.on('guildMemberAdd', member => {
    let info = loadServerInfo();
    info.memberCount++;
    saveServerInfo(info);
});

client.on('guildMemberRemove', member => {
    let info = loadServerInfo();
    info.memberCount--;
    saveServerInfo(info);
});

client.on('messageCreate', message => {
    if (message.author.bot) return; // Ne compte pas les messages des bots

    let info = loadServerInfo();
    info.messageCount++;

    const day = new Date().getDay(); // 0 (dimanche) à 6 (samedi)
    if (!info.messagesLast7Days) info.messagesLast7Days = [0, 0, 0, 0, 0, 0, 0];

    info.messagesLast7Days[day]++;

    saveServerInfo(info);
});

client.on('interactionCreate', async interaction => {
    console.log("Type d'interaction:", interaction.type);
    console.log("Commande ou Custom ID:", interaction.commandName || interaction.customId);

    const userId = interaction.user.id;
    // Assurez-vous que updateDailyStreak prend le client et checkAchievements.
    updateDailyStreak(userId, client, checkAchievements);

    // Mode maintenance : bloque les commandes sauf propriétaire
    if (client.maintenance.isActive && interaction.user.id !== OWNER_ID && interaction.isCommand()) {
        const elapsed = Math.floor((Date.now() - client.maintenance.startedAt) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;

        return interaction.reply({
            content: `🛠️ Le bot est en maintenance depuis **${minutes}min ${seconds}s**.\nMerci de réessayer plus tard ou contacte <@${OWNER_ID}>.`,
            ephemeral: true
        });
    }

    try {
        if (interaction.isModalSubmit()) {
            const kintCommand = client.commands.get("kint");
            if (kintCommand?.handleModal) {
                await kintCommand.handleModal(interaction);
            }
            return;
        }

        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            if (client.addLog) {
                const options = interaction.options?.data
                    ?.map(opt => `${opt.name}: ${opt.value}`)
                    .join(', ');
                const logMsg = `👀 Slash utilisé : /${interaction.commandName} par ${interaction.user.tag} (${interaction.user.id})${options ? ` | Options: ${options}` : ''}`;
                client.addLog(logMsg);
            }

            await command.execute(interaction);
            return;
        }

        if (
            (interaction.isStringSelectMenu() && interaction.customId.startsWith('shop_')) ||
            (interaction.isButton() && interaction.customId.startsWith('shop_'))
        ) {
            await handleMenuInteraction(interaction);
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'equip_title_select') {
            const titreCommand = require('./commands/titre.js'); // Assurez-vous que ce fichier existe et exporte handleSelect
            await titreCommand.handleSelect(interaction);
            return;
        }

        if (interaction.isButton()) {
            const { customId, channel, member, guild, user } = interaction;

            if (customId === 'ticket_accept') {
                const embed = interaction.message.embeds[0];
                const userMentionMatch = embed?.description?.match(/<@(\d+)>/);
                const targetUserId = userMentionMatch?.[1];

                if (targetUserId) {
                    try {
                        const targetUser = await interaction.client.users.fetch(targetUserId);
                        await targetUser.send(`✅ ${interaction.user.username} a accepté ton ticket sur le serveur **KTS**. Un membre du support va bientôt te répondre.`);
                    } catch (err) {
                        console.warn(`❌ Impossible d'envoyer un DM à l'utilisateur avec l'ID ${targetUserId}.`);
                    }
                }

                const closeButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Fermer')
                        .setEmoji('🗑️')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.update({
                    content: `✅ Ticket accepté par <@${interaction.user.id}>`,
                    components: [closeButtonRow],
                });

                return;
            }

            if (customId === 'ticket_refuse') {
                const embed = interaction.message.embeds[0];
                const userMentionMatch = embed?.description?.match(/<@(\d+)>/);
                const targetUserId = userMentionMatch?.[1];

                if (targetUserId) {
                    try {
                        const targetUser = await interaction.client.users.fetch(targetUserId);
                        await targetUser.send(`❌ ${interaction.user.username} a refusé ton ticket sur le serveur **KTS**. Tu peux en ouvrir un nouveau si besoin.`);
                    } catch (err) {
                        console.warn(`❌ Impossible d'envoyer un DM à l'utilisateur avec l'ID ${targetUserId}.`);
                    }
                }

                await interaction.reply({
                    content: `❌ Ticket refusé par <@${interaction.user.id}>. Fermeture dans 5 secondes.`,
                    ephemeral: false
                });

                setTimeout(() => {
                    channel.delete().catch(console.error);

                    ticketMessages.delete(channel.id);
                    ticketReasons.delete(channel.id);
                }, 5000);

                return;
            }

            if (customId === 'ticket_close') {
                if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.reply({ content: "🚫 Tu n'as pas la permission de fermer ce ticket.", ephemeral: true });
                }

                const messages = ticketMessages.get(channel.id) || [];
                const reason = ticketReasons.get(channel.id) || 'Non spécifiée';

                let logContent = `📄 **Log du ticket ${channel.name}**\n**Raison :** ${reason}\n\n`;
                messages.forEach(msg => {
                    const time = msg.timestamp.toISOString().replace('T', ' ').split('.')[0];
                    logContent += `[${time}] ${msg.author}: ${msg.content}\n`;
                });

                let logsChannel;
                try {
                    logsChannel = await client.channels.fetch('1388474710613954741'); // ID du canal de logs pour les tickets.
                } catch (err) {
                    console.warn('Impossible de récupérer le channel logs:', err);
                }

                if (logsChannel) {
                    try {
                        if (logContent.length > 2000) {
                            const buffer = Buffer.from(logContent, 'utf-8');
                            await logsChannel.send({
                                content: `Logs du ticket ${channel.name} fermé par <@${user.id}> :`,
                                files: [{ attachment: buffer, name: `${channel.name}_log.txt` }],
                            });
                        } else {
                            await logsChannel.send({ content: `Logs du ticket ${channel.name} fermé par <@${user.id}> :\n\n${logContent}` });
                        }
                    } catch (err) {
                        console.error('Erreur lors de l’envoi des logs:', err);
                    }
                } else {
                    console.warn('Channel logs introuvable ou inaccessible.');
                }

                await interaction.reply({
                    content: `🗑️ Ticket fermé par <@${user.id}>. Suppression dans 5 secondes.`,
                    ephemeral: false
                });

                setTimeout(() => {
                    channel.delete().catch(console.error);
                    ticketMessages.delete(channel.id);
                    ticketReasons.delete(channel.id);
                }, 5000);

                return;
            }

            const ignoredIds = [
                "airdrop_open",
                /^swaplane_accept_/, /^swaplane_decline_/,
                /^mychamp_accept_/, /^mychamp_decline_/,
                /^succès_/, /^vote_/, /^poll_close_/, /^poll_refresh_/,
                /^birthday_gift_/
            ];
            if (ignoredIds.some(p => p instanceof RegExp ? p.test(interaction.customId) : p === interaction.customId)) {
                return;
            }

            await handleButton(interaction); // Assurez-vous que handleButton prend interaction en paramètre.
            return;
        }
    } catch (error) {
        console.error("Erreur de l'interaction :", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
});

// --- Ticket Maps (déplacées en haut si utilisées ici uniquement) ---
const ticketMessages = new Map();
const ticketReasons = new Map();


// --- Tâches planifiées (Cron Jobs) et Intervalles ---
cron.schedule('0 9 * * *', () => { // Tous les jours à 9h00.
    checkBirthdays(client);
});
checkBirthdays(client); // Vérifie aussi au démarrage.

cron.schedule('0 0 * * *', () => { // Tous les jours à minuit.
    const daysUntilReset = getTimeUntilNextReset().days;
    if (daysUntilReset === 7) {
        // Envoi un message d'alerte dans un canal Discord spécifique.
        // client.channels.cache.get('ID_DU_CANAL_ANNONCE').send("🚨 **ALERTE : Le reset des points KIP arrive dans 7 jours !**");
        console.log("🚨 ALERTE : Le reset des points KIP arrive dans 7 jours !");
    }
});

setInterval(() => { // Toutes les 60 secondes.
    checkKintWarns(client);
}, 60 * 1000);

setInterval(() => { // Toutes les 60 secondes.
    checkPolls(client);
}, 60 * 1000);

setInterval(() => { // Toutes les 60 secondes pour les succès.
    const currencyData = JSON.parse(fs.readFileSync('./currency.json', 'utf8'));
    const pointsData = JSON.parse(fs.readFileSync('./points.json', 'utf8'));
    Object.keys(currencyData).forEach(userId => checkAchievements(userId, client));
    Object.keys(pointsData).forEach(userId => checkAchievements(userId, client));
}, 60000);

// --- Listener de console (Readline) ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("✅ Bot démarré. Tape 'reset' pour exécuter le reset KIP, 'patchnote' pour envoyer un patchnote, ou 'exit' pour quitter.");
rl.on('line', async (input) => {
    const trimmedInput = input.trim().toLowerCase();
    if (trimmedInput === 'reset') {
        await assignBadgesBeforeReset(client);
        await resetKIP(client);
    } else if (trimmedInput === 'patchnote') { // Appel sans contenu pour trigger la fonction.
        await sendPatchNoteFromJSON();
    } else if (trimmedInput === 'exit') {
        console.log('Fermeture du bot...');
        client.destroy();
        process.exit(0);
    }
});

// --- Patchnote automatique (sur modification du fichier) ---
const patchNoteChannelId = "1387426127634497616"; // ID du canal où envoyer les patchnotes.

async function sendPatchNoteFromJSON() {
    try {
        const data = fs.readFileSync('./patchnote.json', 'utf-8');
        const patch = JSON.parse(data);

        const embed = new EmbedBuilder()
            .setTitle(patch.title || '📌 Patchnote')
            .setDescription(patch.description || '')
            .setColor(0x00AE86)
            .setTimestamp();

        if (patch.ajouts?.length)
            embed.addFields({ name: '✨ Nouveautés', value: patch.ajouts.map(e => `• ${e}`).join('\n') });
        if (patch.corrections?.length)
            embed.addFields({ name: '🛠️ Corrections de bugs', value: patch.corrections.map(e => `• ${e}`).join('\n') });
        if (patch.ajustements?.length)
            embed.addFields({ name: '⚙️ Ajustements', value: patch.ajustements.map(e => `• ${e}`).join('\n') });
        if (patch.suppressions?.length)
            embed.addFields({ name: '❌ Suppressions', value: patch.suppressions.map(e => `• ${e}`).join('\n') });
        if (patch.systeme?.length)
            embed.addFields({ name: '♻️ Système', value: patch.systeme.map(e => `• ${e}`).join('\n') });

        if (patch.footer)
            embed.setFooter({ text: patch.footer });

        const channel = client.channels.cache.get(patchNoteChannelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            console.log("✅ Patchnote envoyé automatiquement !");
        } else {
            console.error("❌ Canal introuvable pour l'envoi du patchnote.");
        }
    } catch (err) {
        console.error("❌ Erreur lors de l'envoi automatique du patchnote :", err);
    }
}

fs.watchFile('./patchnote.json', () => {
    console.log('📁 Mise à jour détectée dans patchnote.json, envoi du patchnote...');
    sendPatchNoteFromJSON();
});

// --- Gestion des erreurs non catchées ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 PROMISE rejetée sans catch :', promise);
    console.error('🛠️ Raison :', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Exception non capturée :', err);
});

// --- Vérification des variables d'environnement ---
if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error('Erreur: Token ou ID du client manquant. Vérifiez votre fichier .env');
    process.exit(1);
}

// --- Connexion du Bot Discord ---
console.log("Tentative de connexion au bot avec le token...");
client.login(process.env.BOT_TOKEN);

// Exportation du client (si d'autres modules ont besoin d'y accéder)
module.exports = client;