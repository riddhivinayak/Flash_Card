import { useState, useEffect } from 'react'

export default function Analytics({ deckId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/decks/${deckId}/analytics`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
  }, [deckId])

  if (loading) return <p>Loading analytics...</p>
  if (!data) return null

  if (!data.hasReviews) {
    return (
      <div>
        <p>No reviews yet — start reviewing to see accuracy stats.</p>
        <ul>
          {data.concepts.map(c => (
            <li key={c.concept}>
              <strong>{c.concept}</strong>
              {' — '}
              {c.newCount} new, {c.learningCount} learning, {c.masteredCount} mastered
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <h2>Concepts — weakest first</h2>
      <ul>
        {data.concepts.map(c => (
          <li key={c.concept}>
            <strong>{c.concept}</strong>
            {' — '}
            Accuracy: {(c.accuracyRate * 100).toFixed(0)}%
            {' | '}
            Avg quality: {c.avgQuality}
            {' | '}
            {c.newCount} new, {c.learningCount} learning, {c.masteredCount} mastered
          </li>
        ))}
      </ul>
    </div>
  )
}
