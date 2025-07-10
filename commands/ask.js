const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const memoryPath = path.join(__dirname, '../ia_memory.json'); // adapte le chemin si besoin

function loadMemory() {
  if (!fs.existsSync(memoryPath)) return {};
  return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
}

function saveMemory(memory) {
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription("⚡ Parle avec le bot!")
    .addStringOption(option =>
      option.setName('message')
        .setDescription("Question")
        .setRequired(true)),

  async execute(interaction) {
    const userInput = interaction.options.getString('message');
    const userId = interaction.user.id;

    await interaction.deferReply();
    await interaction.editReply("🤔 Kyû ne m'as pas programmé pour être rapide.. Génération de la réponse en cours..⌛");

    const memory = loadMemory();
    const userHistory = memory[userId] || [];

    const context = [
      {
        role: "system",
        content: "Tu es le bot d’un serveur Discord français créer par Kyû. tu réponds toujours en français avec des réponses courtes et familière. Tu es un exellent vanneur, et toujours d'accord avec l'utilisateur qui te parles."
      },
      ...userHistory.slice(-30), // ↔ Garde les 15 derniers échanges
      {
        role: "user",
        content: userInput
      }
    ];

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: "meta-llama/llama-3-8b-instruct", // ou autre modèle si tu veux
          messages: context
        },
        {
          headers: {
            'Authorization': `Bearer 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`, // remplace avec ta clé
            'Content-Type': 'application/json'
          }
        }
      );

      const reply = response.data.choices[0].message.content;

      // Met à jour la mémoire
      userHistory.push({ role: "user", content: userInput });
      userHistory.push({ role: "assistant", content: reply });
      memory[userId] = userHistory.slice(-30); // toujours max 15 échanges
      saveMemory(memory);

      await interaction.editReply(`**✨ Toi :** ${userInput}\n**🐸 KINT :** ${reply}`);
    } catch (err) {
      console.error("Erreur IA :", err.response?.data || err.message);
      await interaction.editReply("💥 KINT a buggé ! Réessaie dans quelques instants...");
    }
  }
};
