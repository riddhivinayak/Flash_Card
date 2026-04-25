const mongoose = require('mongoose');
const Deck = require('../../db/models/Deck');
const Review = require('../../db/models/Review');
const CardProgress = require('../../db/models/CardProgress');

async function getAnalytics(req, res) {
  let deckObjId;
  try {
    deckObjId = new mongoose.Types.ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'Invalid deck id' });
  }

  const deck = await Deck.findOne({ _id: deckObjId, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const userObjId = new mongoose.Types.ObjectId(req.userId);

  const reviewStats = await Review.aggregate([
    { $match: { deckId: deckObjId, userId: userObjId } },
    {
      $lookup: {
        from: 'cards',
        localField: 'cardId',
        foreignField: '_id',
        as: 'card',
      },
    },
    { $unwind: '$card' },
    {
      $group: {
        _id: '$card.concept',
        totalReviews:  { $sum: 1 },
        correctCount:  { $sum: { $cond: [{ $gte: ['$quality', 3] }, 1, 0] } },
        qualitySum:    { $sum: '$quality' },
      },
    },
    {
      $addFields: {
        incorrectCount: { $subtract: ['$totalReviews', '$correctCount'] },
        accuracyRate:   { $divide: ['$correctCount', '$totalReviews'] },
        avgQuality:     { $divide: ['$qualitySum', '$totalReviews'] },
      },
    },
    { $project: { qualitySum: 0 } },
    { $sort: { accuracyRate: 1 } },
  ]);

  const statusStats = await CardProgress.aggregate([
    {
      $lookup: {
        from: 'cards',
        localField: 'cardId',
        foreignField: '_id',
        as: 'card',
      },
    },
    { $unwind: '$card' },
    { $match: { 'card.deckId': deckObjId } },
    {
      $group: {
        _id:           '$card.concept',
        newCount:      { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
        learningCount: { $sum: { $cond: [{ $eq: ['$status', 'learning'] }, 1, 0] } },
        masteredCount: { $sum: { $cond: [{ $eq: ['$status', 'mastered'] }, 1, 0] } },
      },
    },
  ]);

  const statusMap = Object.fromEntries(statusStats.map(s => [s._id, s]));

  if (!reviewStats.length) {
    const concepts = statusStats.map(s => ({
      concept: s._id,
      totalReviews: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracyRate: null,
      avgQuality: null,
      newCount: s.newCount,
      learningCount: s.learningCount,
      masteredCount: s.masteredCount,
    }));
    return res.json({ concepts, hasReviews: false });
  }

  const concepts = reviewStats.map(r => {
    const s = statusMap[r._id] || {};
    return {
      concept:        r._id,
      totalReviews:   r.totalReviews,
      correctCount:   r.correctCount,
      incorrectCount: r.incorrectCount,
      accuracyRate:   parseFloat(r.accuracyRate.toFixed(3)),
      avgQuality:     parseFloat(r.avgQuality.toFixed(2)),
      newCount:       s.newCount      ?? 0,
      learningCount:  s.learningCount ?? 0,
      masteredCount:  s.masteredCount ?? 0,
    };
  });

  res.json({ concepts, hasReviews: true });
}

module.exports = { getAnalytics };
