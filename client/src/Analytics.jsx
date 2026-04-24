import { useState, useEffect } from 'react'

function accuracyClass(rate) {
  if (rate >= 0.75) return 'acc-high'
  if (rate >= 0.5)  return 'acc-mid'
  return 'acc-low'
}

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

  if (loading) return <p className="state-message">Loading analytics…</p>
  if (!data) return null

  if (!data.hasReviews) {
    return (
      <>
        <p className="analytics-header">Concepts</p>
        <p className="state-message" style={{ paddingTop: 12 }}>
          No reviews yet — start reviewing to see accuracy stats.
        </p>
        {data.concepts.map(c => (
          <div key={c.concept} className="card concept-row">
            <p className="concept-name">{c.concept}</p>
            <div className="status-pills">
              {c.newCount      > 0 && <span className="pill pill-new">{c.newCount} new</span>}
              {c.learningCount > 0 && <span className="pill pill-learning">{c.learningCount} learning</span>}
              {c.masteredCount > 0 && <span className="pill pill-mastered">{c.masteredCount} mastered</span>}
            </div>
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      <p className="analytics-header">Weakest concepts first</p>
      {data.concepts.map(c => (
        <div key={c.concept} className="card concept-row">
          <p className="concept-name">{c.concept}</p>

          <div className="concept-stats">
            <div className="stat">
              <span className="stat-label">Accuracy</span>
              <span className={`stat-value ${accuracyClass(c.accuracyRate)}`}>
                {(c.accuracyRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg quality</span>
              <span className="stat-value">{c.avgQuality}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Reviews</span>
              <span className="stat-value">{c.totalReviews}</span>
            </div>
          </div>

          <div className="status-pills">
            {c.newCount      > 0 && <span className="pill pill-new">{c.newCount} new</span>}
            {c.learningCount > 0 && <span className="pill pill-learning">{c.learningCount} learning</span>}
            {c.masteredCount > 0 && <span className="pill pill-mastered">{c.masteredCount} mastered</span>}
          </div>
        </div>
      ))}
    </>
  )
}
