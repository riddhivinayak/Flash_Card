const express = require('express');
const { getReviewSession, submitReview } = require('../controllers/reviewController');

const router = express.Router();

router.get('/decks/:id/review', getReviewSession);
router.post('/reviews', submitReview);

module.exports = router;
