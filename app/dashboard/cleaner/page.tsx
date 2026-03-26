'use client'
// app/dashboard/cleaner/page.tsx
// The cleaner sees their synced job calendar + connection invites from managers

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string; company?: string }
interface Connection { id: string; status: string; type: string; manager: { id: string; name: string; email: string; company?: string } }
interface Notification { id: string; title: string; body: string; readAt: string | null; createdAt: string }

type Tab = 'calendar' | 'connections' | 'integrations'

function fmtRel(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function CleanerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('calendar')
  const [connections, setConnections] = useState<Connection[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || (d.user.role !== 'cleaner' && d.user.role !== 'admin')) {
        router.push('/login'); return
      }
      // Legacy admin goes to old dashboard
      if (d.user.role === 'admin') { router.push('/dashboard'); return }
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

  async function respond(connectionId: string, status: 'active' | 'declined') {
    setResponding(connectionId)
    await fetch(`/api/connections/${connectionId}`, {
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
    { id: 'calendar',     label: 'My Calendar' },
    { id: 'connections',  label: 'Connections', badge: pending.length || undefined },
    { id: 'integrations', label: 'Integrations' },
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
              fontFamily: "'DM Sans', sans-serif", transition: 'all .14s', position: 'relative',
            }}>
              {t.label}
              {t.badge ? (
                <span style={{ marginLeft: 6, background: 'var(--amber)', color: '#071a24', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {unread > 0 && <div style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>{unread}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.name} <span style={{ color: 'var(--dim)', fontSize: 10 }}>· Cleaner</span></div>
          <button onClick={logout} style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Sign out</button>
        </div>
      </nav>

      {/* CALENDAR TAB — loads the existing dashboard inline via iframe for now */}
      {tab === 'calendar' && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16, fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)' }}>
            My Calendar
          </div>
          {/* Embed the existing cleaner calendar component */}
          <CleanerCalendarEmbed />
        </div>
      )}

      {/* CONNECTIONS TAB */}
      {tab === 'connections' && (
        <div style={{ padding: '28px 24px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>Connections</div>

          {pending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 12 }}>
                Pending Invites ({pending.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(c => (
                  <div key={c.id} style={{ background: 'rgba(0,230,210,0.06)', border: '1px solid rgba(0,230,210,0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,230,210,0.12)', border: '2px solid rgba(0,230,210,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--cyan-b)', flexShrink: 0 }}>
                      {c.manager.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.manager.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.manager.company || c.manager.email} wants to connect with you</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => respond(c.id, 'declined')}
                        disabled={responding === c.id}
                        style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--red-bg)', border: '1px solid rgba(255,83,112,0.25)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => respond(c.id, 'active')}
                        disabled={responding === c.id}
                        style={{ padding: '7px 16px', borderRadius: 7, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}
                      >
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
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 12 }}>
                Active Connections ({active.length})
              </div>
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
              No connections yet. Property managers will invite you when they want to work with you.
            </div>
          )}
        </div>
      )}

      {/* INTEGRATIONS TAB */}
      {tab === 'integrations' && (
        <div style={{ padding: '28px 24px', maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--cyan-b)', marginBottom: 20 }}>Integrations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Hostaway', desc: 'Sync guest checkout dates via iCal', color: '#fb8500', path: '/dashboard?page=integrations' },
              { name: 'Jobber', desc: 'Sync scheduled visits and events', color: '#00c4ff', path: '/dashboard?page=integrations' },
              { name: 'Gmail', desc: 'Connect for future email features', color: '#ea4335', path: '/dashboard?page=integrations' },
            ].map(int => (
              <div key={int.name} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: int.color, boxShadow: `0 0 8px ${int.color}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{int.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{int.desc}</div>
                </div>
                <button onClick={() => router.push(int.path)} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--cyan-bg)', border: '1px solid var(--cyan-border)', color: 'var(--cyan)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Manage →
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)', padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            Integration settings (connecting accounts, syncing calendars) are managed in your main calendar view above.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline calendar embed using existing dashboard ──────────────────────────
// The full calendar lives at /dashboard (legacy page). We redirect there for
// now and will migrate it in Phase 3 when we rebuild the full cleaner view.
function CleanerCalendarEmbed() {
  const router = useRouter()
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
        Your full calendar with Hostaway &amp; Jobber sync is in the main calendar view.
      </div>
      <button
        onClick={() => router.push('/dashboard')}
        style={{ padding: '10px 28px', borderRadius: 8, background: 'linear-gradient(135deg,#00b8a8,#00e6d2)', color: '#071a24', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Syne',sans-serif", boxShadow: '0 0 14px rgba(0,230,210,0.3)' }}
      >
        Open Full Calendar
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
        Full calendar migration coming in Phase 3
      </div>
    </div>
  )
}
