const express = require('express');
const { getReviewSession, submitReview } = require('../controllers/reviewController');
const { getAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/decks/:id/review', getReviewSession);
router.get('/decks/:id/analytics', getAnalytics);
router.post('/reviews', submitReview);

module.exports = router;
