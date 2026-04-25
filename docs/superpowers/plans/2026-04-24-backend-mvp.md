# Adaptive Flashcard System — Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full PDF → card generation → store → fetch backend flow end-to-end.

**Architecture:** Single Express monolith with clear internal modules. MongoDB (via Mongoose) stores decks, cards, and progress docs. Claude API generates cards from PDF text chunks. All modules are independently testable with mocks at module boundaries.

**Tech Stack:** Node.js (plain JS), Express 4, MongoDB + Mongoose 8, pdf-parse, @anthropic-ai/sdk, multer, Jest 29, supertest, mongodb-memory-server

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies + npm scripts |
| `.env.example` | Env variable template |
| `src/app.js` | Express app factory (no listen call) |
| `src/server.js` | Entry point — connects DB then starts server |
| `src/db/connection.js` | Mongoose connect / disconnect |
| `src/db/models/Deck.js` | Deck schema + model |
| `src/db/models/Card.js` | Card schema + model |
| `src/db/models/CardProgress.js` | CardProgress schema + model |
| `src/pdf/extractor.js` | PDF text extraction + word-based chunking |
| `src/generator/dedup.js` | Jaccard-similarity deduplication (pure functions) |
| `src/generator/index.js` | Claude API calls + card parsing |
| `src/api/controllers/deckController.js` | uploadDeck, listDecks, getDeck handlers |
| `src/api/routes/decks.js` | Express router for /api/decks |
| `tests/helpers/db.js` | In-memory MongoDB setup/teardown for tests |
| `tests/pdf/extractor.test.js` | Unit tests for chunkText |
| `tests/generator/dedup.test.js` | Unit tests for deduplicate + similarity |
| `tests/generator/generator.test.js` | Unit tests for generateCardsFromChunk (Claude mocked) |
| `tests/api/decks.test.js` | Integration tests for all three deck endpoints |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "adaptive-flashcard-system",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --watch --runInBand"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "mongodb-memory-server": "^9.1.6",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.3"
  },
  "jest": {
    "testEnvironment": "node",
    "testTimeout": 30000
  }
}
```

- [ ] **Step 2: Create .env.example**

```
MONGODB_URI=mongodb://localhost:27017/flashcards
ANTHROPIC_API_KEY=your_key_here
PORT=3000
```

Copy it to `.env` and fill in your real values.

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
uploads/
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create directory structure**

```bash
mkdir -p src/api/routes src/api/controllers src/db/models src/pdf src/generator tests/pdf tests/generator tests/api tests/helpers
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json .env.example .gitignore
git commit -m "chore: project scaffolding"
```

---

## Task 2: Database Connection

**Files:**
- Create: `src/db/connection.js`
- Create: `tests/helpers/db.js`

- [ ] **Step 1: Write the failing test**

Create `tests/helpers/db.js` first (needed by all integration tests):

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connect, disconnect } = require('../../src/db/connection');

let mongoServer;

async function startDb() {
  mongoServer = await MongoMemoryServer.create();
  await connect(mongoServer.getUri());
}

async function stopDb() {
  await disconnect();
  await mongoServer.stop();
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { startDb, stopDb, clearDb };
```

Create a minimal connection test at `tests/helpers/db.test.js`:

```js
const { startDb, stopDb } = require('./db');
const mongoose = require('mongoose');

test('connects and disconnects from in-memory MongoDB', async () => {
  await startDb();
  expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  await stopDb();
  expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/helpers/db.test.js
```

Expected: FAIL — `Cannot find module '../../src/db/connection'`

- [ ] **Step 3: Implement src/db/connection.js**

```js
const mongoose = require('mongoose');

async function connect(uri) {
  await mongoose.connect(uri || process.env.MONGODB_URI);
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/helpers/db.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/connection.js tests/helpers/db.js tests/helpers/db.test.js
git commit -m "feat: database connect/disconnect with in-memory test helper"
```

---

## Task 3: Mongoose Models

**Files:**
- Create: `src/db/models/Deck.js`
- Create: `src/db/models/Card.js`
- Create: `src/db/models/CardProgress.js`

