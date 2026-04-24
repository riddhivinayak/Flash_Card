const mongoose = require('mongoose');

const CardProgressSchema = new mongoose.Schema({
  cardId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  easeFactor:     { type: Number, default: 2.5 },
  interval:       { type: Number, default: 1 },
  repetitions:    { type: Number, default: 0 },
  status:         { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
  nextReviewDate: { type: Date, default: Date.now },
  lastReviewDate: { type: Date, default: null },
});

module.exports = mongoose.model('CardProgress', CardProgressSchema);
