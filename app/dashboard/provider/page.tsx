'use client'
// app/dashboard/provider/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string; company?: string; serviceCategory?: string }
interface Connection { id: string; status: string; type: string; manager: { id: string; name: string; email: string; company?: string } }
interface Notification { id: string; title: string; body: string; readAt: string | null; createdAt: string }

type Tab = 'overview' | 'connections' | 'schedule' | 'profile'

function fmtRel(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumber', electrical: 'Electrician', lawn: 'Lawn Care',
  snow: 'Snow Removal', handyman: 'Handyman', pest: 'Pest Control',
  hvac: 'HVAC', painting: 'Painting', roofing: 'Roofing', other: 'Other',
}

export default function ProviderDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [connections, setConnections] = useState<Connection[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== 'provider') { router.push('/login'); return }
      setUser(d.user)
    })
  }, [router])

  async function loadData() {
    const [connRes, notifRes] = await Promise.all([
      fetch('/api/connections'),
      fetch('/api/notifications'),
    ])
    const [conns, notifs] = await Promise.all([connRes.json(), notifRes.json()])
    setConnections(Array.isArray(conns) ? conns : [])
    setNotifications(Array.isArray(notifs) ? notifs : [])
    setLoading(false)
  }

  useEffect(() => { if (user) loadData() }, [user])

  async function respond(id: string, status: 'active' | 'declined') {
    setResponding(id)
    await fetch(`/api/connections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadData()
    setResponding(null)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user || loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1f2d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(0,230,210,0.2)', borderTopColor: '#00e6d2', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const pending = connections.filter(c => c.status === 'pending' && c.manager)
  const active  = connections.filter(c => c.status === 'active')
  const unread  = notifications.filter(n => !n.readAt).length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview',     label: 'Overview' },
    { id: 'connections',  label: 'Connections', badge: pending.length || undefined },
    { id: 'schedule',     label: 'My Schedule' },
    { id: 'profile',      label: 'My Profile' },
  ]

  const catLabel = user.serviceCategory ? (CATEGORY_LABELS[user.serviceCategory] || user.serviceCategory) : 'Provider'

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
            }}>
              {t.label}
              {t.badge ? <span style={{ marginLeft: 6, background: 'var(--amber)', color: '#071a24', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {unread > 0 && <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>{unread}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.name} <span style={{ color: 'var(--dim)', fontSize: 10 }}>· {catLabel}</span></div>
          <button onClick={logout} style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Sign out</button>
        </div>
      </nav>

      <main style={{ padding: '28px 24px', maxWidth: 900, margin: '0 auto' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            {/* Welcome */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(0,230,210,0.04) 0%,transparent 60%)', pointerEvents: 'none' }} />
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 6 }}>
                Welcome back, {user.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {catLabel} · {active.length} active {active.length === 1 ? 'connection' : 'connections'}
                {pending.length > 0 && <span style={{ marginLeft: 10, color: 'var(--amber)', fontWeight: 600 }}>· {pending.length} pending invite{pending.length > 1 ? 's' : ''}</span>}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Connected Managers', value: active.length, color: 'var(--cyan-b)' },
                { label: 'Pending Invites',    value: pending.length, color: 'var(--amber)' },
                { label: 'Notifications',      value: unread, color: 'var(--green)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: s.color, textShadow: `0 0 12px ${s.color}50` }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pending invites callout */}
            {pending.length > 0 && (
              <div style={{ background: 'rgba(255,184,108,0.07)', border: '1px solid rgba(255,184,108,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>You have {pending.length} pending connection invite{pending.length > 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Property managers want to work with you</div>
                </div>
                <button onClick={() => setTab('connections')} style={{ padding: '7px 18px', borderRadius: 7, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                  Review →
                </button>
              </div>
            )}

            {/* Recent notifications */}
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: 12 }}>Recent Activity</div>
            {notifications.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {notifications.slice(0, 6).map(n => (
                  <div key={n.id} style={{
                    background: n.readAt ? 'var(--surface)' : 'rgba(0,230,210,0.05)',
                    border: `1px solid ${n.readAt ? 'var(--border)' : 'rgba(0,230,210,0.2)'}`,
                    borderRadius: 10, padding: '11px 14px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{n.body}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{fmtRel(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONNECTIONS */}
        {tab === 'connections' && (
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>Connections</div>

            {pending.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 12 }}>Pending Invites ({pending.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pending.map(c => (
                    <div key={c.id} style={{ background: 'rgba(0,230,210,0.06)', border: '1px solid rgba(0,230,210,0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,230,210,0.12)', border: '2px solid rgba(0,230,210,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--cyan-b)', flexShrink: 0 }}>
                        {c.manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.manager.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.manager.company || c.manager.email} wants to connect with you as their {catLabel}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => respond(c.id, 'declined')} disabled={responding === c.id}
                          style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--red-bg)', border: '1px solid rgba(255,83,112,0.25)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                          Decline
                        </button>
                        <button onClick={() => respond(c.id, 'active')} disabled={responding === c.id}
                          style={{ padding: '7px 16px', borderRadius: 7, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>
                          {responding === c.id ? '...' : 'Accept'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 12 }}>Active ({active.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {active.map(c => (
                    <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,229,160,0.12)', border: '2px solid rgba(0,229,160,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
                        {c.manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.manager.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.manager.company || c.manager.email}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(0,229,160,0.2)' }}>Connected</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length === 0 && pending.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '60px 0' }}>
                No connections yet. Property managers will find you and send invites.
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE — Phase 3 will fill this with awarded service jobs */}
        {tab === 'schedule' && (
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>My Schedule</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Job marketplace coming in Phase 3</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Once property managers post jobs and you submit bids, your awarded jobs will appear here.</div>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>My Profile</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Full Name', value: user.name },
                  { label: 'Email', value: user.email },
                  { label: 'Company', value: user.company || '—' },
                  { label: 'Trade / Category', value: user.serviceCategory ? (CATEGORY_LABELS[user.serviceCategory] || user.serviceCategory) : '—' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(0,230,210,0.05)', borderRadius: 8, border: '1px solid rgba(0,230,210,0.12)', fontSize: 12, color: 'var(--text-dim)' }}>
                Profile editing, bio, and ratings coming in Phase 3.
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
