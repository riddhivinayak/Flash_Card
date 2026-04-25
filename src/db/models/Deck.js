const mongoose = require('mongoose');

const DeckSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:      { type: String, required: true },
    sourceFile: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Deck', DeckSchema);
