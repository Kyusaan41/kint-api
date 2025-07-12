// index.js (version sans Redis, SSE et logs API)

require('dotenv').config();

if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error('ERREUR FATALE: BOT_TOKEN ou CLIENT_ID est manquant dans le fichier .env');
    process.exit(1);
}

console.log("Token chargé:", process.env.BOT_TOKEN);

const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Collection, ActivityType } = require('discord.js');
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const cron = require('node-cron');
const express = require("express");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// --- Importation des modules locaux ---
const { checkAchievements } = require('./commands/succes.js');
const { initAirdrop } = require('./airdrop.js');
const leveling = require('./leveling.js');
const { getLevel } = require('./leveling.js');
const { resetKIP, assignBadgesBeforeReset } = require('./resetKIP');
const { getTimeUntilNextReset, startResetCheck, sendResetAnnouncement } = require('./event-reset-Kint');
const { handleButton } = require('./commands/kint');
const { handleMenuInteraction } = require('./commands/shop');
const { updateDailyStreak } = require('./activityTracker.js');
require('./welcomer.js');
const { checkKintWarns } = require('./kintwarns-checker');
const { checkPolls } = require('./pollManager');
const { checkBirthdays } = require('./birthdayChecker');
const { loadInventaire, saveInventaire } = require('./inventaire.js');

// --- Importation des Routes API (Express) ---
const xpRoutes = require('./routes/xpRoutes');
const pointsRoutes = require('./routes/pointsRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const messagesRoute = require('./routes/messages');
const patchnoteRoute = require('./routes/patchnote');
const titreRoutes = require('./routes/titre');
const successRoute = require('./routes/success');
const inventaireRoutes = require('./routes/inventaire');
const shopRoutes = require('./routes/shop.js');
const kintLogsRoute = require('./routes/kintLogsRoute');
const kintDetailedLogsRoute = require('./routes/kintDetailedLogsRoute');
const statKintRoutes = require('./routes/statkint');
const effectsRoutes = require('./routes/effects');

// --- Chemins des fichiers de données ---
const serverInfoPath = path.join(__dirname, 'serverInfo.json');
const XP_FILE = path.join(__dirname, './xp.json');
const voiceConfigPath = path.join(__dirname, 'voiceConfig.json');

const tempChannels = new Map();
let hubVoiceChannelId = null;

const ROLE_REWARDS = [
    { level: 4, roleId: "1383091570810687560" }, { level: 8, roleId: "1219293513594966128" }, { level: 12, roleId: "1219293886225059840" },
    { level: 16, roleId: "1219293891937701949" }, { level: 20, roleId: "1219293892877357057" }, { level: 24, roleId: "1219293893703630958" },
    { level: 28, roleId: "1219293894458478703" }, { level: 32, roleId: "1219293650861948929" }, { level: 36, roleId: "1219293737549565973" },
    { level: 40, roleId: "1383091258716717056" }, { level: 44, roleId: "1383091399955841074" }, { level: 48, roleId: "1254250618105888780" },
    { level: 52, roleId: "1254250953482305556" }, { level: 56, roleId: "1254251073728675921" }, { level: 60, roleId: "1254251153990877204" },
];

const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

client.commands = new Collection();
client.maintenance = { isActive: false, startedAt: null };
const OWNER_ID = '1206053705149841428';

let logs = [];
const addLog = (message) => {
    const logEntry = { timestamp: new Date().toISOString(), log: message };
    logs.push(logEntry);
    if (logs.length > 100) logs.shift();
    console.log(`[LOG] ${message}`);
};
client.addLog = addLog;
client.logs = logs;

function initServerInfo() { if (!fs.existsSync(serverInfoPath)) { fs.writeFileSync(serverInfoPath, JSON.stringify({ guildId: '', guildName: '', guildIcon: '', memberCount: 0, messageCount: 0, messagesLast7Days: [0, 0, 0, 0, 0, 0, 0], members: [], }, null, 2)); } }
function loadServerInfo() { initServerInfo(); return JSON.parse(fs.readFileSync(serverInfoPath, 'utf-8')); }
function saveServerInfo(data) { fs.writeFileSync(serverInfoPath, JSON.stringify(data, null, 2)); }
function loadVoiceConfig() { try { if (fs.existsSync(voiceConfigPath)) { const config = JSON.parse(fs.readFileSync(voiceConfigPath, 'utf-8')); if (config.channelId) { hubVoiceChannelId = config.channelId; console.log(`✅ Configuration vocale chargée. Salon modèle ID: ${hubVoiceChannelId}`); } } else { console.log("⚠️ Fichier voiceConfig.json non trouvé."); } } catch (error) { console.error("❌ Erreur lors du chargement de voiceConfig.json:", error); } }
function loadXP() { if (!fs.existsSync(XP_FILE)) fs.writeFileSync(XP_FILE, JSON.stringify({})); return JSON.parse(fs.readFileSync(XP_FILE, 'utf8')); }

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/inventaire', inventaireRoutes(client));
app.use('/api/xp', xpRoutes);
app.use('/api/success', successRoute);
app.use('/api', titreRoutes);
app.use('/api', patchnoteRoute);
app.use('/api/points', pointsRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api', messagesRoute);
app.use('/api/shop', shopRoutes(client));
app.use('/api', kintDetailedLogsRoute);
app.use('/api', statKintRoutes);
app.use('/api/effects', effectsRoutes);
app.use('/api', kintLogsRoute(client));
const feedbackRoute = require('./routes/feedbackRoute')(client);
app.use('/api', feedbackRoute);

app.get('/api/serverinfo', async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.status(404).json({ error: 'Serveur non trouvé.' });
        await guild.members.fetch();
        const info = {
            guildId: guild.id, guildName: guild.name, guildIcon: guild.icon,
            memberCount: guild.memberCount, messageCount: loadServerInfo().messageCount,
            messagesLast7Days: loadServerInfo().messagesLast7Days,
            members: guild.members.cache.map((member) => ({
                id: member.id, username: member.user.username,
                avatar: member.user.displayAvatarURL({ format: 'png', size: 128, dynamic: true }),
                joinedAt: member.joinedAt, status: member.presence?.status || 'offline',
            })),
        };
        fs.writeFileSync(serverInfoPath, JSON.stringify(info, null, 2));
        res.json(info);
    } catch (error) {
        console.error('Erreur API /api/serverinfo :', error);
        res.status(500).json({ error: 'Impossible de récupérer les infos serveur.' });
    }
});
app.get("/api/logs", (req, res) => {
    res.json({ logs });
});
app.get("/", (req, res) => res.send("API du bot est en ligne !"));

