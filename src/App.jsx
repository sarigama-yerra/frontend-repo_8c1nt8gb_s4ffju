import React, { useEffect, useMemo, useState } from 'react'
import { LogIn, Play, ScanSearch, Settings, Shield, Key, Activity, TerminalSquare } from 'lucide-react'
import io from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

function useSocket(token) {
  const [socket, setSocket] = useState(null)
  useEffect(() => {
    if (!token) return
    const s = io(`${BACKEND_URL}/ws`, { transports: ['websocket'] })
    setSocket(s)
    return () => s.close()
  }, [token])
  return socket
}

function LoginModal({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('admin@betkido.local')
  const [password, setPassword] = useState('adminpass')
  const [loading, setLoading] = useState(false)

  if (!open) return null
  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      onLogin(data)
      onClose()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-blue-500/30 p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-white"><Shield className="w-5 h-5 text-blue-400"/> Betkido Admin Login</div>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
          <input type="password" className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
          <button disabled={loading} className="w-full rounded-md bg-blue-600 hover:bg-blue-500 text-white py-2 flex items-center justify-center gap-2"><LogIn className="w-4 h-4"/>{loading? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  )
}

function Stat({label, value}){
  return (
    <div className="flex-1 rounded-xl bg-slate-800/60 border border-slate-700 p-4">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="text-white text-2xl font-semibold">{value}</div>
    </div>
  )
}

function LogsPanel({ socket }){
  const [logs, setLogs] = useState([])
  useEffect(() => {
    if (!socket) return
    const handler = (payload) => setLogs(prev => [...prev.slice(-200), payload])
    socket.on('log', handler)
    return () => socket.off('log', handler)
  }, [socket])
  return (
    <div className="h-64 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs text-slate-300 font-mono">
      {logs.map((l,i)=> (
        <div key={i} className="whitespace-pre">
          [{l.ts}] {l.level?.padEnd(7)} - {l.message}
        </div>
      ))}
    </div>
  )
}

function Overview({ token, socket }){
  const [stats, setStats] = useState({ total_searches: 0, total_keys_found: 0, total_validated_keys: 0, recent_scans: [] })
  const [metrics, setMetrics] = useState({ cpu: 0, memory: { percent: 0 }})
  const headers = useMemo(() => ({ 'Authorization': `Bearer ${token}` }), [token])

  useEffect(()=>{
    fetch(`${BACKEND_URL}/overview`, { headers }).then(r=>r.json()).then(setStats).catch(()=>{})
  },[token])

  useEffect(()=>{
    if (!socket) return
    const handler = (m)=> setMetrics(m)
    socket.on('metrics', handler)
    return ()=> socket.off('metrics', handler)
  },[socket])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total GitHub Searches" value={stats.total_searches} />
        <Stat label="Total Keys Found" value={stats.total_keys_found} />
        <Stat label="Total Validated Keys" value={stats.total_validated_keys} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="CPU Usage" value={`${metrics.cpu?.toFixed?.(1) || 0}%`} />
        <Stat label="Memory Usage" value={`${metrics.memory?.percent?.toFixed?.(1) || 0}%`} />
      </div>
      <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4">
        <div className="text-slate-300 mb-2">Recent scans</div>
        <div className="space-y-2 max-h-48 overflow-auto">
          {stats.recent_scans?.map((s)=> (
            <div key={s.id} className="flex items-center justify-between text-sm text-slate-200 bg-slate-900 border border-slate-700 rounded-lg p-2">
              <div className="flex items-center gap-2"><ScanSearch className="w-4 h-4 text-blue-400"/> {s.id}</div>
              <div className="text-xs text-slate-400">{s.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsPage({ token }){
  const [keys, setKeys] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(()=>{
    fetch(`${BACKEND_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}`}}).then(r=>r.json()).then(d=> setKeys((d.github_keys||[]).join('\n')))
  },[])
  const save = async ()=>{
    setSaving(true)
    await fetch(`${BACKEND_URL}/settings`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ github_keys: keys.split(/\n+/).map(s=>s.trim()).filter(Boolean) }) })
    setSaving(false)
    alert('Saved')
  }
  return (
    <div className="space-y-3">
      <div className="text-slate-300">GitHub API Keys (one per line)</div>
      <textarea className="w-full h-40 rounded-md bg-slate-900 border border-slate-700 p-3 text-slate-200" value={keys} onChange={e=>setKeys(e.target.value)} />
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white">{saving? 'Saving...' : 'Save'}</button>
    </div>
  )
}

function KeysPage({ token }){
  const [items, setItems] = useState([])
  useEffect(()=>{
    fetch(`${BACKEND_URL}/keys`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r=>r.json()).then(d=> setItems(d.items||[]))
  },[])
  return (
    <div className="space-y-2">
      {items.map((k,i)=> (
        <div key={i} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200">
          <div className="flex items-center gap-2"><Key className="w-4 h-4 text-emerald-400"/> {k.repo}</div>
          <div className="text-xs text-slate-400">{k.validated? 'validated' : 'unverified'}</div>
        </div>
      ))}
      {!items.length && <div className="text-slate-400">No keys yet.</div>}
    </div>
  )
}

function ScanPage({ token, socket }){
  const [active, setActive] = useState(null)
  const [events, setEvents] = useState([])
  const headers = useMemo(()=> ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}), [token])
  const refresh = ()=> fetch(`${BACKEND_URL}/scan/active`, { headers }).then(r=>r.json()).then(setActive)
  useEffect(()=>{ refresh() },[])
  useEffect(()=>{
    if (!socket) return
    const handler = (e)=> setEvents(prev=>[...prev, e])
    socket.on('scan_event', handler)
    return ()=> socket.off('scan_event', handler)
  },[socket])

  const start = async()=>{
    const res = await fetch(`${BACKEND_URL}/scan/start`, { method: 'POST', headers, body: JSON.stringify({}) })
    if (!res.ok){ const d = await res.json(); alert(d.detail||'Cannot start'); return }
    const d = await res.json()
    setActive(d.scan)
  }

  return (
    <div className="space-y-3">
      {!active?.status && (
        <button onClick={start} className="px-4 py-2 rounded-md bg-emerald-600 text-white flex items-center gap-2"><Play className="w-4 h-4"/>Start new scan</button>
      )}
      {active?.status && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ScanSearch className="w-4 h-4 text-blue-400"/> Active scan: {active.id}</div>
            <div className="text-xs text-slate-400">{active.status}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Repos Scanned" value={active.stats?.scanned||0} />
            <Stat label="Findings" value={active.stats?.findings||0} />
            <Stat label="Validated" value={active.stats?.validated||0} />
          </div>
        </div>
      )}
      <div>
        <div className="text-slate-300 mb-2 flex items-center gap-2"><TerminalSquare className="w-4 h-4 text-slate-400"/> Live scan log</div>
        <div className="h-64 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs text-slate-300 font-mono">
          {events.map((e,i)=> (
            <div key={i}>[{new Date().toISOString()}] {JSON.stringify(e)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ValidateGithubKey({ token }){
  const [key, setKey] = useState('')
  const [result, setResult] = useState(null)
  const submit = async ()=>{
    const r = await fetch(`${BACKEND_URL}/validate/github-key`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ key }) })
    const d = await r.json()
    setResult(d.valid)
  }
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4">
      <div className="text-slate-300 mb-2">Test a GitHub API key</div>
      <div className="flex gap-2">
        <input value={key} onChange={e=>setKey(e.target.value)} className="flex-1 rounded-md bg-slate-900 border border-slate-700 p-2 text-slate-200" placeholder="ghp_xxx..."/>
        <button onClick={submit} className="px-3 rounded-md bg-blue-600 text-white">Validate</button>
      </div>
      {result!==null && <div className="text-sm mt-2 {result? 'text-emerald-400' : 'text-red-400'}">{result? 'Valid' : 'Invalid'}</div>}
    </div>
  )
}

