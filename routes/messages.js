// /routes/messages.js
const express = require('express');
const router = express.Router();

router.get('/messages/:userId', (req, res) => {
  const { userId } = req.params;

  // Génération aléatoire des messages sur 7 jours (exemple temporaire)
  const messagesLast7Days = Array.from({ length: 7 }, () => Math.floor(Math.random() * 20));

  res.json({
    userId,
    messagesLast7Days,
  });
});

module.exports = router;