const PORT = process.env.PORT || 20077;

(async () => {
    try {
        server.listen(PORT, () => console.log(`✅ Serveur API lancé sur le port ${PORT}`));
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        console.error("ERREUR FATALE AU DÉMARRAGE :", error);
        addLog(`❌ ERREUR FATALE AU DÉMARRAGE: ${error.message}`);
        process.exit(1);
    }
})();

const deployCommands = async () => {
    client.addLog('🛠️ Déploiement des commandes en cours...');
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
        client.addLog(`✅ ${commands.length} commandes (/) ont été déployées avec succès.`);
    } catch (error) {
        console.error("Erreur lors du déploiement des commandes :", error);
        client.addLog(`❌ Erreur lors du déploiement des commandes : ${error.message}`);
    }
};

client.once('ready', async () => {
    console.log('✅ Bot est en ligne !');
    client.addLog("🚀 Bot démarré et connecté à Discord !");
    await deployCommands();
    loadVoiceConfig();
    client.addLog("🔊 Configuration des salons vocaux chargée.");
    leveling.init(client);
    client.addLog("📈 Système de niveaux initialisé.");
    initAirdrop(client);
    client.addLog("💧 Système d'airdrops initialisé.");
    startResetCheck(client);
    client.addLog("🔄 Vérification du reset KIP démarrée.");
    client.user.setPresence({ activities: [{ name: 'Version 3.2 | By Kyû ⚡', type: ActivityType.Playing }], status: 'dnd' });
    client.addLog("🎭 Présence du bot mise à jour.");
});

client.on('guildMemberAdd', member => {
    client.addLog(`➕ ${member.user.tag} a rejoint le serveur.`);
    let info = loadServerInfo();
    info.memberCount++;
    saveServerInfo(info);
});
client.on('guildMemberRemove', member => {
    client.addLog(`➖ ${member.user.tag} a quitté le serveur.`);
    let info = loadServerInfo();
    info.memberCount--;
    saveServerInfo(info);
});
client.on('messageCreate', message => {
    if (message.author.bot) return;
    let info = loadServerInfo();
    info.messageCount++;
    const day = new Date().getDay();
    if (!info.messagesLast7Days) info.messagesLast7Days = [0, 0, 0, 0, 0, 0, 0];
    info.messagesLast7Days[day]++;
    saveServerInfo(info);
});

