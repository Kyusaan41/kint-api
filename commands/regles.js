const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const reglesEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Règlement du KINT 🐒')
    .setDescription('🗒️ Règlement pour l\'attribution des Kint Points basés sur les performances en jeu.')
    .addFields(
        {
            name: 'En Général 🌍',
            value: `- **Le INT ne se limite pas au KDA** : Cela inclut aussi les actions comme la collecte d'informations, le shotcalling, etc.
- **Le score est basé à 80 % sur les impressions de jeu**, et le site [DPM.LOL](http://dpm.lol/) est utilisé pour départager les joueurs.`,
            inline: false
        },
        {
            name: 'En cas de Victoire ✅',
            value: `- Tous les participants gagnent des points affichés sur **DPM.LOL**.
- **Un joueur peut perdre des points** s'il a mal joué malgré la victoire.
- Cette règle ne s'applique pas si **tous les joueurs ont joué correctement** (*à vérifier en jeu*).`,
            inline: true
        },
        {
            name: 'En cas de Défaite ❌',
            value: `- **Le MVP 👑** gagne des points.
- **Les fautifs** perdent des points (*maximum 2 fautifs par défaite*).
- **Les fautifs prennent le score du MVP** comme malus.
- **Le MVP peut être contester par l\'ensemble des participant de la game si il n\'est pas mérité.** `,    
            inline: true
        },
        {
            name: 'Exemple :',
            value: `- Si **Joueur 1 👑** a 88 points et **Joueur 2 🐵** a 23 points, **Joueur 2 🐵** est considéré comme fautif.
- Le fautif perd alors le **score du MVP 👑** soit **88 points**.`,
            inline: false
        },
        {
            name: 'Cas Spécifiques ✨',
            value: `- **Le INT** est évalué sur plusieurs aspects du jeu :
  - **KDA** (*Kills, Deaths, Assists*) 
  - **Collecte d'informations** 
  - **Shotcalling** (*prise de décisions stratégiques*)
- L'évaluation est effectuée **par le groupe** et **confirmée par le score DPM.LOL**.`,
            inline: false
        },
        {
            name: 'Récapitulatif :',
            value: `- **Victoire ✅ :** Tout le monde gagne des points sauf les fautifs potentiels.
- **Défaite ❌ :** Le MVP 👑 gagne des points, les fautifs perdent les points équivalents au score du MVP.
- **Désignation des Fautifs :** Maximum 2 par défaite, basés sur le score et l'opinion du groupe.`,
            inline: false
        },
        {
            name: 'Sous Règles 🐸 :',
            value: `-**En cas d'AFK** 💀 : Les fautifs paient moitié moins le score qu'ils devaient payer.
   -Il est possible d'avoir qu'un seul fautif (0/14) qui int la game. Il paiera le double car il est le seul à **INT** (*très situationnel*)\n
	-Le 5 ème joueur (random) lors d'une game à 4 est automatiquement comptabilisé. (*Si le random et un participant à int, il n'y aura plus qu'un fautif*)\n
        -Un dodge coûte **50 KIP.**`,
            inline: false
        },
    )
    .addFields(
        {
            name: 'Informations supplémentaires :',
            value: `**Pour afficher toutes les commandes disponibles, utilisez** \`/help\` ✅`,
            inline: false
        }
    )
    .setImage("https://media1.tenor.com/m/bOcoT4nn3noAAAAd/alistar-league-of-legends.gif")

    .setFooter({ text: 'Mini-jeu KINT créé par Kuro / Dév par Kyû. ✨' });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regles')
        .setDescription('Le KINT C\'est quoi ?'),
        
    async execute(interaction) {
        await interaction.reply({ embeds: [reglesEmbed] });
    }
};
