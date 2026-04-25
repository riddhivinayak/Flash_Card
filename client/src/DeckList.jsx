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
        <h1 className="deck-list-title">My Decks</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="tab-btn active" onClick={onUpload}>+ Upload</button>
          <button className="tab-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {decks.length === 0 && (
        <p className="state-message">No decks yet — upload a PDF to get started.</p>
      )}

      {decks.map(deck => (
        <div key={deck._id} className="deck-item" onClick={() => onSelect(deck._id, deck.title)}>
          <div className="deck-item-top">
            <span className="deck-item-title">{deck.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {deck.dueCount > 0 && (
                <span className="deck-due-badge">{deck.dueCount} due</span>
              )}
              <button
                className="btn-deck-delete"
                onClick={e => handleDelete(e, deck._id)}
                disabled={deletingId === deck._id}
                title="Delete deck"
              >
                {deletingId === deck._id ? '…' : '✕'}
              </button>
            </div>
          </div>
          <div className="deck-item-meta">
            <span>{deck.cardCount} cards</span>
            {deck.accuracyRate !== null
              ? <span className={accuracyClass(deck.accuracyRate)}>{(deck.accuracyRate * 100).toFixed(0)}% accuracy</span>
              : <span style={{ color: '#bbb' }}>Not reviewed yet</span>
            }
          </div>
        </div>
      ))}
    </div>
  )
}

function accuracyClass(rate) {
  if (rate >= 0.75) return 'acc-high'
  if (rate >= 0.5)  return 'acc-mid'
  return 'acc-low'
}
