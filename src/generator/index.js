const pLimit = require('p-limit').default;

const useMock = !process.env.GEMINI_API_KEY;

if (useMock) {
  console.warn('[generator] GEMINI_API_KEY not set — using mock card generator');
}

const SYSTEM_PROMPT = `You are a flashcard generator. Your job is to create useful Q&A flashcards from ANY text — educational, professional, technical, or personal.

OUTPUT FORMAT
Return ONLY a valid JSON array — no markdown, no explanation, no wrapper text.
Each object must have exactly these fields:
- "type": one of "definition", "concept", "example", "edge_case"
- "concept": the topic or subject of the card (a short noun phrase, e.g. "SQL JOIN", "candidate experience", "project duration")
- "front": a clear, specific question that can be answered from the text
- "back": a direct answer drawn from the text (1–3 sentences, minimum 8 words)
- "difficulty": one of "easy", "medium", "hard"

GENERATE CARDS FOR ANY CONTENT TYPE:
- Technical/educational: definitions, concepts, rules, examples
- Resumes/CVs: candidate name, skills, experience, education, achievements
- Reports: findings, conclusions, data points, recommendations
- Articles: main arguments, key facts, named entities, statistics
- Anything else: factual statements, relationships, attributes, properties

QUESTION STYLE (adapt to content):
- For technical text: "What does X do?", "When would you use X?", "What is the rule for X?"
- For factual/personal text: "What is [person]'s [attribute]?", "How many years of experience does [person] have in X?", "What did [person/org] achieve?"
- For reports/articles: "What does the text say about X?", "What is the value/finding for X?"

NEVER generate cards for:
- Bare section headings with no content (e.g. a line that is just "Education" with nothing after it)
- Page numbers, dates that appear as metadata only
- Decorative separators or formatting artifacts

LIMITS
- Generate between 6 and 10 cards per request
- If the text is very short, still attempt to generate at least 3 cards from whatever facts are present
- Never return an empty array if there is ANY readable content in the text`;

// Strip document-structure noise before sending to Gemini
function cleanChunk(text) {
  return text
    .replace(/\b(lec|lecture|ch|chap|chapter|sec|section|unit|mod|module|slide|pg|page|fig|table|appendix)\s*[-:.]?\s*[\d.]+\b[:.)]?/gi, '')
    .replace(/^[A-Z]+-\d+\b/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWorthProcessing(text) {
  return text.split(/\s+/).filter(Boolean).length >= 15;
}

// Relaxed validation — only drop cards that are structurally broken or match known garbage patterns
const BAD_FRONT = [
  /\b(lec|lecture|chapter|section|slide|module|unit|page)\s*[-:]?\s*\d+/i,
];

function isCardValid(card) {
  if (!card.front || !card.back || !card.concept) return false;
  if (!card.type) card.type = 'concept';
  if (!card.difficulty) card.difficulty = 'medium';
  if (card.back.split(/\s+/).length < 4) return false;
  if (BAD_FRONT.some(p => p.test(card.front))) return false;
  return true;
}

const ALLOWED_TYPES = ['definition', 'concept', 'example', 'edge_case'];
const TYPE_MAP = { rule: 'concept', principle: 'concept', process: 'concept', procedure: 'concept', fact: 'concept', skill: 'definition' };

function normalizeCardType(type) {
  if (!type) return 'concept';
  if (ALLOWED_TYPES.includes(type)) return type;
  if (TYPE_MAP[type]) {
    console.log(`[generator] normalizing card type "${type}" → "${TYPE_MAP[type]}"`);
    return TYPE_MAP[type];
  }
  console.log(`[generator] unknown card type "${type}" → "concept"`);
  return 'concept';
}

// Text-based fallback: build simple cards directly from sentences when Gemini returns nothing
function textFallbackCards(text, target) {
  console.warn('[generator] using text fallback — building cards from raw sentences');
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 6);

  const cards = [];
  for (let i = 0; i < sentences.length && cards.length < target; i++) {
    const sentence = sentences[i];
    const words = sentence.split(/\s+/);
    const concept = words.slice(0, 4).join(' ').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Content';
    cards.push({
      type: 'concept',
      concept,
      front: `What does the text say about "${concept}"?`,
      back: sentence,
      difficulty: 'easy',
    });
  }

  // If even sentences failed, produce a single card from the raw text block
  if (cards.length === 0 && text.trim().length > 20) {
    const preview = text.trim().slice(0, 200);
    cards.push({
      type: 'concept',
      concept: 'Document content',
      front: 'What is the main content of this document?',
      back: preview,
      difficulty: 'easy',
    });
  }

  console.log(`[generator] text fallback produced ${cards.length} cards`);
  return cards;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const DIAGRAM_KEYWORDS = /\b(figure|fig\.|diagram|graph|chart|flowchart)\b/i;
const DIAGRAM_WORD_THRESHOLD = 80;

function isDiagramChunk(text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount < DIAGRAM_WORD_THRESHOLD && DIAGRAM_KEYWORDS.test(text);
}

const DIAGRAM_PROMPT = `You are a flashcard generator for diagram-adjacent content.
The text below comes from a PDF section that references a diagram, figure, chart, or graph.
You cannot see the actual image. Generate 1–2 flashcards based entirely on the surrounding text, caption, or label present.

OUTPUT FORMAT
Return ONLY a valid JSON array — no markdown, no explanation.
Each object must have exactly these fields:
- "type": "concept"
- "concept": the topic the diagram relates to (short noun phrase)
- "front": a question referencing the visual, e.g. "What does the diagram illustrating <concept> show?" or "What relationship does the <concept> chart represent?"
- "back": a conceptual explanation inferred from the surrounding text (1–3 sentences, minimum 8 words)
- "difficulty": one of "easy", "medium", "hard"
- "tags": ["diagram"]

Generate 1–2 cards only. Explain the concept the diagram represents — do not describe the image itself.`;

async function callGemini(userText, systemPrompt = SYSTEM_PROMPT) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
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

async function generateDiagramCards(chunk) {
  if (useMock) {
    return [{
      type: 'concept',
      concept: 'Diagram',
      front: 'What does the diagram in this section illustrate?',
      back: chunk.trim().slice(0, 200) || 'A visual representation of a key concept.',
      difficulty: 'medium',
      tags: ['diagram'],
    }];
  }

  console.log('[generator] diagram chunk — calling Gemini with diagram prompt');
  try {
    const raw = await callGemini(`Text:\n${chunk}`, DIAGRAM_PROMPT);
    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) return [];

    let cards;
    try { cards = JSON.parse(match[0]); } catch { return []; }

    cards.forEach(c => {
      c.type = 'concept';
      if (!Array.isArray(c.tags)) c.tags = ['diagram'];
      else if (!c.tags.includes('diagram')) c.tags.push('diagram');
    });

    const valid = cards.filter(isCardValid).slice(0, 2);
    console.log(`[generator] diagram cards produced: ${valid.length}`);
    return valid;
  } catch (err) {
    console.error('[generator] diagram generation failed:', err.message);
    return [];
  }
}

