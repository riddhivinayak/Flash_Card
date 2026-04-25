const useMock = !process.env.GEMINI_API_KEY;

if (useMock) {
  console.warn('[generator] GEMINI_API_KEY not set — using mock card generator');
}

const SYSTEM_PROMPT = `You are a flashcard generator. Given text, output ONLY a valid JSON array of flashcard objects.

Each object must have exactly these fields:
- "type": one of "definition", "concept", "example", "edge_case"
- "concept": short topic label (e.g. "binary search", "Big O notation")
- "front": the question or prompt
- "back": the answer
- "difficulty": one of "easy", "medium", "hard"

Rules:
- Generate at most 8 cards per chunk
- Only use content explicitly present in the text
- Output raw JSON array only — no markdown, no explanation`;

function mockGenerateCardsFromChunk(chunk) {
  const words = chunk.split(/\s+/).filter(Boolean);
  const topic = words.slice(0, 3).join(' ');
  return [
    { type: 'definition', concept: topic, front: `What is "${topic}"?`, back: `A concept from the uploaded PDF related to: ${topic}.`, difficulty: 'easy' },
    { type: 'concept',    concept: topic, front: `Explain the key idea behind "${topic}".`, back: `The key idea is derived from: ${words.slice(0, 10).join(' ')}.`, difficulty: 'medium' },
    { type: 'example',    concept: topic, front: `Give an example of "${topic}".`, back: `Example: ${words.slice(10, 20).join(' ') || topic}.`, difficulty: 'medium' },
    { type: 'edge_case',  concept: topic, front: `What is an edge case for "${topic}"?`, back: `Edge case: when input is empty or boundary conditions apply to ${topic}.`, difficulty: 'hard' },
  ];
}

async function generateCardsFromChunk(chunk) {
  if (useMock) return mockGenerateCardsFromChunk(chunk);

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  try {
    const result = await model.generateContent(`Text:\n${chunk}`);
    const raw = result.response.text();

    console.log('[generator] raw Gemini output:', raw);

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[generator] no JSON array found in Gemini response:', cleaned);
      console.warn('[generator] falling back to mock for this chunk');
      return mockGenerateCardsFromChunk(chunk);
    }

    let cards;
    try {
      cards = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error('[generator] JSON.parse failed:', parseErr.message);
      console.error('[generator] broken JSON:', match[0]);
      console.warn('[generator] falling back to mock for this chunk');
      return mockGenerateCardsFromChunk(chunk);
    }

    return cards.filter(c => c.type && c.concept && c.front && c.back && c.difficulty);
  } catch (err) {
    console.error('[generator] Gemini API error:', err.message);
    console.warn('[generator] falling back to mock for this chunk');
    return mockGenerateCardsFromChunk(chunk);
  }
}

async function generateCards(chunks) {
  const all = [];
  for (const chunk of chunks) {
    const cards = await generateCardsFromChunk(chunk);
    all.push(...cards);
  }
  return all;
}

module.exports = { generateCards, generateCardsFromChunk };
