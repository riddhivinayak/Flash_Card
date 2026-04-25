import { useState, useEffect } from 'react'
import { authHeaders } from './App'
import Flashcard from './Flashcard'

export default function BrowseCards({ deckId, conceptFilter = null }) {
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/decks/${deckId}/cards`, { headers: authHeaders() })
      .then(r => r.json())
      .then(all => {
        const filtered = conceptFilter
          ? all.filter(c => c.concept === conceptFilter)
          : all
        setCards(filtered)
        setLoading(false)
      })
  }, [deckId, conceptFilter])

  function go(dir) {
    setIndex(i => Math.max(0, Math.min(cards.length - 1, i + dir)))
    setFlipped(false)
  }

  if (loading) return <p className="state-message">Loading cards…</p>
  if (!cards.length) return (
    <p className="state-message">
      {conceptFilter ? `No cards found for "${conceptFilter}".` : 'No cards in this deck.'}
    </p>
  )

  const current = cards[index]

  return (
    <>
      <div className="browse-header">
        <p className="progress">{index + 1} / {cards.length}</p>
        {conceptFilter && (
          <span className="browse-filter-label">{conceptFilter}</span>
        )}
      </div>

      {/*
        key="${index}-${flipped}" re-mounts Flashcard on each flip direction change:
        - front→back: mounts with flipped=true, animation plays
        - back→front: mounts with flipped=false, snaps to front (no reverse animation needed)
      */}
      <Flashcard
        key={`${index}-${flipped ? 'b' : 'f'}`}
        card={current}
        flipped={flipped}
      />

      <div className="browse-controls">
        <button
          className="browse-nav-btn"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          ← Prev
        </button>
        <button
          className="btn-show-answer browse-flip-btn"
          onClick={() => setFlipped(f => !f)}
        >
          {flipped ? 'Show Question' : 'Show Answer'}
        </button>
        <button
          className="browse-nav-btn"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
        >
          Next →
        </button>
      </div>
    </>
  )
}
