const express = require('express');
const deckRoutes = require('./api/routes/decks');
const reviewRoutes = require('./api/routes/reviews');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/decks', deckRoutes);
  app.use('/api', reviewRoutes);
  return app;
}

module.exports = createApp;