async function generateCardsFromChunk(chunk) {
  if (useMock) return textFallbackCards(chunk, 8);

  const cleaned = cleanChunk(chunk);

  // Diagram chunks are intentionally short — check before the word-count skip
  if (isDiagramChunk(cleaned)) {
    return generateDiagramCards(cleaned);
  }

  if (!isWorthProcessing(cleaned)) {
    console.log('[generator] skipping low-content chunk (too short after cleaning)');
    return [];
  }

  console.log('[generator] chunk preview (first 120 chars):', cleaned.slice(0, 120));
  console.log('[generator] calling Gemini API...');

  try {
    const raw = await callGemini(`Text:\n${cleaned}`);
    console.log('[generator] Gemini call successful');
    console.log('FULL GEMINI RESPONSE:', raw);

    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[generator] no JSON array found in Gemini response');
      return textFallbackCards(chunk, 8);
    }

    let cards;
    try {
      cards = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error('[generator] JSON.parse failed:', parseErr.message);
      return textFallbackCards(chunk, 8);
    }

    cards.forEach(c => { c.type = normalizeCardType(c.type); });
    const valid = cards.filter(isCardValid);
    console.log(`[generator] cards from Gemini: ${cards.length} raw, ${valid.length} valid after filtering`);

    // If Gemini returned [] or everything got filtered out, use text fallback for this chunk
    if (valid.length === 0) {
      console.warn('[generator] Gemini returned no usable cards for this chunk — using text fallback');
      return textFallbackCards(chunk, 8);
    }

    return valid;
  } catch (err) {
    console.error('[generator] Gemini error:', err.message);
    return textFallbackCards(chunk, 8);
  }
}

async function generateCards(chunks, totalWords = 0) {
  const target = totalWords < 500 ? 6 : totalWords < 1500 ? 8 : 10;
  console.log(`[generator] word count: ${totalWords} → target: ${target} cards, chunks: ${chunks.length}`);

  const limit = pLimit(3); // max 3 concurrent Gemini calls

  const results = await Promise.allSettled(
    chunks.map(chunk => limit(() => generateCardsFromChunk(chunk)))
  );

  const successful = results.filter(r => r.status === 'fulfilled');
  const failed     = results.filter(r => r.status === 'rejected');

  if (failed.length > 0) {
    console.warn(`[generator] ${failed.length} chunk(s) failed:`,
      failed.map(f => f.reason?.message));
  }
  console.log(`[generator] chunks: ${successful.length} succeeded, ${failed.length} failed`);

  const all = successful.flatMap(r => r.value);

  // Hard guarantee: if every chunk failed or returned nothing, fall back on raw text
  if (all.length === 0) {
    console.warn('[generator] zero cards after all chunks — running full-text fallback');
    const fullText = chunks.join(' ');
    all.push(...textFallbackCards(fullText, target));
  }

  const final = all.slice(0, target);
  console.log(`[generator] final card count: ${final.length}`);
  return final;
}

module.exports = { generateCards, generateCardsFromChunk };
