import { useState, useEffect } from 'react'
import { authHeaders } from './App'

export default function DeckList({ onSelect, onUpload, onLogout }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    fetch('/api/decks', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setDecks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(e, deckId) {
    e.stopPropagation()
    if (!window.confirm('Delete this deck? All cards and progress will be permanently removed.')) return
    setDeletingId(deckId)
    try {
      await fetch(`/api/decks/${deckId}`, { method: 'DELETE', headers: authHeaders() })
      setDecks(prev => prev.filter(d => d._id !== deckId))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <p className="state-message">Loading decks…</p>

  return (
    <div className="app">
      <div className="deck-list-header">
        <div>
          <h1 className="deck-list-title">My Decks</h1>
          {decks.length > 0 && (
            <p className="deck-list-subtitle">{decks.length} deck{decks.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={onUpload}>+ Upload PDF</button>
          <button className="btn-secondary" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No decks yet</p>
          <p className="empty-state-body">Upload a PDF to generate your first flashcard deck.</p>
          <button className="btn-primary" onClick={onUpload}>Upload a PDF</button>
        </div>
      ) : (
        <div className="deck-grid">
          {decks.map(deck => (
            <div key={deck._id} className="deck-card" onClick={() => onSelect(deck._id, deck.title)}>
              <div className="deck-card-header">
                <h3 className="deck-card-title">{deck.title}</h3>
                <button
                  className="btn-deck-delete"
                  onClick={e => handleDelete(e, deck._id)}
                  disabled={deletingId === deck._id}
                  title="Delete deck"
                >
                  {deletingId === deck._id ? '…' : '✕'}
                </button>
              </div>

              <div className="deck-card-stats">
                <span className="deck-stat-chip">{deck.cardCount} cards</span>
                {deck.dueCount > 0 && (
                  <span className="deck-due-badge">🔥 {deck.dueCount} due</span>
                )}
                {deck.accuracyRate !== null && (
                  <span className={`deck-stat-chip ${accuracyClass(deck.accuracyRate)}`}>
                    {(deck.accuracyRate * 100).toFixed(0)}% accuracy
                  </span>
                )}
              </div>

              {deck.accuracyRate !== null ? (
                <div className="deck-progress-bar">
                  <div
                    className={`deck-progress-fill ${progressFillClass(deck.accuracyRate)}`}
                    style={{ width: `${(deck.accuracyRate * 100).toFixed(0)}%` }}
                  />
                </div>
              ) : (
                <p className="deck-not-reviewed">Not reviewed yet</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function accuracyClass(rate) {
  if (rate >= 0.75) return 'acc-high'
  if (rate >= 0.5)  return 'acc-mid'
  return 'acc-low'
}

function progressFillClass(rate) {
  if (rate >= 0.75) return 'strong'
  if (rate >= 0.5)  return 'mid-prog'
  return 'weak'
}
