import { useState, useEffect } from 'react'
import { authHeaders } from './App'
import { nextReviewLabel } from './utils'

function accuracyClass(rate) {
  if (rate >= 0.75) return 'acc-high'
  if (rate >= 0.5)  return 'acc-mid'
  return 'acc-low'
}

// Determine the single most urgent status for a concept
function dominantStatus(c) {
  if (c.needsRevisionCount > 0) return 'revision'
  if (c.learningCount      > 0) return 'learning'
  if (c.reviewingCount     > 0) return 'reviewing'
  if (c.masteredCount      > 0) return 'mastered'
  return 'new'
}

const STATUS_CONFIG = {
  revision:  { label: 'Needs Revision', icon: '🔴', cls: 'status-badge-revision'  },
  new:       { label: 'New',            icon: '⚪', cls: 'status-badge-new'       },
  learning:  { label: 'Learning',       icon: '🟡', cls: 'status-badge-learning'  },
  reviewing: { label: 'Reviewing',      icon: '🔵', cls: 'status-badge-reviewing' },
  mastered:  { label: 'Mastered',       icon: '🟢', cls: 'status-badge-mastered'  },
}

function StatusBadge({ concept }) {
  const key = dominantStatus(concept)
  const { label, icon, cls } = STATUS_CONFIG[key]
  return <span className={`status-badge ${cls}`}>{icon} {label}</span>
}

// Aggregated counts across ALL concepts in the deck
function DeckSummary({ concepts }) {
  const totals = concepts.reduce(
    (acc, c) => ({
      revision:  acc.revision  + (c.needsRevisionCount ?? 0),
      new:       acc.new       + (c.newCount           ?? 0),
      learning:  acc.learning  + (c.learningCount      ?? 0),
      reviewing: acc.reviewing + (c.reviewingCount     ?? 0),
      mastered:  acc.mastered  + (c.masteredCount      ?? 0),
    }),
    { revision: 0, new: 0, learning: 0, reviewing: 0, mastered: 0 }
  )

  const entries = [
    { key: 'revision',  label: 'Needs Revision', icon: '🔴', cls: 'pill-revision'  },
    { key: 'new',       label: 'New',            icon: '⚪', cls: 'pill-new'       },
    { key: 'learning',  label: 'Learning',       icon: '🟡', cls: 'pill-learning'  },
    { key: 'reviewing', label: 'Reviewing',      icon: '🔵', cls: 'pill-reviewing' },
    { key: 'mastered',  label: 'Mastered',       icon: '🟢', cls: 'pill-mastered'  },
  ].filter(e => totals[e.key] > 0)

  if (!entries.length) return null

  return (
    <div className="deck-summary">
      {entries.map(({ key, label, icon, cls }) => (
        <span key={key} className={`pill ${cls}`}>
          {icon} {label}: {totals[key]}
        </span>
      ))}
    </div>
  )
}

function NextReview({ date }) {
  const label = nextReviewLabel(date)
  if (!label) return null
  return (
    <p className="concept-next-review">
      Next review: <strong>{label}</strong>
    </p>
  )
}

export default function Analytics({ deckId, onBrowse }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/decks/${deckId}/analytics`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [deckId])

  if (loading) return <p className="state-message">Loading analytics…</p>
  if (!data) return null

  if (!data.hasReviews) {
    return (
      <>
        <DeckSummary concepts={data.concepts} />
        <p className="analytics-header" style={{ marginTop: 20 }}>Concepts</p>
        <p className="state-message" style={{ paddingTop: 12 }}>
          No reviews yet — start reviewing to see accuracy stats.
        </p>
        {data.concepts.map(c => (
          <div key={c.concept} className="card concept-row">
            <div className="concept-row-top">
              <p className="concept-name">{c.concept}</p>
              <div className="concept-row-actions">
                <StatusBadge concept={c} />
                {onBrowse && (
                  <button className="btn-browse-concept" onClick={() => onBrowse(c.concept)}>
                    Browse →
                  </button>
                )}
              </div>
            </div>
            <NextReview date={c.nextReviewDate} />
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      <DeckSummary concepts={data.concepts} />
      <p className="analytics-header" style={{ marginTop: 20 }}>Weakest concepts first</p>
      {data.concepts.map(c => (
        <div key={c.concept} className="card concept-row">
          <div className="concept-row-top">
            <p className="concept-name">{c.concept}</p>
            <div className="concept-row-actions">
              <StatusBadge concept={c} />
              {onBrowse && (
                <button className="btn-browse-concept" onClick={() => onBrowse(c.concept)}>
                  Browse →
                </button>
              )}
            </div>
          </div>

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

          <NextReview date={c.nextReviewDate} />
        </div>
      ))}
    </>
  )
}
