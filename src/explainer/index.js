const useMock = !process.env.ANTHROPIC_API_KEY;

if (useMock) {
  console.warn('[explainer] ANTHROPIC_API_KEY not set — using mock explainer');
}

const SYSTEM_PROMPT = `You are a flashcard tutor. A student answered a flashcard incorrectly.
Given the card details and their wrong answer, return ONLY a JSON object with two fields:
- "explanation": 2-3 sentences explaining why their answer was wrong and what the correct reasoning is
- "memoryTip": one short sentence — a rule, pattern, or mnemonic to remember the correct answer

Return raw JSON only — no markdown, no extra text.`;

function mockExplain(card, userAnswer) {
  return {
    explanation: `Your answer "${userAnswer}" is incorrect. The correct answer is: "${card.back}". Review the concept "${card.concept}" to strengthen your understanding.`,
    memoryTip: `Remember: ${card.front.replace('?', '')} → ${card.back.split(' ').slice(0, 6).join(' ')}...`,
  };
}

async function explain(card, userAnswer) {
  if (useMock) return mockExplain(card, userAnswer);

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: JSON.stringify({
          type: card.type,
          concept: card.concept,
          question: card.front,
          correctAnswer: card.back,
          userAnswer,
        }),
      }],
    });

    const text = message.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return mockExplain(card, userAnswer);

    const parsed = JSON.parse(match[0]);
    if (!parsed.explanation || !parsed.memoryTip) return mockExplain(card, userAnswer);
    return parsed;
  } catch {
    return mockExplain(card, userAnswer);
  }
}

module.exports = { explain };
