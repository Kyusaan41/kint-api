const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const XP_FILE = path.join(__dirname, '../xp.json');

async function readXPFile() {
  try {
    const data = await fs.readFile(XP_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeXPFile(data) {
  await fs.writeFile(XP_FILE, JSON.stringify(data, null, 2));
}

// GET XP d'un utilisateur
router.get('/:userId', async (req, res) => {
  try {
    const xpData = await readXPFile();
    const userXP = xpData[req.params.userId] || { xp: 0 };
    res.json(userXP);
  } catch (err) {
    console.error('GET xp error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST modifier XP d'un utilisateur
router.post('/:userId', async (req, res) => {
  const { xp } = req.body;
  if (typeof xp !== 'number' || xp < 0) {
    return res.status(400).json({ error: "XP doit être un nombre positif." });
  }

  try {
    const xpData = await readXPFile();
    xpData[req.params.userId] = { xp };
    await writeXPFile(xpData);

    console.log('XP POST', req.params.userId, { xp });

    res.json({ success: true, userId: req.params.userId, xp });
  } catch (err) {
    console.error('POST xp error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET classement global XP trié décroissant
router.get('/', async (req, res) => {
  try {
    const xpData = await readXPFile();

    const leaderboard = Object.entries(xpData).map(([userId, data]) => ({
      userId,
      xp: data.xp || 0,
    }));

    leaderboard.sort((a, b) => b.xp - a.xp);

    res.json(leaderboard);
  } catch (err) {
    console.error('GET xp leaderboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
