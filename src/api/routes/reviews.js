const express = require('express');
const { getReviewSession, submitReview } = require('../controllers/reviewController');
const { getAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/decks/:id/review', getReviewSession);
router.get('/decks/:id/analytics', getAnalytics);
router.post('/reviews', submitReview);


router.get('/list-models', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    const body = await apiRes.json();
    if (!apiRes.ok) return res.status(apiRes.status).json({ ok: false, full: body });

    const generateContentModels = (body.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ name: m.name, displayName: m.displayName }));

    res.json({ generateContentModels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/test-gemini', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  try {
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Explain SQL IN operator in one sentence.' }] }] }),
    });
    const body = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ ok: false, status: apiRes.status, error: body?.error?.message, full: body });
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty)';
    res.json({ ok: true, model: 'gemini-2.5-flash', response: text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
