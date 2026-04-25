const express = require('express');
const multer = require('multer');
const { uploadDeck, listDecks, getDeck, getDeckCards } = require('../controllers/deckController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/upload', upload.single('pdf'), uploadDeck);
router.get('/', listDecks);
router.get('/:id', getDeck);
router.get('/:id/cards', getDeckCards);

module.exports = router;