const TEMP_VOICE_HUB_ID = '1387423224182079578';
const tempVoiceMap = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild) return;
    if (!hubVoiceChannelId && fs.existsSync(voiceConfigPath)) { loadVoiceConfig(); }
    if (!hubVoiceChannelId) return;
    if (newState.channelId === hubVoiceChannelId) {
        try {
            const newChannel = await guild.channels.create({
                name: `🔊・Vocal de ${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parent,
                permissionOverwrites: [
                    { id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD] },
                    { id: guild.roles.everyone, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream], deny: [] },
                ],
            });
            await member.voice.setChannel(newChannel);
            tempChannels.set(newChannel.id, member.id);
            client.addLog(`🎤 Salon vocal temporaire créé pour ${member.user.tag}: ${newChannel.name}`);
        } catch (error) {
            client.addLog(`❌ Erreur création salon vocal pour ${member.user.tag}: ${error.message}`);
            console.error("Erreur création salon:", error);
        }
    }
    if (oldState.channel && tempChannels.has(oldState.channel.id) && oldState.channel.members.size === 0) {
        try {
            await oldState.channel.delete('Salon temporaire vide.');
            tempChannels.delete(oldState.channel.id);
            client.addLog(`🗑️ Salon vocal temporaire supprimé: ${oldState.channel.name}`);
        } catch (error) {
            if (error.code !== 10003) {
                client.addLog(`❌ Erreur suppression salon vocal ${oldState.channel.name}: ${error.message}`);
                console.error("Erreur suppression salon:", error);
            }
            tempChannels.delete(oldState.channel.id);
        }
    }
    if (newState.channel && tempChannels.has(newState.channel.id) && oldState.channel?.id !== newState.channel.id) {
        const ownerId = tempChannels.get(newState.channel.id);
        if (member.id === ownerId) return;
        try {
            await newState.channel.permissionOverwrites.edit(member.id, { Speak: true });
            if (member.voice.serverMute) {
                await member.voice.setMute(false, "Unmute forcé pour salon temporaire.");
            }
            client.addLog(`🎤 ${member.user.tag} a rejoint le salon de ${ownerId}, unmute forcé.`);
        } catch (err) {
            client.addLog(`❌ Erreur unmute forcé pour ${member.user.tag}: ${err.message}`);
            console.error("Erreur lors du forçage du unmute :", err);
        }
    }
});

const ticketMessages = new Map();
const ticketReasons = new Map();

client.on('interactionCreate', async interaction => {
    const userId = interaction.user.id;
    updateDailyStreak(userId, client, checkAchievements);
    if (client.maintenance.isActive && interaction.user.id !== OWNER_ID && interaction.isCommand()) {
        const elapsed = Math.floor((Date.now() - client.maintenance.startedAt) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        client.addLog(`🛠️ Interaction de ${interaction.user.tag} bloquée (maintenance).`);
        return interaction.reply({ content: `🛠️ Le bot est en maintenance depuis **${minutes}min ${seconds}s**.\nMerci de réessayer plus tard ou contacte <@${OWNER_ID}>.`, ephemeral: true });
    }
    try {
        if (interaction.isModalSubmit()) {
            client.addLog(`📝 Modale soumise par ${interaction.user.tag} (ID: ${interaction.customId})`);
            const kintCommand = client.commands.get("kint");
            if (kintCommand?.handleModal) await kintCommand.handleModal(interaction);
            return;
        }
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            const options = interaction.options?.data?.map(opt => `${opt.name}: ${opt.value}`).join(', ');
            client.addLog(`👀 Slash utilisé : /${interaction.commandName} par ${interaction.user.tag} (${interaction.user.id})${options ? ` | Options: ${options}` : ''}`);
            await command.execute(interaction);
            return;
        }
        if ((interaction.isStringSelectMenu() && interaction.customId.startsWith('shop_')) || (interaction.isButton() && interaction.customId.startsWith('shop_'))) {
            client.addLog(`🛍️ Interaction Shop par ${interaction.user.tag} (ID: ${interaction.customId})`);
            await handleMenuInteraction(interaction);
            return;
        }
        if (interaction.isStringSelectMenu() && interaction.customId === 'equip_title_select') {
           client.addLog(`👑 ${interaction.user.tag} équipe un nouveau titre.`);
            const titreCommand = require('./commands/titre.js');
            await titreCommand.handleSelect(interaction);
            return;
        }
        if (interaction.isButton()) {
            const { customId, channel, member, guild, user } = interaction;
            client.addLog(`🔘 Bouton cliqué par ${user.tag} (ID: ${customId})`);

            if (customId === 'ticket_accept') {
                const embed = interaction.message.embeds[0];
                const userMentionMatch = embed?.description?.match(/<@(\d+)>/);
                const targetUserId = userMentionMatch?.[1];
                if (targetUserId) {
                    try {
                        const targetUser = await interaction.client.users.fetch(targetUserId);
                        await targetUser.send(`✅ ${interaction.user.username} a accepté ton ticket sur le serveur **KTS**. Un membre du support va bientôt te répondre.`);
                        client.addLog(`🎫 Ticket de ${targetUser.tag} accepté par ${interaction.user.tag}`);
                    } catch (err) {
                        console.warn(`❌ Impossible d'envoyer un DM à l'utilisateur avec l'ID ${targetUserId}.`);
                        client.addLog(`⚠️ Impossible d'envoyer un DM de confirmation d'acceptation de ticket à ${targetUserId}`);
                    }
                }
                const closeButtonRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setEmoji('🗑️').setStyle(ButtonStyle.Secondary));
                await interaction.update({ content: `✅ Ticket accepté par <@${interaction.user.id}>`, components: [closeButtonRow] });
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
                        client.addLog(`🎫 Ticket de ${targetUser.tag} refusé par ${interaction.user.tag}`);
                    } catch (err) {
                        console.warn(`❌ Impossible d'envoyer un DM à l'utilisateur avec l'ID ${targetUserId}.`);
                        client.addLog(`⚠️ Impossible d'envoyer un DM de refus de ticket à ${targetUserId}`);
                    }
                }
                await interaction.reply({ content: `❌ Ticket refusé par <@${interaction.user.id}>. Fermeture dans 5 secondes.`, ephemeral: false });
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
                client.addLog(`🎫 Ticket ${channel.name} fermé par ${user.tag}.`);
                const messages = ticketMessages.get(channel.id) || [];
                const reason = ticketReasons.get(channel.id) || 'Non spécifiée';
                let logContent = `📄 **Log du ticket ${channel.name}**\n**Raison :** ${reason}\n\n`;
                messages.forEach(msg => {
                    const time = msg.timestamp.toISOString().replace('T', ' ').split('.')[0];
                    logContent += `[${time}] ${msg.author}: ${msg.content}\n`;
                });
                let logsChannel = await client.channels.fetch('1388474710613954741').catch(err => console.warn('Impossible de récupérer le channel logs:', err));
                if (logsChannel) {
                    try {
                        if (logContent.length > 2000) {
                            const buffer = Buffer.from(logContent, 'utf-8');
                            await logsChannel.send({ content: `Logs du ticket ${channel.name} fermé par <@${user.id}> :`, files: [{ attachment: buffer, name: `${channel.name}_log.txt` }] });
                        } else {
                            await logsChannel.send({ content: `Logs du ticket ${channel.name} fermé par <@${user.id}> :\n\n${logContent}` });
                        }
                        client.addLog(`📜 Logs du ticket ${channel.name} envoyés.`);
                    } catch (err) {
                        console.error('Erreur lors de l’envoi des logs:', err);
                        client.addLog(`❌ Erreur envoi des logs du ticket ${channel.name}: ${err.message}`);
                    }
                }
                await interaction.reply({ content: `🗑️ Ticket fermé par <@${user.id}>. Suppression dans 5 secondes.`, ephemeral: false });
                setTimeout(() => {
                    channel.delete().catch(console.error);
                    ticketMessages.delete(channel.id);
                    ticketReasons.delete(channel.id);
                }, 5000);
                return;
            }
            const ignoredIds = [ "airdrop_open", /^swaplane_accept_/, /^swaplane_decline_/, /^mychamp_accept_/, /^mychamp_decline_/, /^succès_/, /^vote_/, /^poll_close_/, /^poll_refresh_/, /^birthday_gift_/ ];
            if (ignoredIds.some(p => p instanceof RegExp ? p.test(customId) : p === customId)) return;
            await handleButton(interaction);
            return;
        }
    } catch (error) {
        console.error("Erreur de l'interaction :", error);
        client.addLog(`💥 Erreur grave sur une interaction de ${interaction.user.tag}: ${error.message}`);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
});

