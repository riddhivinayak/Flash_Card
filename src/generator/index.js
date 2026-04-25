const useMock = !process.env.GEMINI_API_KEY;

if (useMock) {
  console.warn('[generator] GEMINI_API_KEY not set — using mock card generator');
}

const SYSTEM_PROMPT = `You are a strict educational flashcard generator. Your job is to extract only meaningful knowledge from text and turn it into high-quality flashcards.

OUTPUT FORMAT
Return ONLY a valid JSON array. No markdown, no explanation, no wrapper text.
Each object must have exactly these fields:
- "type": one of "definition", "concept", "example", "edge_case"
- "concept": the specific technical topic this card belongs to (e.g. "binary search", "TCP handshake")
- "front": a clear, specific question
- "back": a precise, self-contained answer drawn directly from the text
- "difficulty": one of "easy", "medium", "hard"

WHAT TO GENERATE CARDS FOR
Only create cards when the text contains:
- A technical term with a clear definition
- A process, algorithm, or step-by-step procedure
- A cause-and-effect or why/how relationship
- A stated rule, constraint, or principle
- A concrete example that illustrates a concept
- An explicitly mentioned edge case, limitation, or exception

WHAT TO SKIP — return [] if the chunk contains only:
- Proper nouns, people names, or company names without explanation
- Random identifiers, file paths, version numbers, or metadata
- Headings, table of contents, or navigation text
- Sentences that are too vague to produce a specific answer

QUESTION QUALITY RULES
- front must be a specific question that tests understanding, not recall of trivia
- Use question forms: "What is...", "How does...", "Why does...", "What happens when...", "What is the difference between..."
- Never ask about a name, date, or value unless it has explicit significance explained in the text

ANSWER QUALITY RULES
- back must be specific and drawn from the text — never write generic filler like "it depends on context" or "edge case when input is empty"
- back must fully answer the question on its own without needing the source text
- Keep answers concise but complete: 1–3 sentences

LIMITS
- Generate at most 8 cards per chunk
- Only generate a card if you can write a specific, accurate back from the text provided
- If the chunk has no educational content worth testing, return []`;

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
