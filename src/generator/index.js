const useMock = !process.env.GEMINI_API_KEY;

if (useMock) {
  console.warn('[generator] GEMINI_API_KEY not set — using mock card generator');
}

const SYSTEM_PROMPT = `You are a strict educational flashcard generator. Extract only meaningful, teachable knowledge from text.

OUTPUT FORMAT
Return ONLY a valid JSON array — no markdown, no explanation, no wrapper text.
Each object must have exactly these fields:
- "type": one of "definition", "concept", "example", "edge_case"
- "concept": the specific technical topic (e.g. "SELECT statement", "JOIN", "normalization")
- "front": a clear question a student should be able to answer
- "back": a precise answer drawn directly from the text (1–3 sentences)
- "difficulty": one of "easy", "medium", "hard"

GENERATE CARDS ONLY FOR
- A keyword or term that has a definition in the text
- A SQL clause, operator, or keyword with an explained purpose
- A rule, constraint, or principle stated in the text
- A process or procedure with described steps
- A concrete example that demonstrates a concept
- An explicitly stated limitation or exception

ABSOLUTELY NEVER GENERATE CARDS FOR
- Lecture codes, course codes, or slide labels (e.g. "LEC-9", "CS101", "Chapter 3", "Slide 12")
- Document headings or section titles on their own
- People names, university names, or course titles
- Page numbers, dates, or administrative metadata
- Any phrase you cannot fully explain in the "back" from the text alone

BAD EXAMPLES — never produce questions like these:
- "What is LEC-9: SQL in?" — LEC-9 is a document label, not a concept
- "What is Chapter 4?" — a heading, not a teachable concept
- "Give an example of Introduction to Databases." — title, not content
- "What is the edge case for it?" — vague, no specific concept

GOOD EXAMPLES — produce questions like these:
- "What does the SQL WHERE clause do?" → "The WHERE clause filters rows in a query result based on a specified condition."
- "When would you use SQL IN instead of multiple OR conditions?" → "Use IN when checking if a value matches any item in a list; it is more readable than chaining multiple OR conditions."
- "What is a primary key in a relational database?" → "A primary key uniquely identifies each row in a table and cannot be NULL or duplicate."

ANSWER RULES
- The back must be specific — never write "a concept from the text" or "edge case when input is empty"
- The back must stand alone — a reader with no access to the source must fully understand the answer
- Minimum 8 words in the back

LIMITS
- At most 8 cards per chunk
- If the chunk contains no teachable concepts after filtering noise, return []`;

// Strip document-structure tokens before sending to Gemini
function cleanChunk(text) {
  return text
    // Remove lecture/chapter/section codes: LEC-9, CH.3, Slide 12, Page 4, etc.
    .replace(/\b(lec|lecture|ch|chap|chapter|sec|section|unit|mod|module|slide|pg|page|fig|table|appendix)\s*[-:.]?\s*[\d.]+\b[:.)]?/gi, '')
    // Remove lines or fragments that are pure ALL-CAPS labels ≤ 5 words
    .replace(/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){0,4}\b(?=\s|$)/g, (match) => {
      // Keep known meaningful acronyms (SQL, JOIN, NULL, etc.) — only strip if it looks like a code
      return /^[A-Z]+-\d/.test(match) ? '' : match;
    })
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Skip chunks that are too short after cleaning to produce real cards
function isWorthProcessing(text) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 25;
}

// Reject cards that slipped through with bad fronts or generic backs
const BAD_FRONT = [
  /\b(lec|lecture|chapter|section|slide|module|unit|page)\s*[-:]?\s*\d+/i,
  /^what is "[^"]{1,10}[:\-]\s*\w{1,6}"/i, // "What is "LEC-9: SQL"?"
];
const GENERIC_BACK = [
  /concept from the (uploaded )?pdf/i,
  /key idea is derived from/i,
  /edge case when input is empty/i,
  /boundary conditions apply/i,
];

const ALLOWED_TYPES = ['definition', 'concept', 'example', 'edge_case'];
const TYPE_MAP = { rule: 'concept', principle: 'concept', process: 'concept', procedure: 'concept' };

function normalizeCardType(type) {
  if (ALLOWED_TYPES.includes(type)) return type;
  if (TYPE_MAP[type]) {
    console.log(`[generator] normalizing card type "${type}" → "${TYPE_MAP[type]}"`);
    return TYPE_MAP[type];
  }
  console.log(`[generator] unknown card type "${type}" → "concept"`);
  return 'concept';
}

function isCardValid(card) {
  if (!card.type || !card.concept || !card.front || !card.back || !card.difficulty) return false;
  if (BAD_FRONT.some(p => p.test(card.front))) return false;
  if (GENERIC_BACK.some(p => p.test(card.back))) return false;
  if (card.back.split(/\s+/).length < 5) return false;
  return true;
}

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

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(userText) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userText }] }],
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('[generator] Gemini REST error body:', JSON.stringify(body));
    throw new Error(`Gemini ${res.status}: ${body?.error?.message || res.statusText}`);
  }
  return body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function generateCardsFromChunk(chunk) {
  if (useMock) return mockGenerateCardsFromChunk(chunk);

  const cleaned = cleanChunk(chunk);
  if (!isWorthProcessing(cleaned)) {
    console.log('[generator] skipping low-content chunk (too short after cleaning)');
    return [];
  }

  console.log('[generator] chunk preview (first 120 chars):', cleaned.slice(0, 120));
  console.log('[generator] calling Gemini API...');

  try {
    const raw = await callGemini(`Text:\n${cleaned}`);
    console.log('[generator] Gemini call successful');
    console.log('[generator] raw Gemini output:', raw);

    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[generator] no JSON array found in Gemini response:', stripped);
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

    cards.forEach(c => { c.type = normalizeCardType(c.type); });
    const valid = cards.filter(isCardValid);
    console.log(`[generator] cards from Gemini: ${cards.length} raw, ${valid.length} valid after filtering`);
    if (valid.length > 0) {
      console.log('[generator] valid cards:', JSON.stringify(valid, null, 2));
    }
    return valid;
  } catch (err) {
    console.error('[generator] Gemini error:', err.message);
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
