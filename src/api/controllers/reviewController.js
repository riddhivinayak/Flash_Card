const Card = require('../../db/models/Card');
const CardProgress = require('../../db/models/CardProgress');
const Review = require('../../db/models/Review');
const { sm2 } = require('../../scheduler/sm2');

async function getReviewSession(req, res) {
  const { id: deckId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const now = new Date();

  const deckCards = await Card.find({ deckId }).select('_id');
  const cardIds = deckCards.map(c => c._id);

  // Single query: new cards always eligible; learning/mastered only if due
  const eligible = await CardProgress.find({
    cardId: { $in: cardIds },
    $or: [
      { status: 'new' },
      { status: { $in: ['learning', 'mastered'] }, nextReviewDate: { $lte: now } },
    ],
  }).populate('cardId');

  // Filter out orphaned progress docs (card deleted after generation)
  const valid = eligible.filter(p => p.cardId);

  const dueProgress = valid.filter(p => p.status !== 'new');
  const newProgress = valid.filter(p => p.status === 'new');
  const dueTodayCount = dueProgress.length;

  // Mix: up to 80% due cards, fill remaining slots with new cards
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

  const progress = await CardProgress.findOne({ cardId });
  if (!progress) return res.status(404).json({ error: 'CardProgress not found' });

  // Run SM-2
  const result = sm2(
    progress.easeFactor,
    progress.interval,
    progress.repetitions,
    quality
  );

  // Determine new status
  let status = 'learning';
  if (result.repetitions >= 5 && quality >= 4) status = 'mastered';

  await CardProgress.findByIdAndUpdate(progress._id, {
    ...result,
    status,
    lastReviewDate: new Date(),
  });

  const review = await Review.create({
    cardId,
    deckId: card.deckId,
    quality,
    userAnswer,
  });

  res.status(201).json({ review, progress: { ...result, status } });
}

module.exports = { getReviewSession, submitReview };
