require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');


const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`Déploiement de ${commands.length} commandes...`);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID), // Remplace par ton ID de bot
            { body: commands }
        );

        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error(error);
    }
})();
