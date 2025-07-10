// routes/titre.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const TITLES_PATH = path.join(__dirname, '../titles.json');

function readTitles() {
  const raw = fs.readFileSync(TITLES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeTitles(data) {
  fs.writeFileSync(TITLES_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// GET - Récupérer titres
router.get('/titres/:userId', (req, res) => {
  const userId = req.params.userId;
  const titlesData = readTitles();

  if (!titlesData[userId]) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  return res.json({
    titresPossedes: titlesData[userId].list,
    titreActuel: titlesData[userId].equipped,
  });
});

// POST - Changer titre actif
router.post('/titres/:userId', express.json(), (req, res) => {
  const userId = req.params.userId;
  const { nouveauTitre } = req.body;

  if (!nouveauTitre) {
    return res.status(400).json({ error: 'Titre manquant.' });
  }

  const titlesData = readTitles();

  if (!titlesData[userId]) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  if (!titlesData[userId].list.includes(nouveauTitre)) {
    return res.status(400).json({ error: 'Titre non possédé par l’utilisateur.' });
  }

  titlesData[userId].equipped = nouveauTitre;
  writeTitles(titlesData);

  return res.json({ success: true, nouveauTitre });
});

module.exports = router;