No unit tests needed for pure schema definitions — they are exercised by the API integration tests in Task 8.

- [ ] **Step 1: Create src/db/models/Deck.js**

```js
const mongoose = require('mongoose');

const DeckSchema = new mongoose.Schema(
  { title: { type: String, required: true }, sourceFile: { type: String, required: true } },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Deck', DeckSchema);
```

- [ ] **Step 2: Create src/db/models/Card.js**

```js
const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema(
  {
    deckId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
    type:       { type: String, enum: ['definition', 'concept', 'example', 'edge_case'], required: true },
    concept:    { type: String, required: true },
    front:      { type: String, required: true },
    back:       { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    tags:       [String],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Card', CardSchema);
```

- [ ] **Step 3: Create src/db/models/CardProgress.js**

```js
const mongoose = require('mongoose');

const CardProgressSchema = new mongoose.Schema({
  cardId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  easeFactor:     { type: Number, default: 2.5 },
  interval:       { type: Number, default: 1 },
  repetitions:    { type: Number, default: 0 },
  status:         { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
  nextReviewDate: { type: Date, default: Date.now },
  lastReviewDate: { type: Date, default: null },
});

module.exports = mongoose.model('CardProgress', CardProgressSchema);
```

- [ ] **Step 4: Commit**

```bash
git add src/db/models/
git commit -m "feat: Deck, Card, CardProgress mongoose models"
```

---

## Task 4: PDF Extractor

**Files:**
- Create: `src/pdf/extractor.js`
- Create: `tests/pdf/extractor.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/pdf/extractor.test.js`:

```js
const { chunkText } = require('../../src/pdf/extractor');

describe('chunkText', () => {
  test('returns a single chunk for short text', () => {
    const chunks = chunkText('hello world foo bar');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('hello world foo bar');
  });

  test('splits at 500-word boundaries', () => {
    const text = Array(1100).fill('word').join(' ');
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].split(' ')).toHaveLength(500);
    expect(chunks[1].split(' ')).toHaveLength(500);
    expect(chunks[2].split(' ')).toHaveLength(100);
  });

  test('caps output at 20 chunks regardless of input length', () => {
    const text = Array(15000).fill('word').join(' ');
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(20);
  });

  test('filters empty words from split', () => {
    const chunks = chunkText('  hello   world  ');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('hello world');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/pdf/extractor.test.js
```

Expected: FAIL — `Cannot find module '../../src/pdf/extractor'`

- [ ] **Step 3: Implement src/pdf/extractor.js**

```js
const pdfParse = require('pdf-parse');

const CHUNK_SIZE = 500;
const MAX_CHUNKS = 20;

async function extractText(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text.trim();
  if (!text) throw new Error('PDF contains no extractable text');
  return text;
}

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
  }
  return chunks;
}

module.exports = { extractText, chunkText };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/pdf/extractor.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pdf/extractor.js tests/pdf/extractor.test.js
git commit -m "feat: PDF text extraction and chunking"
```

---

## Task 5: Card Deduplication

**Files:**
- Create: `src/generator/dedup.js`
- Create: `tests/generator/dedup.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/generator/dedup.test.js`:

```js
const { normalize, similarity, deduplicate } = require('../../src/generator/dedup');

describe('normalize', () => {
  test('lowercases and strips punctuation', () => {
    expect(normalize('What is Binary Search?!')).toBe('what is binary search');
  });

  test('trims surrounding whitespace', () => {
    expect(normalize('  hello world  ')).toBe('hello world');
  });
});

describe('similarity', () => {
  test('identical strings score 1.0', () => {
    expect(similarity('what is binary search', 'what is binary search')).toBe(1);
  });

  test('completely different strings score 0', () => {
    expect(similarity('foo bar', 'baz qux')).toBe(0);
  });

  test('partially overlapping strings score between 0 and 1', () => {
    const score = similarity('what is a stack', 'what is a queue');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe('deduplicate', () => {
  test('removes near-duplicate cards above default threshold', () => {
    const cards = [
      { front: 'What is binary search?' },
      { front: 'What is binary search' },
      { front: 'Explain recursion' },
    ];
    expect(deduplicate(cards)).toHaveLength(2);
  });

  test('keeps all distinct cards', () => {
    const cards = [
      { front: 'What is a stack?' },
      { front: 'What is a queue?' },
      { front: 'Explain binary trees' },
    ];
    expect(deduplicate(cards)).toHaveLength(3);
  });

  test('first occurrence wins when duplicates exist', () => {
    const cards = [
      { front: 'What is binary search?', back: 'first' },
      { front: 'What is binary search', back: 'second' },
    ];
    expect(deduplicate(cards)[0].back).toBe('first');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/generator/dedup.test.js
```