function Navbar({ current, setCurrent, onOpenLogin, authed }){
  const items = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'scan', label: 'Scan', icon: ScanSearch },
    { id: 'keys', label: 'Keys', icon: Key },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="text-white text-xl font-semibold">Betkido</div>
      <div className="flex items-center gap-2">
        {items.map(it=> (
          <button key={it.id} onClick={()=>setCurrent(it.id)} className={`px-3 py-1.5 rounded-md text-sm ${current===it.id? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
            <div className="flex items-center gap-2"><it.icon className="w-4 h-4"/>{it.label}</div>
          </button>
        ))}
        {!authed && <button onClick={onOpenLogin} className="px-3 py-1.5 rounded-md bg-blue-600 text-white flex items-center gap-2"><LogIn className="w-4 h-4"/> Login</button>}
      </div>
    </div>
  )
}

export default function App(){
  const [page, setPage] = useState('overview')
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState(()=> {
    const token = localStorage.getItem('betkido_token')
    const email = localStorage.getItem('betkido_email')
    return token? { token, email } : null
  })
  const socket = useSocket(user?.token)

  const onLogin = (data)=>{
    setUser({ token: data.token, email: data.email })
    localStorage.setItem('betkido_token', data.token)
    localStorage.setItem('betkido_email', data.email)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto p-6">
        <Navbar current={page} setCurrent={setPage} onOpenLogin={()=>setLoginOpen(true)} authed={!!user} />
        {!user && (
          <div className="rounded-2xl border border-blue-500/20 bg-slate-900/60 p-10 text-center text-slate-300">
            Welcome to Betkido. Please sign in to access the dashboard.
          </div>
        )}
        {user && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              {page==='overview' && <Overview token={user.token} socket={socket} />}
              {page==='scan' && <ScanPage token={user.token} socket={socket} />}
              {page==='keys' && <KeysPage token={user.token} />}
              {page==='settings' && <SettingsPage token={user.token} />}
            </div>
            <div className="space-y-6">
              <ValidateGithubKey token={user.token} />
              <LogsPanel socket={socket} />
            </div>
          </div>
        )}
      </div>

      <LoginModal open={loginOpen} onClose={()=>setLoginOpen(false)} onLogin={onLogin} />
    </div>
  )
}
