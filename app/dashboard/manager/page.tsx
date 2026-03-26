'use client'
// app/dashboard/manager/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── TYPES ──────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; role: string; company?: string; serviceCategory?: string; avatarUrl?: string; connectionStatus?: string }
interface Property { id: string; name: string; address: string; platform?: string; beds?: number; baths?: number; notes?: string }
interface Connection { id: string; status: string; type: string; manager: User; provider: User }
interface Notification { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string }
interface Job { id: string; displayName: string; propertyLabel: string; checkoutTime: string; platform: string }

type Tab = 'overview' | 'properties' | 'team' | 'find'

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumber', electrical: 'Electrician', lawn: 'Lawn Care',
  snow: 'Snow Removal', handyman: 'Handyman', pest: 'Pest Control',
  hvac: 'HVAC', painting: 'Painting', roofing: 'Roofing', other: 'Other',
  cleaner: 'Cleaner',
}

const CATEGORY_COLORS: Record<string, string> = {
  plumbing: '#2196f3', electrical: '#ffb86c', lawn: '#00e5a0',
  snow: '#a78bfa', handyman: '#ff8fa3', pest: '#ff5370',
  hvac: '#5bb8ff', painting: '#f9b3e8', roofing: '#ffb86c',
  cleaner: '#00e6d2', other: '#7fb3cc',
}