Expected: FAIL — `Cannot find module '../../src/generator/dedup'`

- [ ] **Step 3: Implement src/generator/dedup.js**

```js
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function similarity(a, b) {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function deduplicate(cards, threshold = 0.85) {
  const seen = [];
  return cards.filter(card => {
    const norm = normalize(card.front);
    const isDuplicate = seen.some(s => similarity(s, norm) >= threshold);
    if (!isDuplicate) seen.push(norm);
    return !isDuplicate;
  });
}

module.exports = { normalize, similarity, deduplicate };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/generator/dedup.test.js
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/generator/dedup.js tests/generator/dedup.test.js
git commit -m "feat: Jaccard-similarity card deduplication"
```

---

## Task 6: Card Generator (Claude API)

**Files:**
- Create: `src/generator/index.js`
- Create: `tests/generator/generator.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/generator/generator.test.js`:

```js
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
);

const { generateCardsFromChunk } = require('../../src/generator/index');

const validCard = {
  type: 'definition',
  concept: 'binary search',
  front: 'What is binary search?',
  back: 'An O(log n) search algorithm on sorted arrays.',
  difficulty: 'easy',
};

describe('generateCardsFromChunk', () => {
  test('parses a valid JSON array response from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify([validCard]) }]
    });
    const cards = await generateCardsFromChunk('text about binary search');
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('definition');
    expect(cards[0].concept).toBe('binary search');
  });

  test('parses JSON wrapped in markdown code fences', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '```json\n' + JSON.stringify([validCard]) + '\n```' }]
    });
    const cards = await generateCardsFromChunk('text');
    expect(cards).toHaveLength(1);
  });

  test('returns empty array when Claude returns no JSON array', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'I cannot generate cards from this text.' }]
    });
    const cards = await generateCardsFromChunk('text');
    expect(cards).toHaveLength(0);
  });

  test('skips cards missing required fields', async () => {
    const incomplete = { type: 'definition', front: 'Q?' }; // missing concept, back, difficulty
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify([incomplete, validCard]) }]
    });
    const cards = await generateCardsFromChunk('text');
    expect(cards).toHaveLength(1);
    expect(cards[0].concept).toBe('binary search');
  });

  test('returns empty array on Claude API error', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));
    const cards = await generateCardsFromChunk('text');
    expect(cards).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/generator/generator.test.js
```

Expected: FAIL — `Cannot find module '../../src/generator/index'`

- [ ] **Step 3: Implement src/generator/index.js**

```js
const Anthropic = require('@anthropic-ai/sdk');
const { deduplicate } = require('./dedup');

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
  return deduplicate(all);
}

module.exports = { generateCards, generateCardsFromChunk };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/generator/generator.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/generator/index.js tests/generator/generator.test.js
git commit -m "feat: Claude card generator with deduplication and prompt caching"
```

---

## Task 7: Deck Controller

**Files:**
- Create: `src/api/controllers/deckController.js`

No separate unit test file — the controller is tested via supertest in Task 8. Writing it first so we have something to test against.

- [ ] **Step 1: Implement src/api/controllers/deckController.js**

