const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

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

async function generateCardsFromChunk(chunk) {
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
