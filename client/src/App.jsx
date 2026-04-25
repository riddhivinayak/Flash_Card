import { useState, useEffect } from 'react'
import Review from './Review'
import Analytics from './Analytics'

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

  const [decks, setDecks] = useState([])
  const [deckId, setDeckId] = useState(null)
  const [view, setView] = useState('review')
  const [error, setError] = useState(null)

  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // On mount: check if token still valid by loading decks
  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return }
    fetch('/api/decks', { headers: authHeaders() })
      .then(r => {
        if (r.status === 401) { clearToken(); setAuthChecked(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setDecks(data)
        if (data.length) setDeckId(data[0]._id)
        else setView('upload')
        // Reconstruct a minimal user object from token payload
        const payload = JSON.parse(atob(getToken().split('.')[1]))
        setUser({ id: payload.userId })
        setAuthChecked(true)
      })
      .catch(() => { setAuthChecked(true) })
  }, [])

  function handleAuth(u) {
    setUser(u)
    loadDecks()
  }

  async function loadDecks() {
    const data = await fetch('/api/decks', { headers: authHeaders() }).then(r => r.json())
    setDecks(data)
    if (data.length) { setDeckId(data[0]._id); setView('review') }
    else setView('upload')
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return setUploadError('Select a PDF file first.')
    setUploading(true)
    setUploadError(null)

    const form = new FormData()
    form.append('pdf', file)
    form.append('title', title.trim() || file.name.replace(/\.pdf$/i, ''))

    try {
      const res = await fetch('/api/decks/upload', { method: 'POST', headers: authHeaders(), body: form })
      const data = await res.json()
      if (!res.ok) return setUploadError(data.error || 'Upload failed.')

      const fresh = await fetch('/api/decks', { headers: authHeaders() }).then(r => r.json())
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

  function logout() {
    clearToken()
    setUser(null)
    setDecks([])
    setDeckId(null)
    setView('review')
  }

  if (!authChecked) return null

  if (!user) return <AuthScreen onAuth={handleAuth} />

  if (error) return <div className="app"><p className="state-message">{error}</p></div>

  return (
    <div className="app">
      <div className="header">
        {decks.length > 0 && (
          <select className="deck-select" value={deckId || ''} onChange={e => setDeckId(e.target.value)}>
            {decks.map(d => <option key={d._id} value={d._id}>{d.title}</option>)}
          </select>
        )}

        <div className="tabs">
          {decks.length > 0 && (
            <>
              <button className={`tab-btn ${view === 'review' ? 'active' : ''}`} onClick={() => setView('review')}>Review</button>
              <button className={`tab-btn ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}>Analytics</button>
            </>
          )}
          <button className={`tab-btn ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>+ Upload</button>
          <button className="tab-btn" onClick={logout}>Logout</button>
        </div>
      </div>

      {view === 'review'    && deckId && <Review    key={deckId} deckId={deckId} />}
      {view === 'analytics' && deckId && <Analytics key={deckId} deckId={deckId} />}

      {view === 'upload' && (
        <div className="card">
          <form className="upload-form" onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Title (optional)</label>
              <input className="form-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to use filename" />
            </div>
            <div className="form-group">
              <label className="form-label">PDF file</label>
              <input className="form-input" type="file" accept=".pdf" onChange={e => { setFile(e.target.files[0]); setUploadError(null) }} />
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
