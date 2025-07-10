const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// --- Vos fichiers de données ---
const POINTS_FILE = 'points.json'; 
const INVENTORY_FILE = 'inventaire.json';
const EFFECTS_FILE = 'effects.json';
const RESET_DATE_FILE = 'reset_date.json';
const POINTS_LOG_FILE = 'points_log.json';

const LOG_CHANNEL_ID_1 = "1342558386507481145";
const LOG_CHANNEL_ID_2 = "1346142855806320742";

// --- Fonctions utilitaires asynchrones ---
async function readJsonFile(filePath) {
    try {
        const absolutePath = path.resolve(__dirname, '..', filePath);
        const data = await fs.readFile(absolutePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

async function writeJsonFile(filePath, data) {
    const absolutePath = path.resolve(__dirname, '..', filePath);
    await fs.writeFile(absolutePath, JSON.stringify(data, null, 2));
}

async function addPointLog(userId, logEntry) {
    const allLogs = await readJsonFile(POINTS_LOG_FILE);
    if (!allLogs[userId]) {
        allLogs[userId] = [];
    }
    allLogs[userId].push(logEntry);
    await writeJsonFile(POINTS_LOG_FILE, allLogs);
}

async function isEventActive() {
    try {
        const resetData = await readJsonFile(RESET_DATE_FILE);
        if (!resetData || !resetData.nextReset) return false;
        return (resetData.nextReset - Date.now()) <= 7 * 24 * 60 * 60 * 1000;
    } catch {
        return false;
    }
}

const command = new SlashCommandBuilder()
    .setName('kint')
    .setDescription('🐸 Gagnes ou perds des points.');

module.exports = {
    data: command,

    async execute(interaction) {
        const pointsData = await readJsonFile(POINTS_FILE);
        if (pointsData[interaction.user.id] === undefined) {
            pointsData[interaction.user.id] = 0;
            await writeJsonFile(POINTS_FILE, pointsData);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kint_perdu').setLabel('Perdu ❌').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('kint_gagne').setLabel('Gagné ✅').setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.reply({
            content: "**T'as gagné ou perdu des points ?** ⚡",
            components: [row],
            fetchReply: true,
            ephemeral: true
        });
    },

    async handleButton(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(interaction.customId === 'kint_gagne' ? 'kint_gagne_modal' : 'kint_perdu_modal')
            .setTitle(interaction.customId === 'kint_gagne' ? 'Combien de points as-tu gagné ?' : 'Combien de points as-tu perdu ?');

        const pointsInput = new TextInputBuilder().setCustomId('points').setLabel('Points :').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(pointsInput));
        
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const pointsInput = interaction.fields.getTextInputValue('points');
        const userId = interaction.user.id;
        let finalParsedPoints = parseInt(pointsInput, 10);

        if (isNaN(finalParsedPoints) || finalParsedPoints <= 0) {
            return interaction.editReply({ content: '❌ Veuillez entrer un nombre de points valide et positif.' });
        }
        
        const [pointsData, inventoryData, effectsData] = await Promise.all([
            readJsonFile(POINTS_FILE),
            readJsonFile(INVENTORY_FILE),
            readJsonFile(EFFECTS_FILE)
        ]);
        
        const currentPoints = pointsData[userId] || 0;
        const userInventory = inventoryData[userId] || {};
        const userEffect = effectsData[userId];

        let pointsChange = 0;
        let actionText = "";
        let effectType = "Aucun effet";
        let logActionType = "";
        let logReason = "";
        let multiplier = 1;
        let wasProtectedByShield = false;

        if (interaction.customId === 'kint_perdu_modal') {
            if (userInventory.KShield && userInventory.KShield.quantity > 0) {
                actionText = 'a été protégé par KShield';
                logActionType = 'PERDU';
                logReason = 'Protégé par KShield';
                effectType = 'KShield';
                wasProtectedByShield = true;
                
                userInventory.KShield.quantity -= 1;
                if (userInventory.KShield.quantity === 0) delete userInventory.KShield;
                inventoryData[userId] = userInventory;
                await writeJsonFile(INVENTORY_FILE, inventoryData);
            } else {
                actionText = 'perdu';
                logActionType = 'PERDU';
                logReason = 'Défaite';
                pointsChange = -finalParsedPoints;
            }
        } else {
            actionText = 'gagné';
            logActionType = 'GAGNÉ';
            logReason = 'Victoire';
            if (userEffect && userEffect.type === "epee-du-kint" && new Date(userEffect.expiresAt).getTime() > Date.now()) {
                multiplier = 2;
                effectType = 'Épée du KINT ⚔️';
            }
            pointsChange = finalParsedPoints * multiplier;
        }

        const eventActive = await isEventActive();
        let eventBonusMalus = 0;
        if (eventActive) {
            if (logActionType === 'GAGNÉ') {
                eventBonusMalus = 30;
            } else if (logActionType === 'PERDU' && !wasProtectedByShield) {
                eventBonusMalus = -35;
            }
            pointsChange += eventBonusMalus;
        }
        
        pointsData[userId] = currentPoints + pointsChange;
        const finalBalance = pointsData[userId];
        
        await writeJsonFile(POINTS_FILE, pointsData);
        
        await addPointLog(userId, {
            date: new Date().toISOString(), source: 'Discord',
            actionType: logActionType, points: finalParsedPoints,
            currentBalance: finalBalance, reason: logReason, effect: effectType
        });
        
        let eventMessage = eventActive && eventBonusMalus !== 0
            ? `\n(${logActionType === 'GAGNÉ' ? 'BONUS' : 'MALUS'} EVENT RESET : **${eventBonusMalus > 0 ? `+${eventBonusMalus}` : eventBonusMalus}**)`
            : '';
        
        await interaction.editReply({
            content: wasProtectedByShield
                ? `🛡️ Tu as été protégé par ton KShield ! Tu ne perds aucun point. Tu as actuellement ${finalBalance} points !`
                : (actionText === 'gagné'
                    ? `🔥 T'es chaud ! Tu as gagné ${finalParsedPoints * multiplier} points${multiplier > 1 ? " (Épée du KINT ⚔️ x2)" : ""} !${eventMessage} Tu as actuellement ${finalBalance} points !`
                    : `🐒 Grosse merde ! Tu as perdu ${finalParsedPoints} points !${eventMessage} Tu as actuellement ${finalBalance} points !`)
        });
        
        // --- EMBED RESTAURÉ À L'IDENTIQUE DE VOTRE ORIGINAL ---
        const embedLog = new EmbedBuilder()
            .setTitle(`✅ Rapport KINT – ${interaction.user.username}`)
            .setColor(wasProtectedByShield ? 0x0099ff : (actionText === 'gagné' ? 0x00cc66 : 0xcc0000))
            .addFields(
                { name: '👤 Utilisateur', value: `<@${userId}>`, inline: false },
                { name: '📌 Action effectuée', value: `**${actionText.toUpperCase()}**`, inline: true },
                { name: '🏆 Points', value: `\`${finalParsedPoints * multiplier}\``, inline: true },
                { name: '🎯 Solde actuel', value: `\`${finalBalance}\``, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '✨ Effet actif', value: effectType, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'KINT — Créé par Kyû', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();
            
        if (eventBonusMalus !== 0) {
            embedLog.addFields({
                name: '🎉 Bonus/Malus d\'événement',
                value: `${eventBonusMalus > 0 ? `+${eventBonusMalus}` : eventBonusMalus} points ${eventBonusMalus > 0 ? '🎁' : '💥'}`,
                inline: true
            });
        }
        
        embedLog.addFields({ name: '🕒 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false });
        
        const logChannel1 = await interaction.client.channels.fetch(LOG_CHANNEL_ID_1).catch(() => null);
        if (logChannel1) await logChannel1.send({ embeds: [embedLog] });

        const logChannel2 = await interaction.client.channels.fetch(LOG_CHANNEL_ID_2).catch(() => null);
        if (logChannel2) await logChannel2.send({ embeds: [embedLog] });
    }
};