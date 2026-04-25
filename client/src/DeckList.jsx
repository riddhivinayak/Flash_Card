import { useState, useEffect } from 'react'
import { authHeaders } from './App'

export default function DeckList({ onSelect, onUpload, onLogout }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/decks', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setDecks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
            {deck.dueCount > 0 && (
              <span className="deck-due-badge">{deck.dueCount} due</span>
            )}
          </div>
          <div className="deck-item-meta">
            <span>{deck.cardCount} cards</span>
            {deck.accuracyRate !== null && (
              <span className={accuracyClass(deck.accuracyRate)}>
                {(deck.accuracyRate * 100).toFixed(0)}% accuracy
              </span>
            )}
            {deck.accuracyRate === null && (
              <span style={{ color: '#bbb' }}>Not reviewed yet</span>
            )}
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