cron.schedule('0 9 * * *', () => {
    client.addLog("⏰ CRON: Exécution de checkBirthdays.");
    checkBirthdays(client);
});
checkBirthdays(client); // Exécution au démarrage
cron.schedule('0 0 * * *', () => {
    const daysUntilReset = getTimeUntilNextReset().days;
    client.addLog(`⏰ CRON: Vérification quotidienne du reset KIP (${daysUntilReset} jours restants).`);
    if (daysUntilReset === 7) {
        client.addLog("🚨 ALERTE : Le reset KIP arrive dans 7 jours !");
        console.log("🚨 ALERTE : Le reset KIP arrive dans 7 jours !");
    }
});
setInterval(() => {
    checkKintWarns(client);
}, 60 * 1000);
setInterval(() => {
    checkPolls(client);
}, 60 * 1000);
setInterval(() => {
    const currencyData = JSON.parse(fs.readFileSync('./currency.json', 'utf8'));
    const pointsData = JSON.parse(fs.readFileSync('./points.json', 'utf8'));
    Object.keys(currencyData).forEach(userId => checkAchievements(userId, client));
    Object.keys(pointsData).forEach(userId => checkAchievements(userId, client));
}, 60000);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', async (input) => {
    const trimmedInput = input.trim().toLowerCase();
    client.addLog(`⌨️ Commande console reçue: '${trimmedInput}'`);
    if (trimmedInput === 'reset') { await assignBadgesBeforeReset(client); await resetKIP(client); }
    else if (trimmedInput === 'patchnote') { await sendPatchNoteFromJSON(); }
    else if (trimmedInput === 'exit') {
        client.addLog('🛑 Commande "exit" reçue. Arrêt du bot.');
        console.log('Fermeture du bot...');
        client.destroy();
        process.exit(0);
    }
});

