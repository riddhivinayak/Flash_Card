const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  cardId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  deckId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  quality:     { type: Number, min: 0, max: 5, required: true },
  userAnswer:  { type: String, default: '' },
  explanation: { type: String, default: null },
  memoryTip:   { type: String, default: null },
  reviewedAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Review', ReviewSchema);
