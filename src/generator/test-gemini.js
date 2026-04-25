/**
 * Quick Gemini API smoke test.
 * Run with: node src/generator/test-gemini.js
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('ERROR: GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }

  console.log('Testing Gemini API...\n');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel(
    { model: 'gemini-1.5-flash' },
    { apiVersion: 'v1' }
  );

  try {
    const result = await model.generateContent('Explain SQL IN operator in one sentence.');
    const text = result.response.text();
    console.log('SUCCESS — Gemini response:');
    console.log(text);
  } catch (err) {
    console.error('FAILED — Gemini API error:');
    console.error(err.message);
    if (err.status) console.error('HTTP status:', err.status);
  }
}

main();
