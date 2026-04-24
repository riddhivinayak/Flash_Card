const express = require('express');
const deckRoutes = require('./api/routes/decks');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/decks', deckRoutes);
  return app;
}

module.exports = createApp;
