const mongoose = require('mongoose');

const DeckSchema = new mongoose.Schema(
  { title: { type: String, required: true }, sourceFile: { type: String, required: true } },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Deck', DeckSchema);