```js
const Deck = require('../../db/models/Deck');
const Card = require('../../db/models/Card');
const CardProgress = require('../../db/models/CardProgress');
const { extractText, chunkText } = require('../../pdf/extractor');
const { generateCards } = require('../../generator');

async function uploadDeck(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

  let text;
  try {
    text = await extractText(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const chunks = chunkText(text);
  const generated = await generateCards(chunks);

  if (!generated.length) {
    return res.status(422).json({ error: 'No cards could be generated from this PDF' });
  }

  const deck = await Deck.create({
    title: req.body.title || req.file.originalname.replace(/\.pdf$/i, ''),
    sourceFile: req.file.originalname,
  });

  const cards = await Card.insertMany(generated.map(c => ({ ...c, deckId: deck._id })));
  await CardProgress.insertMany(cards.map(card => ({ cardId: card._id, nextReviewDate: new Date() })));

  res.status(201).json({ deck, cardCount: cards.length });
}

async function listDecks(req, res) {
  const decks = await Deck.find().sort({ createdAt: -1 });
  res.json(decks);
}

async function getDeck(req, res) {
  const deck = await Deck.findById(req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  const cardCount = await Card.countDocuments({ deckId: deck._id });
  res.json({ ...deck.toObject(), cardCount });
}

module.exports = { uploadDeck, listDecks, getDeck };
```

- [ ] **Step 2: Commit**

```bash
git add src/api/controllers/deckController.js
git commit -m "feat: uploadDeck, listDecks, getDeck controller handlers"
```

---

## Task 8: Routes, App, and Integration Tests

**Files:**
- Create: `src/api/routes/decks.js`
- Create: `src/app.js`
- Create: `src/server.js`
- Create: `tests/api/decks.test.js`

- [ ] **Step 1: Write the failing integration tests**

Create `tests/api/decks.test.js`:

```js
jest.mock('../../src/pdf/extractor');
jest.mock('../../src/generator');

const { extractText, chunkText } = require('../../src/pdf/extractor');
const { generateCards } = require('../../src/generator');
const request = require('supertest');
const createApp = require('../../src/app');
const { startDb, stopDb, clearDb } = require('../helpers/db');

let app;

const MOCK_CARDS = [
  { type: 'definition', concept: 'binary search', front: 'What is binary search?', back: 'O(log n) search.', difficulty: 'easy' },
  { type: 'concept', concept: 'recursion', front: 'What is recursion?', back: 'A function calling itself.', difficulty: 'medium' },
];

beforeAll(async () => {
  await startDb();
  app = createApp();
});
afterAll(stopDb);
afterEach(clearDb);

describe('POST /api/decks/upload', () => {
  beforeEach(() => {
    extractText.mockResolvedValue('some text from pdf');
    chunkText.mockReturnValue(['chunk one', 'chunk two']);
    generateCards.mockResolvedValue(MOCK_CARDS);
  });

  test('returns 201 with deck and cardCount on success', async () => {
    const res = await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('fake pdf bytes'), 'algorithms.pdf')
      .field('title', 'Algorithms');

    expect(res.status).toBe(201);
    expect(res.body.deck.title).toBe('Algorithms');
    expect(res.body.deck.sourceFile).toBe('algorithms.pdf');
    expect(res.body.cardCount).toBe(2);
  });

  test('uses filename as title when no title field sent', async () => {
    const res = await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('fake pdf bytes'), 'data-structures.pdf');

    expect(res.status).toBe(201);
    expect(res.body.deck.title).toBe('data-structures');
  });

  test('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/decks/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No PDF uploaded');
  });

  test('returns 400 when PDF has no extractable text', async () => {
    extractText.mockRejectedValue(new Error('PDF contains no extractable text'));
    const res = await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('bad pdf'), 'empty.pdf');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PDF contains no extractable text');
  });

  test('returns 422 when Claude generates no cards', async () => {
    generateCards.mockResolvedValue([]);
    const res = await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('pdf'), 'blank.pdf');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/decks', () => {
  test('returns empty array when no decks exist', async () => {
    const res = await request(app).get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all decks sorted by newest first', async () => {
    extractText.mockResolvedValue('text');
    chunkText.mockReturnValue(['chunk']);
    generateCards.mockResolvedValue(MOCK_CARDS);

    await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('pdf'), 'first.pdf');
    await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('pdf'), 'second.pdf');

    const res = await request(app).get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].sourceFile).toBe('second.pdf');
  });
});

describe('GET /api/decks/:id', () => {
  test('returns deck with cardCount', async () => {
    extractText.mockResolvedValue('text');
    chunkText.mockReturnValue(['chunk']);
    generateCards.mockResolvedValue(MOCK_CARDS);

    const upload = await request(app)
      .post('/api/decks/upload')
      .attach('pdf', Buffer.from('pdf'), 'algo.pdf');

    const { _id } = upload.body.deck;
    const res = await request(app).get(`/api/decks/${_id}`);
    expect(res.status).toBe(200);
    expect(res.body.cardCount).toBe(2);
  });

  test('returns 404 for an unknown deck id', async () => {
    const res = await request(app).get('/api/decks/000000000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Deck not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/api/decks.test.js
```

