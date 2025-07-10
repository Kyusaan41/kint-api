const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const path = require('path');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const WELCOME_CHANNEL_ID = "1252729004360859751";
const LEAVE_CHANNEL_ID = "1252729004360859751";

const welcomeBackground = path.join(__dirname, 'welcome_bg.png');
const leaveBackground = path.join(__dirname, 'leave_bg.png');

// Fonction de génération d’image
async function generateImage(member, type = "welcome") {
    try {
        const canvas = Canvas.createCanvas(1000, 400);
        const ctx = canvas.getContext('2d');

        // Chargement du fond
        const backgroundPath = type === "welcome" ? welcomeBackground : leaveBackground;
        const background = await Canvas.loadImage(backgroundPath);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Cercle d’avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(200, 200, 100, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatarURL = member.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });
        const avatar = await Canvas.loadImage(avatarURL);
        ctx.drawImage(avatar, 100, 100, 200, 200);
        ctx.restore();

        // Texte principal
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 70px Arial Black";
        ctx.fillText(type === "welcome" ? "WELCOME" : "CIAO !", 330, 90);

        // Pseudo
        ctx.font = 'bold 40px Sans';
        ctx.fillText(member.user.username, 330, 160);

        // Discrim
        ctx.font = '30px Sans';
        ctx.fillStyle = '#cccccc';
        ctx.fillText("#" + member.user.discriminator, 330, 200);

        // Message personnalisé
        ctx.font = '28px Sans';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(
            type === "welcome"
                ? `Bienvenue sur le serveur, espèce de dégénéré.`
                : `Un clochard de moins...`,
            330,
            260
        );

        // Nombre de membres
        ctx.font = "bold 26px Sans";
        ctx.fillStyle = '#999999';
        ctx.fillText(`Nous sommes maintenant ${member.guild.memberCount} membres`, 330, 320);

        return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `${type}.png` });
    } catch (error) {
        console.error(`Erreur lors de la génération de l'image (${type}) :`, error);
        throw error;
    }
}

// Nouvel utilisateur
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!channel) {
            console.error("Canal de bienvenue introuvable.");
            return;
        }

        const image = await generateImage(member, "welcome");
        await channel.send({ content: `Bienvenue <@${member.id}> !`, files: [image] });
    } catch (error) {
        console.error("Erreur lors de l'envoi du message de bienvenue :", error);
    }
});

// Départ utilisateur
client.on('guildMemberRemove', async (member) => {
    try {
        console.log(`${member.user?.tag || member.id} a quitté le serveur.`);

        const channel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
        if (!channel) {
            console.error("Canal de départ introuvable.");
            return;
        }

        const image = await generateImage(member, "leave");
        await channel.send({ content: `Nique ta mère <@${member.id}> !`, files: [image] });
    } catch (error) {
        console.error("Erreur lors de l'envoi du message de départ :", error);
    }
});

client.login(process.env.BOT_TOKEN);
