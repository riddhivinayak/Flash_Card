import { useState, useEffect } from 'react'
import Review from './Review'
import Analytics from './Analytics'

export default function App() {
  const [decks, setDecks] = useState([])
  const [deckId, setDeckId] = useState(null)
  const [view, setView] = useState('review')
  const [error, setError] = useState(null)

  // Upload state
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    fetch('/api/decks')
      .then(r => r.json())
      .then(data => {
        setDecks(data)
        if (data.length) {
          setDeckId(data[0]._id)
        } else {
          setView('upload')
        }
      })
      .catch(() => setError('Could not reach the server. Is it running?'))
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return setUploadError('Select a PDF file first.')

    setUploading(true)
    setUploadError(null)

    const form = new FormData()
    form.append('pdf', file)
    form.append('title', title.trim() || file.name.replace(/\.pdf$/i, ''))

    try {
      const res = await fetch('/api/decks/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) return setUploadError(data.error || 'Upload failed.')

      const fresh = await fetch('/api/decks').then(r => r.json())
      setDecks(fresh)
      setDeckId(data.deck._id)
      setFile(null)
      setTitle('')
      setView('review')
    } catch {
      setUploadError('Upload failed. Is the server running?')
    } finally {
      setUploading(false)
    }
  }

  if (error) return <div className="app"><p className="state-message">{error}</p></div>

  return (
    <div className="app">
      <div className="header">
        {decks.length > 0 && (
          <select
            className="deck-select"
            value={deckId || ''}
            onChange={e => setDeckId(e.target.value)}
          >
            {decks.map(d => (
              <option key={d._id} value={d._id}>{d.title}</option>
            ))}
          </select>
        )}

        <div className="tabs">
          {decks.length > 0 && (
            <>
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
            </>
          )}
          <button
            className={`tab-btn ${view === 'upload' ? 'active' : ''}`}
            onClick={() => setView('upload')}
          >
            + Upload
          </button>
        </div>
      </div>

      {view === 'review'    && deckId && <Review    key={deckId} deckId={deckId} />}
      {view === 'analytics' && deckId && <Analytics key={deckId} deckId={deckId} />}

      {view === 'upload' && (
        <div className="card">
          <form className="upload-form" onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Title (optional)</label>
              <input
                className="form-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Leave blank to use filename"
              />
            </div>

            <div className="form-group">
              <label className="form-label">PDF file</label>
              <input
                className="form-input"
                type="file"
                accept=".pdf"
                onChange={e => { setFile(e.target.files[0]); setUploadError(null) }}
              />
            </div>

            {uploadError && <p className="upload-error">{uploadError}</p>}

            <button className="btn-upload" type="submit" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload & Generate Cards'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
