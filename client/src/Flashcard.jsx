import { useState, useEffect } from 'react'

const TYPE_LABELS = {
  definition: 'Definition',
  concept:    'Concept',
  example:    'Example',
  edge_case:  'Edge Case',
}

export default function Flashcard({ card, flipped }) {
  // 'front' → 'exit' (rotates to 90°) → 'back' (enters from -90°)
  const [phase, setPhase] = useState('front')

  useEffect(() => {
    if (!flipped) return
    setPhase('exit')
    const t = setTimeout(() => setPhase('back'), 230)
    return () => clearTimeout(t)
  }, [flipped])

  const typeLabel = TYPE_LABELS[card.type] || card.type

  return (
    <div className="flashcard-scene">
      <div className={`flashcard${phase === 'exit' ? ' fc-exit' : phase === 'back' ? ' fc-enter' : ''}`}>
        {phase !== 'back' ? (
          <>
            <span className="badge">{typeLabel} · {card.concept}</span>
            <p className="question">{card.front}</p>
          </>
        ) : (
          <>
            <p className="answer-label">Answer</p>
            <p className="answer-text">{card.back}</p>
          </>
        )}
      </div>
    </div>
  )
}
