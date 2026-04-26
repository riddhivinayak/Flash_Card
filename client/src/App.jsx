import { useState, useEffect, useRef } from 'react'
import Review from './Review'
import Analytics from './Analytics'
import BrowseCards from './BrowseCards'
import DeckList from './DeckList'

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('fc_token') }
function setToken(t) { localStorage.setItem('fc_token', t) }
function clearToken() { localStorage.removeItem('fc_token') }

export function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ── Auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', login: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(null) }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body = mode === 'register'
        ? { username: form.username, email: form.email, password: form.password }
        : { login: form.login, password: form.password }

      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Something went wrong.')
      setToken(data.token)
      onAuth(data.user)
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">Flashcard</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Sign in to your account' : 'Create an account'}</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(null) }}>Login</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(null) }}>Register</button>
        </div>

        <form className="upload-form" onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" type="text" value={form.username} onChange={e => set('username', e.target.value)} placeholder="johndoe" required />
            </div>
          )}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
            </div>
          )}
          {mode === 'login' && (
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input className="form-input" type="text" value={form.login} onChange={e => set('login', e.target.value)} placeholder="johndoe or you@example.com" required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="upload-error">{error}</p>}
          <button className="btn-upload" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // null = deck list, string = deck detail view
  const [deckId, setDeckId] = useState(null)
  const [deckTitle, setDeckTitle] = useState('')
  const [view, setView] = useState('review')  // 'review' | 'browse' | 'analytics' | 'upload'
  const [browseFilter, setBrowseFilter] = useState(null) // concept string or null

  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const [uploadWarning, setUploadWarning] = useState(null)
  const [uploadedDeck, setUploadedDeck] = useState(null)
  const uploadMsgTimer = useRef(null)

  // On mount: validate token
  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return }
    fetch('/api/decks', { headers: authHeaders() })
      .then(r => {
        if (r.status === 401) { clearToken(); setAuthChecked(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        const payload = JSON.parse(atob(getToken().split('.')[1]))
        setUser({ id: payload.userId })
        setAuthChecked(true)
      })
      .catch(() => { setAuthChecked(true) })
  }, [])

  function handleAuth(u) {
    setUser(u)
  }

  function selectDeck(id, title) {
    setDeckId(id)
    setDeckTitle(title || '')
    setView('review')
  }

  function backToList() {
    setDeckId(null)
    setDeckTitle('')
    setView('review')
    setBrowseFilter(null)
    setUploadWarning(null)
    setUploadedDeck(null)
  }

  function handleBrowse(concept = null) {
    setBrowseFilter(concept)
    setView('browse')
  }

  const UPLOAD_MESSAGES = [
    'Uploading PDF…',
    'Generating flashcards…',
    'Analyzing document…',
    'Processing content…',
    'Almost there…',
  ]

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return setUploadError('Select a PDF file first.')
    setUploading(true)
    setUploadError(null)

    // Cycle through status messages while waiting
    let msgIndex = 0
    setUploadMsg(UPLOAD_MESSAGES[0])
    uploadMsgTimer.current = setInterval(() => {
      msgIndex = (msgIndex + 1) % UPLOAD_MESSAGES.length
      setUploadMsg(UPLOAD_MESSAGES[msgIndex])
    }, 3500)

    const form = new FormData()
    form.append('pdf', file)
    form.append('title', title.trim() || file.name.replace(/\.pdf$/i, ''))

    try {
      const res = await fetch('/api/decks/upload', { method: 'POST', headers: authHeaders(), body: form })
      const data = await res.json()
      if (!res.ok) return setUploadError(data.error || 'Upload failed.')

      setFile(null)
      setTitle('')

      if (data.warning) {
        setUploadWarning(data.warning)
        setUploadedDeck({ id: data.deck._id, title: data.deck.title })
      } else {
        selectDeck(data.deck._id, data.deck.title)
      }
    } catch {
      setUploadError('Upload failed. Is the server running?')
    } finally {
      clearInterval(uploadMsgTimer.current)
      setUploadMsg('')
      setUploading(false)
    }
  }

  function logout() {
    clearToken()
    setUser(null)
    setDeckId(null)
    setDeckTitle('')
    setView('review')
  }

  if (!authChecked) return null
  if (!user) return <AuthScreen onAuth={handleAuth} />

  // ── Upload screen (accessible from both deck list and deck detail) ──
  if (view === 'upload') {
    return (
      <div className="app">
        <div className="header">
          <button className="btn-back" onClick={backToList}>← Back</button>
          <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={logout}>Logout</button>
        </div>
        <div className="card">
          <form className="upload-form" onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Title (optional)</label>
              <input className="form-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to use filename" />
            </div>
            <div className="form-group">
              <label className="form-label">PDF file</label>
              <input className="form-input" type="file" accept=".pdf" onChange={e => { setFile(e.target.files[0]); setUploadError(null); setUploadWarning(null); setUploadedDeck(null) }} />
            </div>
            {uploadError && <p className="upload-error">{uploadError}</p>}
            {uploading && (
              <div className="upload-progress">
                <span className="upload-progress-dot" />
                <p className="upload-progress-text">{uploadMsg}</p>
              </div>
            )}
            {!uploadWarning && (
              <button className="btn-upload" type="submit" disabled={uploading}>
                {uploading ? uploadMsg || 'Uploading…' : 'Upload & Generate Cards'}
              </button>
            )}
          </form>
          {uploadWarning && (
            <div className="upload-warning">
              <p className="upload-warning-text">⚠️ {uploadWarning}</p>
              <button
                className="btn-upload"
                onClick={() => selectDeck(uploadedDeck.id, uploadedDeck.title)}
              >
                View Deck →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Deck list ──
  if (!deckId) {
    return (
      <DeckList
        onSelect={(id, title) => selectDeck(id, title)}
        onUpload={() => setView('upload')}
        onLogout={logout}
      />
    )
  }

  // ── Deck detail (Review / Analytics) ──
  return (
    <div className="app">
      <div className="header">
        <button className="btn-back" onClick={backToList}>← Decks</button>
        {deckTitle && <span className="deck-detail-title">{deckTitle}</span>}
        <div className="tabs">
          <button className={`tab-btn ${view === 'review' ? 'active' : ''}`} onClick={() => setView('review')}>Review</button>
          <button className={`tab-btn ${view === 'browse' ? 'active' : ''}`} onClick={() => handleBrowse(null)}>Browse</button>
          <button className={`tab-btn ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}>Analytics</button>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setView('upload')}>+ Upload</button>
          <button className="btn-secondary" onClick={logout}>Logout</button>
        </div>
      </div>

      {view === 'review'    && <Review      key={deckId} deckId={deckId} />}
      {view === 'browse'    && <BrowseCards key={`${deckId}-${browseFilter}`} deckId={deckId} conceptFilter={browseFilter} />}
      {view === 'analytics' && <Analytics   key={deckId} deckId={deckId} onBrowse={handleBrowse} />}
    </div>
  )
}
