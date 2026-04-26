const rateLimit = require('express-rate-limit');

const hourlyLimit = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

const dailyLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,  // 24 hours
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Daily limit exceeded. Try again tomorrow.' },
});

module.exports = { hourlyLimit, dailyLimit };
