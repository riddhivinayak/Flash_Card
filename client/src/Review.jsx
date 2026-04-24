import { useState, useEffect } from 'react'

const TYPE_LABELS = {
  definition: 'Definition',
  concept: 'Concept',
  example: 'Example',
  edge_case: 'Edge Case',
}

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
  const [userAnswer, setUserAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/decks/${deckId}/review`)
      .then(r => r.json())
      .then(data => {
        setCards(data.cards || [])
        setDueTodayCount(data.dueTodayCount || 0)
        setLoading(false)
      })
  }, [deckId])

  const current = cards[index]

  function reveal() {
    setRevealed(true)
  }

  async function submitQuality(quality) {
    setSubmitting(true)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: current.card._id, quality, userAnswer }),
    })
    const data = await res.json()
    setResult(data)
    setSubmitting(false)
  }

  function next() {
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex(index + 1)
      setUserAnswer('')
      setRevealed(false)
      setResult(null)
    }
  }

  if (loading) return <p className="state-message">Loading cards…</p>
  if (!cards.length) return <p className="state-message">No cards due for review. Check back tomorrow!</p>
  if (done) return <p className="state-message">Session complete — {dueTodayCount} cards were due today.</p>

  return (
    <>
      <p className="progress">
        {index + 1} / {cards.length} &nbsp;·&nbsp; {dueTodayCount} due today
      </p>

      {/* Question card */}
      <div className="card">
        <span className="badge">
          {TYPE_LABELS[current.card.type] || current.card.type} · {current.card.concept}
        </span>
        <p className="question">{current.card.front}</p>

        {!revealed && (
          <div className="input-row">
            <input
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && reveal()}
              placeholder="Your answer…"
              autoFocus
            />
            <button className="btn-check" onClick={reveal}>Check</button>
          </div>
        )}
      </div>

      {/* Answer + feedback card */}
      {revealed && (
        <div className="card">
          <p className="answer-label">Correct answer</p>
          <p className="answer-text">{current.card.back}</p>

          {result?.review?.explanation && (
            <>
              <hr className="divider" />
              <div className="feedback">
                <p className="feedback-label">Explanation</p>
                <p className="feedback-text">{result.review.explanation}</p>
              </div>
            </>
          )}

          {result?.review?.memoryTip && (
            <div className="feedback" style={{ marginTop: 8 }}>
              <p className="feedback-label">Memory tip</p>
              <p className="feedback-text">{result.review.memoryTip}</p>
            </div>
          )}

          {!result && (
            <>
              <hr className="divider" />
              <p className="quality-prompt">How well did you recall it?</p>
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
            <button className="btn-next" onClick={next}>Next →</button>
          )}
        </div>
      )}
    </>
  )
}