function catColor(c: string) { return CATEGORY_COLORS[c] || '#7fb3cc' }
function catLabel(c: string) { return CATEGORY_LABELS[c] || c }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function fmtRel(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

// ── SHARED LAYOUT ──────────────────────────────────────────────────────────
function Shell({ user, children, tab, setTab, notifCount }: {
  user: User; children: React.ReactNode; tab: Tab; setTab: (t: Tab) => void; notifCount: number
}) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'properties', label: 'Properties' },
    { id: 'team',       label: 'My Team' },
    { id: 'find',       label: 'Find Providers' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top nav */}
      <nav style={{ background: 'rgba(9,20,32,0.97)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 0, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--cyan-b)', textShadow: '0 0 16px rgba(0,230,210,0.6)', marginRight: 32, letterSpacing: '.4px' }}>
          CleanSync
        </div>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.id ? 'rgba(0,230,210,0.12)' : 'transparent',
              color: tab === t.id ? 'var(--cyan-b)' : 'var(--text-muted)',
              fontFamily: "'DM Sans', sans-serif", transition: 'all .14s',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {notifCount > 0 && (
            <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 7px', minWidth: 20, textAlign: 'center' }}>
              {notifCount}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {user.name} <span style={{ color: 'var(--dim)', fontSize: 10 }}>· Manager</span>
          </div>
          <button onClick={logout} style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Sign out
          </button>
        </div>
      </nav>
      <main style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}

// ── OVERVIEW TAB ───────────────────────────────────────────────────────────
function OverviewTab({ properties, connections, jobs, notifications, onMarkRead }: {
  properties: Property[]; connections: Connection[]; jobs: Job[];
  notifications: Notification[]; onMarkRead: () => void
}) {
  const activeTeam = connections.filter(c => c.status === 'active')
  const pending = connections.filter(c => c.status === 'pending' && c.provider)
  const unread = notifications.filter(n => !n.readAt)

  const upcomingJobs = jobs
    .filter(j => new Date(j.checkoutTime) >= new Date())
    .sort((a, b) => new Date(a.checkoutTime).getTime() - new Date(b.checkoutTime).getTime())
    .slice(0, 8)

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Properties', value: properties.length, color: 'var(--cyan-b)' },
          { label: 'Team Members', value: activeTeam.length, color: 'var(--green)' },
          { label: 'Pending Invites', value: pending.length, color: 'var(--amber)' },
          { label: 'Upcoming Jobs', value: upcomingJobs.length, color: 'var(--blue-b)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: s.color, textShadow: `0 0 12px ${s.color}50` }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Upcoming jobs */}
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: 12 }}>Upcoming Jobs</div>
          {upcomingJobs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '20px 0' }}>No upcoming jobs synced yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingJobs.map(j => (
                <div key={j.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{j.propertyLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700, flexShrink: 0 }}>{fmtDate(j.checkoutTime)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--cyan)' }}>Notifications</div>
            {unread.length > 0 && (
              <button onClick={onMarkRead} style={{ fontSize: 10, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '20px 0' }}>No notifications yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notifications.slice(0, 8).map(n => (
                <div key={n.id} style={{
                  background: n.readAt ? 'var(--surface)' : 'rgba(0,230,210,0.06)',
                  border: `1px solid ${n.readAt ? 'var(--border)' : 'rgba(0,230,210,0.2)'}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{fmtRel(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PROPERTIES TAB ─────────────────────────────────────────────────────────
function PropertiesTab({ properties, onRefresh }: { properties: Property[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', platform: 'manual', beds: '', baths: '', notes: '', accessCode: '', wifiName: '', wifiPass: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function addProperty() {
    if (!form.name || !form.address) { setErr('Name and address required'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setShowAdd(false); setForm({ name: '', address: '', platform: 'manual', beds: '', baths: '', notes: '', accessCode: '', wifiName: '', wifiPass: '' }); onRefresh() }
    else { const d = await res.json(); setErr(d.error || 'Failed') }
    setSaving(false)
  }

  async function deleteProperty(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const inp = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: 'none', marginBottom: 8 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)' }}>Properties</div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
          + Add Property
        </button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>New Property</div>
          {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inp} placeholder="Property name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <input style={inp} placeholder="Address *" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            <select style={inp} value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
              <option value="manual">Manual</option>
              <option value="airbnb">Airbnb</option>
              <option value="hostaway">Hostaway</option>
            </select>
            <input style={inp} placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <input style={inp} placeholder="Beds" type="number" value={form.beds} onChange={e => setForm(p => ({ ...p, beds: e.target.value }))} />
            <input style={inp} placeholder="Baths" type="number" step="0.5" value={form.baths} onChange={e => setForm(p => ({ ...p, baths: e.target.value }))} />
            <input style={inp} placeholder="Access code (private)" value={form.accessCode} onChange={e => setForm(p => ({ ...p, accessCode: e.target.value }))} />
            <input style={inp} placeholder="WiFi name" value={form.wifiName} onChange={e => setForm(p => ({ ...p, wifiName: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '8px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>Cancel</button>
            <button onClick={addProperty} disabled={saving} style={{ flex: 2, padding: '8px', borderRadius: 7, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
              {saving ? 'Saving...' : 'Save Property'}
            </button>
          </div>
        </div>
      )}

      {properties.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '60px 0' }}>No properties yet. Add your first one above.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {properties.map(p => (
            <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', transition: 'all .2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.address}</div>
                </div>
                <button onClick={() => deleteProperty(p.id, p.name)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 2px', opacity: .7 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.platform && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--cyan-bg)', color: 'var(--cyan)', border: '1px solid var(--cyan-border)' }}>{p.platform}</span>}
                {p.beds && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.beds} bed</span>}
                {p.baths && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.baths} bath</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TEAM TAB ───────────────────────────────────────────────────────────────
function TeamTab({ connections, onRefresh }: { connections: Connection[]; onRefresh: () => void }) {
  const active  = connections.filter(c => c.status === 'active')
  const pending = connections.filter(c => c.status === 'pending')

  async function remove(id: string) {
    if (!confirm('Remove this connection?')) return
    await fetch(`/api/connections/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  function ProviderCard({ conn }: { conn: Connection }) {
    const p = conn.provider
    const color = catColor(conn.type)
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color }}>
          {p.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.company || p.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${color}18`, color, border: `1px solid ${color}35` }}>
            {catLabel(conn.type)}
          </span>
          {conn.status === 'pending' && <span style={{ fontSize: 10, color: 'var(--amber)' }}>Pending</span>}
          <button onClick={() => remove(conn.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, opacity: .6 }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>My Team</div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 10 }}>Pending ({pending.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(c => <ProviderCard key={c.id} conn={c} />)}
          </div>
        </div>
      )}
      {active.length === 0 && pending.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '60px 0' }}>
          No team members yet. Use <strong style={{ color: 'var(--cyan)' }}>Find Providers</strong> to invite cleaners and service providers.
        </div>
      ) : active.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 10 }}>Active ({active.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(c => <ProviderCard key={c.id} conn={c} />)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── FIND PROVIDERS TAB ─────────────────────────────────────────────────────
function FindTab({ onRefresh }: { onRefresh: () => void }) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState<'cleaner' | 'provider' | ''>('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)

  const search = useCallback(async () => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    const params = new URLSearchParams({ q })
    if (role) params.set('role', role)
    const res = await fetch(`/api/users/search?${params}`)
    const data = await res.json()
    setResults(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [q, role])

  useEffect(() => { const t = setTimeout(search, 350); return () => clearTimeout(t) }, [search])

  async function invite(userId: string, type: string) {
    setInviting(userId)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: userId, type }),
    })
    if (res.ok) {
      setResults(r => r.map(u => u.id === userId ? { ...u, connectionStatus: 'pending' } : u))
      onRefresh()
    }
    setInviting(null)
  }

  const inp = { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: 'none', width: '100%' }

  return (
    <div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>Find Providers</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="Search by name, company or email..." value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...inp, width: 160 }} value={role} onChange={e => setRole(e.target.value as any)}>
          <option value="">All roles</option>
          <option value="cleaner">Cleaners</option>
          <option value="provider">Service Providers</option>
        </select>
      </div>

      {loading && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Searching...</div>}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(u => {
            const color = catColor(u.serviceCategory || (u.role === 'cleaner' ? 'cleaner' : 'other'))
            const alreadyConnected = u.connectionStatus === 'active'
            const isPending = u.connectionStatus === 'pending'
            return (
              <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.company || u.email}</div>
                  {u.serviceCategory && <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{catLabel(u.serviceCategory)}</div>}
                </div>
                <div>
                  {alreadyConnected ? (
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Connected</span>
                  ) : isPending ? (
                    <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>Pending</span>
                  ) : (
                    <button
                      onClick={() => invite(u.id, u.role === 'cleaner' ? 'cleaner' : (u.serviceCategory || 'other'))}
                      disabled={inviting === u.id}
                      style={{ padding: '6px 16px', borderRadius: 7, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}
                    >
                      {inviting === u.id ? '...' : '+ Invite'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && q.length >= 2 && results.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No users found for "{q}"</div>
      )}

      {q.length < 2 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Type at least 2 characters to search</div>
      )}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [properties, setProperties] = useState<Property[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== 'manager') { router.push('/login'); return }
      setUser(d.user)
    })
  }, [router])

  const loadData = useCallback(async () => {
    const [propsRes, connRes, jobsRes, notifRes] = await Promise.all([
      fetch('/api/properties'),
      fetch('/api/connections'),
      fetch('/api/jobs'),
      fetch('/api/notifications'),
    ])
    const [props, conns, jobsData, notifs] = await Promise.all([
      propsRes.json(), connRes.json(), jobsRes.json(), notifRes.json(),
    ])
    setProperties(Array.isArray(props) ? props : [])
    setConnections(Array.isArray(conns) ? conns : [])
    setJobs(Array.isArray(jobsData) ? jobsData : [])
    setNotifications(Array.isArray(notifs) ? notifs : [])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: 'all' }) })
    loadData()
  }

  if (!user || loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1f2d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(0,230,210,0.2)', borderTopColor: '#00e6d2', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const unreadCount = notifications.filter(n => !n.readAt).length

  return (
    <Shell user={user} tab={tab} setTab={setTab} notifCount={unreadCount}>
      {tab === 'overview'   && <OverviewTab properties={properties} connections={connections} jobs={jobs} notifications={notifications} onMarkRead={markAllRead} />}
      {tab === 'properties' && <PropertiesTab properties={properties} onRefresh={loadData} />}
      {tab === 'team'       && <TeamTab connections={connections} onRefresh={loadData} />}
      {tab === 'find'       && <FindTab onRefresh={loadData} />}
    </Shell>
  )
}
