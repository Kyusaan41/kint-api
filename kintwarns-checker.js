const fs = require('fs');

const pointsPath = './points.json';
const warnsPath = './kintwarns.json';
const channelId = '1340723882256236626'; // ID du salon d'avertissements

async function checkKintWarns(client) {
  const warns = fs.existsSync(warnsPath) ? JSON.parse(fs.readFileSync(warnsPath)) : [];
  const points = fs.existsSync(pointsPath) ? JSON.parse(fs.readFileSync(pointsPath)) : {};

  const now = Math.floor(Date.now() / 1000);
  let modified = false;

  for (const warn of warns) {
    if (!warn.done && !warn.paid && now >= warn.deadline) {
      const userId = warn.userId;

      // 🟠 Déduction des points
      if (!points[userId]) points[userId] = 0;
      points[userId] -= 100;

      // 🟠 Modifier le message d’avertissement
      try {
        const channel = await client.channels.fetch(channelId);
        const msg = await channel.messages.fetch(warn.messageId);

        await msg.edit(`❌ <@${userId}> \n⏱️ **Temps écoulé !**\nVous avez été sanctionné : **-100 points**.`);
      } catch (err) {
        console.error(`⚠️ Erreur lors de la modification du message pour ${userId} :`, err.message);
      }

      // 🟠 Marquer comme traité
      warn.done = true;
      modified = true;

      console.log(`-100 points pour ${userId} (KINT non payé à temps)`);
    }
  }

  if (modified) {
    fs.writeFileSync(pointsPath, JSON.stringify(points, null, 2));
    fs.writeFileSync(warnsPath, JSON.stringify(warns, null, 2));
  }
}

module.exports = { checkKintWarns };
