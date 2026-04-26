const express = require('express');
const helmet = require('helmet');
const authRoutes = require('./api/routes/auth');
const deckRoutes = require('./api/routes/decks');
const reviewRoutes = require('./api/routes/reviews');
const auth = require('./api/middleware/auth');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/decks', auth, deckRoutes);
  app.use('/api', auth, reviewRoutes);

  // Global error handler — catches any unhandled throw in routes/controllers
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err.message);
    res.status(err.status || 500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = createApp;
