// routes/patchnote.js
const fs = require('fs');
const express = require('express');
const router = express.Router();

router.get('/patchnote', (req, res) => {
  const patchnotePath = './patchnote.json'; // Ajuster le chemin si besoin
  try {
    const data = fs.readFileSync(patchnotePath, 'utf8');
    const json = JSON.parse(data);
    res.json(json);
  } catch (error) {
    console.error('Erreur lecture patchnote:', error);
    res.status(500).json({ error: 'Erreur lecture patchnote' });
  }
});

module.exports = router;
