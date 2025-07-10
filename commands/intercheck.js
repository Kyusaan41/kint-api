const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const RIOT_API_KEY = 'RGAPI-eb094ee2-39e0-40d7-ae5b-fdf999e2562e'; 
const REGION = 'europe';
const PLATFORM = 'euw1';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('intercheck')
        .setDescription("🐵 Analyse un joueur pour détecter s'il a intentionnellement ruiné une partie.")
        .addStringOption(option => 
            option.setName('joueur')
                .setDescription("Le pseudo du joueur à analyser (ex: Pseudo#TAG)")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply(); 

        const userInput = interaction.options.getString('joueur');
        const [gameName, tagLine] = userInput.split('#');
        
        try {
            const accountResponse = await axios.get(`https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, {
                headers: { 'X-Riot-Token': RIOT_API_KEY }
            });
            const puuid = accountResponse.data.puuid;

            const summonerResponse = await axios.get(`https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
                headers: { 'X-Riot-Token': RIOT_API_KEY }
            });

            const matchesResponse = await axios.get(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`, {
                headers: { 'X-Riot-Token': RIOT_API_KEY }
            });

            if (matchesResponse.data.length === 0) {
                return interaction.editReply("❌ Aucun match trouvé pour ce joueur.");
            }

            const matchId = matchesResponse.data[0];
            const matchData = await axios.get(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
                headers: { 'X-Riot-Token': RIOT_API_KEY }
            });

            const match = matchData.data;
            const playerData = match.info.participants.find(p => p.puuid === puuid);
            const teamPlayers = match.info.participants.filter(p => p.teamId === playerData.teamId);
            const gameMode = match.info.gameMode;

            if (!playerData) {
                return interaction.editReply("❌ Impossible de récupérer les données du joueur.");
            }

            // Statistiques détaillées
            const stats = {
                deaths: playerData.deaths,
                KDA: `${playerData.kills} / ${playerData.deaths} / ${playerData.assists}`,
                visionScore: playerData.visionScore,
                csPerMin: ((playerData.totalMinionsKilled + playerData.neutralMinionsKilled) / (match.info.gameDuration / 60)).toFixed(1),
                participationKill: ((playerData.kills + playerData.assists) / playerData.challenges.killsParticipation).toFixed(1),
                damageDealt: playerData.totalDamageDealtToChampions,
                damageTaken: playerData.totalDamageTaken,
                championName: playerData.championName,
                championIcon: `https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${playerData.championName}.png`,
                timeSpentDead: playerData.totalTimeSpentDead
            };

            // Détection avancée de l'intentionnalité
            let ips = 0;
            if (stats.deaths > 10) ips += 30;
            if (stats.csPerMin < 3) ips += 20;
            if (stats.visionScore < 10) ips += 15;
            if (stats.participationKill < 20) ips += 20;
            if (stats.damageDealt < stats.damageTaken * 0.6) ips += 25;
            if (stats.timeSpentDead > match.info.gameDuration * 0.3) ips += 20;
            
            let status = "✅ Aucun comportement suspect détecté";
            if (ips >= 50) status = "⚠️ **Alerte de comportement suspect !**";
            if (ips >= 75) status = "🚨 **ALERTE INT DETECTÉE !** 🚨";

            const embed = new EmbedBuilder()
                .setTitle(`🕵️ Rapport d'analyse pour ${userInput}`)
                .setColor(ips >= 50 ? 0xFF0000 : 0x2ECC71)
                .setDescription(status)
                .addFields(
                    { name: "☠️ Morts", value: `${stats.deaths} 💀`, inline: true },
                    { name: "📊 KDA", value: stats.KDA, inline: true },
                    { name: "🔮 Score de vision", value: `${stats.visionScore}`, inline: true },
                    { name: "🌾 CS/min", value: stats.csPerMin, inline: true },
                    { name: "⚔️ Participation aux kills", value: `${stats.participationKill}%`, inline: true },
                    { name: "💥 Dégâts infligés", value: `${stats.damageDealt} 🗡️`, inline: true },
                    { name: "🩸 Dégâts subis", value: `${stats.damageTaken} 🛡️`, inline: true },
                    { name: "⏳ Temps mort cumulé", value: `${stats.timeSpentDead} sec`, inline: true },
                    { name: "🎭 Champion joué", value: `[${stats.championName}](https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${stats.championName}.png)`, inline: true },
                    { name: "🎮 Mode de jeu", value: gameMode, inline: true }
                )
                .setThumbnail(stats.championIcon)
                .setFooter({ text: "Inter Detector - Analyse des joueurs suspects by Kyû" });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Erreur lors de la récupération des données Riot Games:", error);
            await interaction.editReply({ content: "❌ Impossible de récupérer les données du joueur." });
        }
    }
};
