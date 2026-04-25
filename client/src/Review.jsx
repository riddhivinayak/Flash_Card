import { useState, useEffect } from 'react'
import { authHeaders } from './App'
import { nextReviewLabel } from './utils'
import Flashcard from './Flashcard'

const QUALITY_LABELS = ['Forgot', 'Hard', 'Almost', 'Good', 'Easy', 'Perfect']

function qualityClass(q) {
  if (q <= 1) return 'fail'
  if (q === 2) return 'mid'
  return 'pass'
}

export default function Review({ deckId }) {
  const [cards, setCards] = useState([])
  const [dueTodayCount, setDueTodayCount] = useState(0)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/decks/${deckId}/review`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        setCards(data.cards || [])
        setDueTodayCount(data.dueTodayCount || 0)
        setLoading(false)
      })
  }, [deckId])

  const current = cards[index]

  async function submitQuality(quality) {
    setSubmitting(true)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cardId: current.card._id, quality, userAnswer: '' }),
    })
    const data = await res.json()
    setResult(data)
    setSubmitting(false)
  }

  function next() {
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setFlipped(false)
      setResult(null)
    }
  }

  if (loading) return <p className="state-message">Loading cards…</p>
  if (!cards.length) return <p className="state-message">No cards due for review. Check back tomorrow!</p>
  if (done) return <p className="state-message">Session complete — {dueTodayCount} cards were due today.</p>

  const scheduledDate = result?.progress?.nextReviewDate ?? current.nextReviewDate
  const nextLabel = nextReviewLabel(scheduledDate)

  return (
    <>
      <p className="progress">
        {index + 1} / {cards.length} &nbsp;·&nbsp; {dueTodayCount} due today
      </p>

      {/* key=index re-mounts Flashcard on every new card, resetting its animation state */}
      <Flashcard key={index} card={current.card} flipped={flipped} />

      <div className="fc-actions">
        {!flipped && (
          <button className="btn-show-answer" onClick={() => setFlipped(true)}>
            Show Answer
          </button>
        )}

        {flipped && !result && (
          <>
            <p className="quality-prompt">How well did you know it?</p>
            <div className="quality-buttons">
              {[0, 1, 2, 3, 4, 5].map(q => (
                <button
                  key={q}
                  className={`quality-btn ${qualityClass(q)}`}
                  onClick={() => submitQuality(q)}
                  disabled={submitting}
                >
                  <span className="q-num">{q}</span>
                  <span className="q-label">{QUALITY_LABELS[q]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {result && (
          <>
            {nextLabel && (
              <p className="next-review-label">Next review: <strong>{nextLabel}</strong></p>
            )}
            <button className="btn-next" onClick={next}>Next →</button>
          </>
        )}
      </div>
    </>
  )
}
