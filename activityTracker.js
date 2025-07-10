const fs = require('fs');
const path = require('path');
const DAILY_FILE = path.join(__dirname, './daily_activity.json');

function loadDailyData() {
  return fs.existsSync(DAILY_FILE)
    ? JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8'))
    : {};
}

function saveDailyData(data) {
  fs.writeFileSync(DAILY_FILE, JSON.stringify(data, null, 2));
}

function updateDailyStreak(userId, client, checkAchievements) {
  const data = loadDailyData();
  const today = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD

  if (!data[userId]) {
    data[userId] = { lastDate: today, streak: 1 };
  } else {
    const last = data[userId].lastDate;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (last === today) return; // déjà compté aujourd'hui
    else if (last === yesterday) data[userId].streak += 1;
    else data[userId].streak = 1;

    data[userId].lastDate = today;
  }

  // Vérification du succès
  if (data[userId].streak === 7) {
    checkAchievements(userId, client);
  }

  saveDailyData(data);
}

module.exports = { updateDailyStreak };
