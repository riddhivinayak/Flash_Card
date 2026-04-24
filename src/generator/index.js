const useMock = !process.env.ANTHROPIC_API_KEY;

if (useMock) {
  console.warn('[generator] ANTHROPIC_API_KEY not set — using mock card generator');
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

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Text:\n${chunk}` }],
    });

    const text = message.content[0].text;
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const cards = JSON.parse(match[0]);
    return cards.filter(c => c.type && c.concept && c.front && c.back && c.difficulty);
  } catch {
    return [];
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
