import { useState, useEffect } from 'react'

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

  if (loading) return <p>Loading cards...</p>
  if (!cards.length) return <p>No cards due for review. Check back tomorrow!</p>
  if (done) return <p>Session complete! {dueTodayCount} cards were due today.</p>

  return (
    <div>
      <p>Card {index + 1} of {cards.length} &nbsp;|&nbsp; {dueTodayCount} due today</p>

      <div>
        <p><em>{current.card.type} · {current.card.concept}</em></p>
        <h2>{current.card.front}</h2>
      </div>

      {!revealed && (
        <div>
          <input
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && reveal()}
            placeholder="Your answer..."
          />
          <button onClick={reveal}>Check</button>
        </div>
      )}

      {revealed && (
        <div>
          <p><strong>Correct answer:</strong> {current.card.back}</p>

          {result?.review?.explanation && (
            <p><strong>Explanation:</strong> {result.review.explanation}</p>
          )}
          {result?.review?.memoryTip && (
            <p><strong>Memory tip:</strong> {result.review.memoryTip}</p>
          )}

          {!result && (
            <div>
              <p>How well did you recall it? (0 = forgot, 5 = perfect)</p>
              {[0, 1, 2, 3, 4, 5].map(q => (
                <button key={q} onClick={() => submitQuality(q)} disabled={submitting}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {result && (
            <button onClick={next}>Next →</button>
          )}
        </div>
      )}
    </div>
  )
}
