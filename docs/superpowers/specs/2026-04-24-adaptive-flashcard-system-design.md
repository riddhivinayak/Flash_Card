# Adaptive Flashcard System — Design Spec
**Date:** 2026-04-24
**Status:** Approved

---

## Overview

A backend system that converts PDF documents into adaptive flashcards, schedules reviews using the SM-2 spaced repetition algorithm, and generates AI-powered mistake explanations with memory tips. Single-user, no auth layer.

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (plain JavaScript) |
| Framework | Express |
| Database | MongoDB + Mongoose |
| AI | Claude API (card generation + explanations) |
| PDF parsing | pdf-parse |

---

## Project Structure

```
src/
├── api/
│   ├── routes/          # Express routers: decks, cards, reviews, analytics
│   └── controllers/     # Request handlers (thin — delegate to modules)
├── pdf/
│   └── extractor.js     # PDF text extraction + chunking
├── generator/
│   └── index.js         # Claude API → card generation + deduplication
├── scheduler/
│   └── sm2.js           # SM-2 pure functions (no I/O)
├── explainer/
│   └── index.js         # Claude API → explanation + memory tip
├── db/
│   └── models/          # Mongoose schemas: Deck, Card, CardProgress, Review
└── app.js               # Express setup + route registration
```

---

## Data Models

### Deck
```js
{
  _id, 
  title,        // string
  sourceFile,   // original PDF filename
  createdAt     // Date
}
```

### Card
```js
{
  _id,
  deckId,       // ref → Deck
  type,         // "definition" | "concept" | "example" | "edge_case"
  concept,      // string — groups related cards (e.g. "binary search", "Big O")
  front,        // string — the question / prompt shown to user
  back,         // string — the correct answer
  difficulty,   // "easy" | "medium" | "hard" — AI-assigned at generation time
  tags,         // string[] — optional topic labels
  createdAt     // Date
}
```

### CardProgress
```js
{
  _id,
  cardId,           // ref → Card
  easeFactor,       // float, starts at 2.5 (SM-2 E-Factor)
  interval,         // int, days until next review (starts at 1)
  repetitions,      // int, consecutive correct answers (quality >= 3)
  status,           // "new" | "learning" | "mastered"
  nextReviewDate,   // Date
  lastReviewDate    // Date
}
```

Status transitions:
- `new` → `learning`: after any first review (regardless of quality)
- `learning` → `mastered`: quality >= 4 AND repetitions >= 5
- Any quality < 3: repetitions reset to 0, interval reset to 1, status stays `learning`

### Review
```js
{
  _id,
  cardId,       // ref → Card
  deckId,       // ref → Deck (denormalized for analytics)
  quality,      // int 0–5 (SM-2 quality rating)
  userAnswer,   // string — what the user submitted
  explanation,  // string | null — Claude explanation (only when quality < 3)
  memoryTip,    // string | null — Claude memory tip (only when quality < 3)
  reviewedAt    // Date
}
```

---

## Data Flow

### 1. PDF → Flashcards

```
POST /api/decks/upload (multipart PDF)
  │
  ├─ pdf/extractor.js
  │   └─ Extract raw text → split into ~500-token chunks
  │
  ├─ generator/index.js
  │   ├─ For each chunk: call Claude API
  │   │   Prompt: "Generate definition, concept, example, and edge_case cards.
  │   │            Assign concept label and difficulty (easy/medium/hard) to each."
  │   ├─ Collect all generated cards
  │   └─ Deduplication step:
  │       - Normalize front text (lowercase, strip punctuation)
  │       - Drop cards whose front is >85% similar to an already-seen card
  │         (simple character-level similarity, no external library needed)
  │
  ├─ db/models/Card.js     — bulk insert deduplicated cards
  └─ db/models/CardProgress.js — create one "new" progress doc per card
```

### 2. Review Session

```
GET /api/decks/:id/review?limit=20
  │
  └─ api/controllers/reviewController.js
      ├─ Query CardProgress: nextReviewDate <= today (due cards) — fetch all, count for dueTodayCount
      ├─ Query CardProgress: status = "new" (new cards)
      ├─ Mix: take up to 80% of limit from due cards, fill remaining slots with new cards
      │   (if due cards < 80% of limit, fill all remaining slots with new cards)
      └─ Response includes:
          { cards: [...], dueTodayCount: <total due today, before limit cap> }

POST /api/reviews
  body: { cardId, quality (0–5), userAnswer }
  │
  ├─ scheduler/sm2.js (pure function)
  │   input:  { easeFactor, interval, repetitions, quality }
  │   output: { easeFactor, interval, repetitions, nextReviewDate }
  │
  ├─ CardProgress updated (easeFactor, interval, repetitions, nextReviewDate, status, lastReviewDate)
  │
  ├─ If quality < 3:
  │   └─ explainer/index.js
  │       Claude prompt: card front, back, userAnswer, cardType
  │       Returns: { explanation, memoryTip }
  │
  └─ Review saved → full review doc returned in response
```

### 3. Mistake Explanation

Triggered automatically when `quality < 3` during a review.

Claude is sent:
- Card `front`, `back`, `type`, `concept`
- `userAnswer`

Claude returns two fields:
- `explanation` — why the answer was wrong, what the correct reasoning is
- `memoryTip` — a short rule or mnemonic to remember the answer next time

Both are saved on the `Review` doc and returned in the `POST /api/reviews` response.

### 4. Analytics

```
GET /api/decks/:id/analytics
  │
  ├─ Aggregate Reviews by concept:
  │   - totalReviews, correctCount (quality >= 3), incorrectCount
  │   - accuracyRate = correctCount / totalReviews
  │   - avgQuality = sum(quality) / totalReviews
  │
  ├─ Aggregate CardProgress by status per concept:
  │   - newCount, learningCount, masteredCount
  │
  └─ Response: concepts sorted by accuracyRate ASC (weakest first)
```

---

## SM-2 Algorithm (pure function)

```js
// scheduler/sm2.js
function sm2(easeFactor, interval, repetitions, quality) {
  if (quality < 3) {
    return {
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      interval: 1,
      repetitions: 0,
      nextReviewDate: daysFromNow(1)
    }
  }

  const newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const newInterval =
    repetitions === 0 ? 1 :
    repetitions === 1 ? 6 :
    Math.round(interval * newEF)

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: repetitions + 1,
    nextReviewDate: daysFromNow(newInterval)
  }
}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/decks/upload | Upload PDF, generate cards |
| GET | /api/decks | List all decks |
| GET | /api/decks/:id | Get deck + card count |
| GET | /api/decks/:id/review | Get review session (due + new cards mix) |
| POST | /api/reviews | Submit a review answer |
| GET | /api/decks/:id/analytics | Get weak concepts + accuracy stats |
| GET | /api/cards/:id | Get single card |

---

## Key Design Decisions

- **No auth:** single-user system; add later if needed
- **Deduplication is local:** character-level similarity check after generation, no external library
- **Explanation is on-demand:** Claude is only called for mistakes (quality < 3), keeping costs low
- **`deckId` on Review:** denormalized intentionally to avoid joins in analytics queries
- **`concept` on Card:** AI-assigned at generation time, used as the grouping key for all analytics
- **SM-2 is stateless:** pure function takes current state, returns next state — easy to test
