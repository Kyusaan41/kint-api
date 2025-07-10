const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aide')
        .setDescription("📜 Affiche la liste des commandes disponibles."),

    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📚 Commandes disponibles')
            .setDescription("Voici toutes les commandes disponibles !\nUtilise `/commande` pour les exécuter.\n\n🔹 **Catégories :** Jeu, Économie, Utilitaires, Profil & Succès.")
            .setColor(0x00AAFF)
            .addFields(
                {
                    name: '🎮 ───────  Système de Jeu  ───────',
                    value:
                        '`/kint` — 🎲 Joue et gagnes/perds des points.\n' +
                        '`/classement-kint` — 🏆 Classement des joueurs du KINT.\n' +
                        '`/intercheck @user` — 🔍 Vérifie les actions douteuses d’un joueur.\n' +
                        '`/regles` — 📢 Affiche les règles du KINT.\n' +
                        '`/kintstats` — 📊 Statistiques générales et INTER actuel.'
                },
                {
                    name: '💰 ───────  Économie  ───────',
                    value:
                        '`/journalier` — 🎁 Récupère ta récompense quotidienne.\n' +
                        '`/argent` — 💰 Consulte ton solde.\n' +
                        '`/paie @user montant` — 🔄 Envoie de l\'argent à un autre joueur.\n' +
                        '`/boutique` — 🛒 Affiche les objets à vendre.\n' +
                        '`/inventaire` — 📦 Affiche tes objets possédés.\n' +
                        '`/classement-argent` — 💸 Les joueurs les plus riches.\n' +
                        '`/utilise` — ⚡ Utilise un objet acheté.\n' +
                        '`/lotterie` — 💳 Liste des participants à la loterie.'
                },
                {
                    name: '⚙️ ───────  Utilitaires  ───────',
                    value:
                        '`/aide` — 📜 Affiche cette liste.\n' +
                        '`/feedback` — 📝 Envoie une suggestion au dev.\n' +
                        '`/question` — 🤖 Pose une question à l\'IA.\n' +
                        '`/sondage` — 📊 Crée un sondage simple.\n' +
                        '`/support` — 🛟 Obtiens de l’aide ou contacte un membre du staff.'
                },
                {
                    name: '👤 ───────  Profil & Succès  ───────',
                    value:
                        '`/profile` — 🧾 Ton profil : rang, solde, inventaire.\n' +
                        '`/succès` — 🏅 Succès débloqués.\n' +
                        '`/kip` — 🎯 Total de tes points KIP.\n' +
                        '`/classement-serveur` — ⬆️ Classement des plus actifs.\n' +
                        '`/titre` — 🌸 Liste de tes titres débloqués.'
                }
            )
            .setFooter({ text: "🤖 Développé par Kyû | Utilise /feedback pour nous aider à nous améliorer." });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
};