Expected: FAIL — `Cannot find module '../../src/app'`

- [ ] **Step 3: Create src/api/routes/decks.js**

```js
const express = require('express');
const multer = require('multer');
const { uploadDeck, listDecks, getDeck } = require('../controllers/deckController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

router.post('/upload', upload.single('pdf'), uploadDeck);
router.get('/', listDecks);
router.get('/:id', getDeck);

module.exports = router;
```

- [ ] **Step 4: Create src/app.js**

```js
const express = require('express');
const deckRoutes = require('./api/routes/decks');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/decks', deckRoutes);
  return app;
}

module.exports = createApp;
```

- [ ] **Step 5: Run integration tests**

```bash
npm test -- tests/api/decks.test.js
```

Expected: PASS (9 tests)

- [ ] **Step 6: Create src/server.js**

```js
require('dotenv').config();
const createApp = require('./app');
const { connect } = require('./db/connection');

const PORT = process.env.PORT || 3000;

connect()
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
```

- [ ] **Step 7: Run all tests together**

```bash
npm test
```

Expected: all test suites PASS — `db.test.js`, `extractor.test.js`, `dedup.test.js`, `generator.test.js`, `decks.test.js`

- [ ] **Step 8: Commit**

```bash
git add src/api/ src/app.js src/server.js tests/api/
git commit -m "feat: deck routes, Express app, server entry point, integration tests"
```

---

## Task 9: Manual Smoke Test

Verify the full pipeline works against a real MongoDB and real Claude API before declaring MVP done.

- [ ] **Step 1: Start MongoDB locally**

```bash
# If using Docker:
docker run -d -p 27017:27017 --name mongo mongo:7

# Or if MongoDB is installed locally:
mongod --dbpath ./data/db
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Expected: `Server running on port 3000`

- [ ] **Step 3: Upload a real PDF**

```bash
curl -X POST http://localhost:3000/api/decks/upload \
  -F "pdf=@/path/to/your/file.pdf" \
  -F "title=My Test Deck"
```

Expected: `201` response with `deck` object and `cardCount > 0`

- [ ] **Step 4: Verify the deck was stored**

```bash
curl http://localhost:3000/api/decks
```

Expected: JSON array with one deck.

- [ ] **Step 5: Fetch the deck by ID**

```bash
# Use the _id from step 3
curl http://localhost:3000/api/decks/<deck_id>
```

Expected: deck object with `cardCount` field.

- [ ] **Step 6: Commit smoke test success note in git**

```bash
git commit --allow-empty -m "chore: manual smoke test passed — PDF → cards → fetch flow working"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - PDF → card generation with deduplication: Task 4 + 5 + 6 + 8
  - SM-2 review scheduling: not in this plan — next plan
  - Mistake explanation: not in this plan — next plan
  - Analytics: not in this plan — next plan
  - All three deck endpoints (upload, list, get): Task 8

- **No placeholders:** All steps contain full code — confirmed.

- **Type consistency:**
  - `generateCards` exported from `src/generator/index.js`, imported in `deckController.js` and mocked in `decks.test.js` — consistent.
  - `extractText` and `chunkText` exported from `src/pdf/extractor.js`, imported in `deckController.js` and mocked in `decks.test.js` — consistent.
  - `deduplicate` from `src/generator/dedup.js` used internally by `src/generator/index.js` only — consistent.
