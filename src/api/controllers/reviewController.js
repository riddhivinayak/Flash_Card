const Card = require('../../db/models/Card');
const Deck = require('../../db/models/Deck');
const CardProgress = require('../../db/models/CardProgress');
const Review = require('../../db/models/Review');
const { sm2 } = require('../../scheduler/sm2');
const { explain } = require('../../explainer');

async function getReviewSession(req, res) {
  const { id: deckId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const deck = await Deck.findOne({ _id: deckId, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const now = new Date();
  const deckCards = await Card.find({ deckId }).select('_id');
  const cardIds = deckCards.map(c => c._id);

  const eligible = await CardProgress.find({
    cardId: { $in: cardIds },
    $or: [
      { status: 'new' },
      { status: { $in: ['learning', 'mastered'] }, nextReviewDate: { $lte: now } },
    ],
  }).populate('cardId');

  const valid = eligible.filter(p => p.cardId);
  const dueProgress = valid.filter(p => p.status !== 'new');
  const newProgress = valid.filter(p => p.status === 'new');
  const dueTodayCount = dueProgress.length;

  const dueSlots = Math.min(dueProgress.length, Math.floor(limit * 0.8));
  const newSlots = Math.min(newProgress.length, limit - dueSlots);

  const selected = [
    ...dueProgress.slice(0, dueSlots),
    ...newProgress.slice(0, newSlots),
  ];

  const cards = selected.map(p => ({
    progressId: p._id,
    card: p.cardId,
    status: p.status,
    nextReviewDate: p.nextReviewDate,
  }));

  res.json({ cards, dueTodayCount });
}

async function submitReview(req, res) {
  const { cardId, quality, userAnswer = '' } = req.body;

  if (cardId === undefined || quality === undefined) {
    return res.status(400).json({ error: 'cardId and quality are required' });
  }
  if (quality < 0 || quality > 5) {
    return res.status(400).json({ error: 'quality must be between 0 and 5' });
  }

  const card = await Card.findById(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const deck = await Deck.findOne({ _id: card.deckId, userId: req.userId });
  if (!deck) return res.status(403).json({ error: 'Not authorised' });

  const progress = await CardProgress.findOne({ cardId });
  if (!progress) return res.status(404).json({ error: 'CardProgress not found' });

  const result = sm2(progress.easeFactor, progress.interval, progress.repetitions, quality);

  let status = 'learning';
  if (result.repetitions >= 5 && quality >= 4) status = 'mastered';

  await CardProgress.findByIdAndUpdate(
    progress._id,
    { $set: { ...result, status, lastReviewDate: new Date() } },
    { runValidators: true }
  );

  let explanation = null;
  let memoryTip = null;
  if (quality < 3) {
    ({ explanation, memoryTip } = await explain(card, userAnswer));
  }

  const review = await Review.create({
    userId: req.userId,
    cardId,
    deckId: card.deckId,
    quality,
    userAnswer,
    explanation,
    memoryTip,
  });

  res.status(201).json({ review, progress: { ...result, status } });
}

module.exports = { getReviewSession, submitReview };
