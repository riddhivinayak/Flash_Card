const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema(
  {
    deckId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
    type:       { type: String, enum: ['definition', 'concept', 'example', 'edge_case'], required: true },
    concept:    { type: String, required: true },
    front:      { type: String, required: true },
    back:       { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    tags:       [String],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Card', CardSchema);
