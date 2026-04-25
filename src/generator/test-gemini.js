/**
 * Quick Gemini REST smoke test.
 * Run with: node src/generator/test-gemini.js
 */
require('dotenv').config();

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('ERROR: GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  console.log('Testing Gemini REST API...\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Explain SQL IN operator in one sentence.' }] }] }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error('FAILED — HTTP', res.status);
    console.error('Full response body:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty)';
  console.log('SUCCESS — Gemini response:');
  console.log(text);
}

main();
