const mongoose = require('mongoose');
const Deck = require('../../db/models/Deck');
const Card = require('../../db/models/Card');
const CardProgress = require('../../db/models/CardProgress');
const Review = require('../../db/models/Review');
const { extractText, chunkText } = require('../../pdf/extractor');
const { generateCards } = require('../../generator');

async function uploadDeck(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

  let text, pageCount, truncated;
  try {
    ({ text, pageCount, truncated } = await extractText(req.file.buffer));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const chunks = chunkText(text);
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  const generated = await generateCards(chunks, totalWords);

  if (!generated.length) {
    return res.status(422).json({ error: 'No cards could be generated from this PDF' });
  }

  const deck = await Deck.create({
    userId: req.userId,
    title: req.body.title || req.file.originalname.replace(/\.pdf$/i, ''),
    sourceFile: req.file.originalname,
  });

  const cards = await Card.insertMany(generated.map(c => ({ ...c, deckId: deck._id })));
  await CardProgress.insertMany(cards.map(card => ({ cardId: card._id, nextReviewDate: new Date() })));

  const warning = truncated
    ? `This PDF has ${pageCount} pages — only the first 25 were processed.`
    : null;

  res.status(201).json({ deck, cardCount: cards.length, warning });
}

async function listDecks(req, res) {
  const decks = await Deck.find({ userId: req.userId }).sort({ createdAt: -1 });
  const userObjId = new mongoose.Types.ObjectId(req.userId);
  const now = new Date();

  const enriched = await Promise.all(decks.map(async (deck) => {
    const cardIds = await Card.find({ deckId: deck._id }).distinct('_id');

    const [dueCount, reviewStats] = await Promise.all([
      CardProgress.countDocuments({
        cardId: { $in: cardIds },
        $or: [
          { status: 'new' },
          { status: { $in: ['learning', 'mastered'] }, nextReviewDate: { $lte: now } },
        ],
      }),
      Review.aggregate([
        { $match: { deckId: deck._id, userId: userObjId } },
        { $group: {
          _id: null,
          total:   { $sum: 1 },
          correct: { $sum: { $cond: [{ $gte: ['$quality', 3] }, 1, 0] } },
        }},
      ]),
    ]);

    const accuracyRate = reviewStats.length
      ? parseFloat((reviewStats[0].correct / reviewStats[0].total).toFixed(2))
      : null;

    return { ...deck.toObject(), cardCount: cardIds.length, dueCount, accuracyRate };
  }));

  res.json(enriched);
}

async function getDeck(req, res) {
  const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const cardIds = await Card.find({ deckId: deck._id }).distinct('_id');
  const dueCount = await CardProgress.countDocuments({
    cardId: { $in: cardIds },
    $or: [
      { status: 'new' },
      { status: { $in: ['learning', 'mastered'] }, nextReviewDate: { $lte: new Date() } },
    ],
  });

  res.json({ ...deck.toObject(), cardCount: cardIds.length, dueCount });
}

async function getDeckCards(req, res) {
  const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const cards = await Card.find({ deckId: deck._id }).sort({ createdAt: 1 });
  res.json(cards);
}

async function deleteDeck(req, res) {
  const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const cards = await Card.find({ deckId: deck._id }).distinct('_id');
  await CardProgress.deleteMany({ cardId: { $in: cards } });
  await Review.deleteMany({ deckId: deck._id });
  await Card.deleteMany({ deckId: deck._id });
  await Deck.deleteOne({ _id: deck._id });

  res.json({ ok: true });
}

module.exports = { uploadDeck, listDecks, getDeck, getDeckCards, deleteDeck };
