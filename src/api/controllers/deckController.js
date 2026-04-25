const Deck = require('../../db/models/Deck');
const Card = require('../../db/models/Card');
const CardProgress = require('../../db/models/CardProgress');
const { extractText, chunkText } = require('../../pdf/extractor');
const { generateCards } = require('../../generator');

async function uploadDeck(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

  let text;
  try {
    text = await extractText(req.file.buffer);
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

  res.status(201).json({ deck, cardCount: cards.length });
}

async function listDecks(req, res) {
  const decks = await Deck.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(decks);
}

async function getDeck(req, res) {
  const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  const cardCount = await Card.countDocuments({ deckId: deck._id });
  res.json({ ...deck.toObject(), cardCount });
}

module.exports = { uploadDeck, listDecks, getDeck };