const patchNoteChannelId = "1387426127634497616";
async function sendPatchNoteFromJSON() {
    client.addLog("📝 Tentative d'envoi du patchnote depuis patchnote.json.");
    try {
        const data = fs.readFileSync('./patchnote.json', 'utf-8');
        const patch = JSON.parse(data);
        const embed = new EmbedBuilder().setTitle(patch.title || '📌 Patchnote').setDescription(patch.description || '').setColor(0x00AE86).setTimestamp();
        if (patch.ajouts?.length) embed.addFields({ name: '✨ Nouveautés', value: patch.ajouts.map(e => `• ${e}`).join('\n') });
        if (patch.corrections?.length) embed.addFields({ name: '🛠️ Corrections de bugs', value: patch.corrections.map(e => `• ${e}`).join('\n') });
        if (patch.ajustements?.length) embed.addFields({ name: '⚙️ Ajustements', value: patch.ajustements.map(e => `• ${e}`).join('\n') });
        if (patch.suppressions?.length) embed.addFields({ name: '❌ Suppressions', value: patch.suppressions.map(e => `• ${e}`).join('\n') });
        if (patch.systeme?.length) embed.addFields({ name: '♻️ Système', value: patch.systeme.map(e => `• ${e}`).join('\n') });
        if (patch.footer) embed.setFooter({ text: patch.footer });
        const channel = client.channels.cache.get(patchNoteChannelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            console.log("✅ Patchnote envoyé !");
            client.addLog("✅ Patchnote envoyé avec succès.");
        }
        else {
            console.error("❌ Canal pour patchnote introuvable.");
            client.addLog("❌ Échec de l'envoi du patchnote : canal introuvable.");
        }
    } catch (err) {
        console.error("❌ Erreur envoi patchnote:", err);
        client.addLog(`❌ Erreur lors de l'envoi du patchnote : ${err.message}`);
    }
}
fs.watchFile('./patchnote.json', () => {
    client.addLog("📄 Fichier patchnote.json modifié, déclenchement de l'envoi.");
    sendPatchNoteFromJSON();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 PROMISE rejetée:', promise, 'Raison:', reason);
    client.addLog(`🚨 PROMISE REJETÉE: ${reason}`);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Exception non capturée:', err);
    client.addLog(`💥 EXCEPTION NON CAPTURÉE: ${err.message}`);
});