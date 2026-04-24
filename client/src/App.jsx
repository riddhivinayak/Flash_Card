import { useState, useEffect } from 'react'
import Review from './Review'
import Analytics from './Analytics'

export default function App() {
  const [decks, setDecks] = useState([])
  const [deckId, setDeckId] = useState(null)
  const [view, setView] = useState('review')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/decks')
      .then(r => r.json())
      .then(data => {
        setDecks(data)
        if (data.length) setDeckId(data[0]._id)
      })
      .catch(() => setError('Could not reach the server. Is it running?'))
  }, [])

  if (error) return <div className="app"><p className="state-message">{error}</p></div>
  if (!decks.length) return <div className="app"><p className="state-message">No decks found. Upload a PDF first.</p></div>

  return (
    <div className="app">
      <div className="header">
        <select
          className="deck-select"
          value={deckId || ''}
          onChange={e => setDeckId(e.target.value)}
        >
          {decks.map(d => (
            <option key={d._id} value={d._id}>{d.title}</option>
          ))}
        </select>

        <div className="tabs">
          <button
            className={`tab-btn ${view === 'review' ? 'active' : ''}`}
            onClick={() => setView('review')}
          >
            Review
          </button>
          <button
            className={`tab-btn ${view === 'analytics' ? 'active' : ''}`}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
        </div>
      </div>

      {view === 'review'    && deckId && <Review    key={deckId} deckId={deckId} />}
      {view === 'analytics' && deckId && <Analytics key={deckId} deckId={deckId} />}
    </div>
  )
}
