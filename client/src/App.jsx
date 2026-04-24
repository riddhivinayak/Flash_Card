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

  if (error) return <p>{error}</p>
  if (!decks.length) return <p>No decks found. Upload a PDF first.</p>

  return (
    <div>
      <div>
        <select value={deckId || ''} onChange={e => setDeckId(e.target.value)}>
          {decks.map(d => (
            <option key={d._id} value={d._id}>{d.title}</option>
          ))}
        </select>
        <button onClick={() => setView('review')} disabled={view === 'review'}>Review</button>
        <button onClick={() => setView('analytics')} disabled={view === 'analytics'}>Analytics</button>
      </div>

      {view === 'review' && deckId && <Review key={deckId} deckId={deckId} />}
      {view === 'analytics' && deckId && <Analytics key={deckId} deckId={deckId} />}
    </div>
  )
}
