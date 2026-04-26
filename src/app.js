const express = require('express');
const helmet = require('helmet');
const path = require('path');
const authRoutes = require('./api/routes/auth');
const deckRoutes = require('./api/routes/decks');
const reviewRoutes = require('./api/routes/reviews');
const auth = require('./api/middleware/auth');

const CLIENT_DIST = path.join(__dirname, '../../client/dist');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/decks', auth, deckRoutes);
  app.use('/api', auth, reviewRoutes);

  // Serve React frontend in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) =>
      res.sendFile(path.join(CLIENT_DIST, 'index.html'))
    );
  }

  // Global error handler — catches any unhandled throw in routes/controllers
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err.message);
    res.status(err.status || 500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = createApp;
