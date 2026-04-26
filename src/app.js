const express = require('express');
const authRoutes = require('./api/routes/auth');
const deckRoutes = require('./api/routes/decks');
const reviewRoutes = require('./api/routes/reviews');
const auth = require('./api/middleware/auth');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/decks', auth, deckRoutes);
  app.use('/api', auth, reviewRoutes);

  return app;
}

module.exports = createApp;
