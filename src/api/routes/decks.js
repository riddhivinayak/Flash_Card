const express = require('express');
const multer = require('multer');
const { uploadDeck, listDecks, getDeck, getDeckCards, deleteDeck } = require('../controllers/deckController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// Wrap multer so validation errors return JSON instead of crashing
function handleUploadMiddleware(req, res, next) {
  upload.single('pdf')(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Invalid file.' });
    }
    next();
  });
}

router.post('/upload', handleUploadMiddleware, uploadDeck);
router.get('/', listDecks);
router.get('/:id', getDeck);
router.get('/:id/cards', getDeckCards);
router.delete('/:id', deleteDeck);

module.exports = router;
