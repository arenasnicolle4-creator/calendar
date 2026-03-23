'use client'
// app/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react'

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Job {
  id: string
  platform: string
  displayName: string
  customerName: string | null
  address: string
  propertyLabel: string
  checkoutTime: string
  checkinTime: string | null
  nextGuests: string | null
  nextGuestCount: number | null
  sqft: number | null
  beds: number | null
  baths: number | null
  worth: number | null
  notes: string | null
  cleanerIds: string
  duties: string
}

interface Cleaner {
  id: string
  name: string
  color: string
}

interface GmailAccount {
  id: string
  email: string
  lastSynced: string | null
}

// ── COLORS ────────────────────────────────────────────────────────────────────
const PROP_COLORS = ['#e07b5a','#5a8fd4','#6dbf82','#c97fd4','#d4a843','#5abfbf','#d46b8a','#7a9e5a','#a07ad4','#d47a43','#5a9ed4','#bf6d6d']
const propColorMap: Record<string, string> = {}
let propColorIdx = 0
function getPropColor(name: string) {
  if (!propColorMap[name]) propColorMap[name] = PROP_COLORS[propColorIdx++ % PROP_COLORS.length]
  return propColorMap[name]
}

const PLAT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  airbnb:  { bg: '#ff385c22', text: '#ff6b7a', border: '#ff385c44', dot: '#ff385c' },
  jobber:  { bg: '#00c3ff22', text: '#5dd5ff', border: '#00c3ff44', dot: '#00c3ff' },
  turno:   { bg: '#a78bfa22', text: '#a78bfa', border: '#a78bfa44', dot: '#a78bfa' },
  hostaway:{ bg: '#d9770622', text: '#fb923c', border: '#d9770644', dot: '#fb923c' },
}
function platStyle(p: string) {
  const c = PLAT_COLORS[p] || PLAT_COLORS.turno
  return { background: c.bg, color: c.text, border: `1px solid ${c.border}` }
}

const PROPERTY_SHORT_NAMES: Record<string, string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star Lodge\nTop Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star Lodge\nEntire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function shortName(propertyLabel: string): string {
  if (PROPERTY_SHORT_NAMES[propertyLabel]) return PROPERTY_SHORT_NAMES[propertyLabel]
  // Fallback: strip everything after | or • and trim
  return propertyLabel.split('|')[0].split('•')[0].trim()
}

const MAX_VISIBLE_JOBS = 2

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtRelative(d: string | null) {
  if (!d) return 'Never'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function jobCleanerIds(job: Job): string[] {
  try { return JSON.parse(job.cleanerIds) } catch { return [] }
}
function jobDuties(job: Job): string[] {
  try { return JSON.parse(job.duties) } catch { return [] }
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function getWeekStart(d: Date) {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [view, setView] = useState<'day' | 'week' | 'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activePlatforms, setActivePlatforms] = useState(new Set(['airbnb','jobber','turno','hostaway']))
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showGmailPanel, setShowGmailPanel] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [dutyChecks, setDutyChecks] = useState<Record<number, boolean>>({})
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  // Check URL params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) {
      setSyncMsg(`✓ Connected ${connected}`)
      window.history.replaceState({}, '', '/dashboard')
      loadGmailAccounts()
      // Auto-sync new account
      setTimeout(() => syncAll(), 1000)
    }
    if (error) {
      setSyncMsg(`Error: ${error.replace(/_/g, ' ')}`)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) setJobs(await res.json())
  }, [])

  const loadCleaners = useCallback(async () => {
    const res = await fetch('/api/cleaners')
    if (res.ok) setCleaners(await res.json())
  }, [])

  const loadGmailAccounts = useCallback(async () => {
    const res = await fetch('/api/gmail/accounts')
    if (res.ok) setGmailAccounts(await res.json())
  }, [])

  useEffect(() => {
    loadJobs()
    loadCleaners()
    loadGmailAccounts()
  }, [loadJobs, loadCleaners, loadGmailAccounts])

  // Auto-sync every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => syncAll(), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function connectGmail() {
    const res = await fetch('/api/gmail/accounts', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  async function disconnectGmail(id: string) {
    await fetch(`/api/gmail/accounts/${id}`, { method: 'DELETE' })
    loadGmailAccounts()
  }

  async function syncAccount(id: string, email: string) {
    setSyncing(id)
    setSyncMsg(null)
    try {
      const res = await fetch(`/api/gmail/sync?id=${id}`, { method: 'POST' })
      const data = await res.json()
      setSyncMsg(`✓ Synced ${email} — ${data.imported} new job(s) found`)
      loadJobs()
      loadGmailAccounts()
    } catch {
      setSyncMsg(`Error syncing ${email}`)
    }
    setSyncing(null)
  }

  async function syncAll() {
    setSyncing('all')
    setSyncMsg(null)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      const total = Array.isArray(data) ? data.reduce((s: number, r: { imported?: number }) => s + (r.imported || 0), 0) : 0
      setSyncMsg(total > 0 ? `✓ Synced all accounts — ${total} new job(s)` : '✓ All accounts synced — no new jobs')
      loadJobs()
      loadGmailAccounts()
    } catch {
      setSyncMsg('Sync error')
    }
    setSyncing(null)
    setTimeout(() => setSyncMsg(null), 5000)
  }

  async function updateJob(id: string, data: Partial<Job>) {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    loadJobs()
    if (selectedJob?.id === id) setSelectedJob(prev => prev ? { ...prev, ...data } : null)
  }

  async function deleteJob(id: string) {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setSelectedJob(null)
    loadJobs()
  }

  // ── FILTERED JOBS ──────────────────────────────────────────────────────────
  const visibleJobs = jobs.filter(j => activePlatforms.has(j.platform))

  function jobsOnDay(date: Date) {
    return visibleJobs.filter(j => sameDay(new Date(j.checkoutTime), date))
  }

  // ── NAVIGATION ─────────────────────────────────────────────────────────────
  function navigate(dir: number) {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      if (view === 'week') { d.setDate(d.getDate() + dir * 7); return d }
      d.setDate(d.getDate() + dir); return d
    })
  }

  function periodLabel() {
    if (view === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const ws = getWeekStart(currentDate)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  function togglePlatform(p: string) {
    setActivePlatforms(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  // ── CALENDAR RENDERS ───────────────────────────────────────────────────────
  const today = new Date()
  const HS = 7, HE = 21, HOURS = HE - HS

  function JobChip({ job }: { job: Job }) {
    const c = getPropColor(job.propertyLabel)
    return (
      <div
        onClick={() => { setSelectedJob(job); setDutyChecks({}) }}
        style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer mb-0.5 overflow-hidden hover:brightness-125 transition-all"
      >
        <span className="truncate flex-1">{job.displayName}</span>
        <span className="opacity-70 whitespace-nowrap shrink-0">{fmt(job.checkoutTime)}</span>
      </div>
    )
  }

  function MonthView() {
    const year = currentDate.getFullYear(), month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDow = firstDay.getDay()
    const todayStr = today.toDateString()
    const days: JSX.Element[] = []

    function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
    function toggleDay(dk: string, e: React.MouseEvent) {
      e.stopPropagation()
      setExpandedDays(prev => ({ ...prev, [dk]: !prev[dk] }))
    }

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1)
      days.push(
        <div key={`pre-${i}`} className="bg-[#1a1a1a] opacity-40" style={{ height: 130 }}>
          <div className="text-[11px] font-semibold text-[#444] w-5 h-5 flex items-center justify-center p-1.5 pt-1.5">{d.getDate()}</div>
        </div>
      )
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cellDate = new Date(year, month, day)
      const isToday = cellDate.toDateString() === todayStr
      const dayJobs = jobsOnDay(cellDate)
      const dk = dayKey(cellDate)
      const isExpanded = !!expandedDays[dk]
      const showAll = isExpanded || dayJobs.length <= MAX_VISIBLE_JOBS
      const visibleJobs2 = showAll ? dayJobs : dayJobs.slice(0, MAX_VISIBLE_JOBS)
      const hiddenCount = showAll ? 0 : dayJobs.length - MAX_VISIBLE_JOBS

      days.push(
        <div
          key={day}
          className={`flex flex-col overflow-hidden transition-colors p-1.5 ${isToday ? 'bg-[#1f1c17]' : 'bg-[#1a1a1a] hover:bg-[#222]'} ${isExpanded ? 'z-10 shadow-2xl' : ''}`}
          style={{ height: isExpanded ? 'auto' : 130, minHeight: 130, position: isExpanded ? 'relative' : undefined }}
        >
          <div className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center mb-1 shrink-0 ${isToday ? 'bg-[#e8d5a3] text-[#1a1500] rounded-full' : 'text-[#888]'}`}>
            {day}
          </div>
          <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
            {visibleJobs2.map(j => {
              const c = getPropColor(j.propertyLabel)
              const name = shortName(j.propertyLabel)
              return (
                <div
                  key={j.id}
                  onClick={() => { setSelectedJob(j); setDutyChecks({}) }}
                  style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:brightness-125 transition-all shrink-0 overflow-hidden"
                  title={shortName(j.propertyLabel)}
                >
                  <span className="opacity-70 mr-1 text-[9px]">{fmt(j.checkoutTime)}</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' } as React.CSSProperties}>
                    {name}
                  </span>
                </div>
              )
            })}
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={(e) => toggleDay(dk, e)}
                className="mt-0.5 py-0.5 px-1.5 rounded text-[10px] font-semibold bg-[#2c2c2c] text-[#888] border border-[#333] hover:text-[#f0ede8] hover:bg-[#333] transition-colors text-center shrink-0"
              >
                ▾ {hiddenCount} more
              </button>
            )}
            {isExpanded && dayJobs.length > MAX_VISIBLE_JOBS && (
              <button
                onClick={(e) => toggleDay(dk, e)}
                className="mt-0.5 py-0.5 px-1.5 rounded text-[10px] font-semibold bg-[#2c2c2c] text-[#888] border border-[#333] hover:text-[#f0ede8] hover:bg-[#333] transition-colors text-center shrink-0"
              >
                ▴ show less
              </button>
            )}
          </div>
        </div>
      )
    }

    // Trailing blanks
    const trailing = (startDow + lastDay.getDate()) % 7
    if (trailing) for (let i = 1; i <= 7 - trailing; i++) {
      days.push(
        <div key={`post-${i}`} className="bg-[#1a1a1a] opacity-40" style={{ height: 130 }}>
          <div className="text-[11px] font-semibold text-[#444] w-5 h-5 flex items-center justify-center p-1.5 pt-1.5">{i}</div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-[#2e2e2e] rounded-xl overflow-visible">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="bg-[#1a1a1a] py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-[#444]">{d}</div>
        ))}
        {days}
      </div>
    )
  }

  function WeekView() {
    const ws = getWeekStart(currentDate)
    const todayStr = today.toDateString()
    return (
      <div className="grid border border-[#2e2e2e] rounded-xl overflow-hidden" style={{ gridTemplateColumns: '54px repeat(7,1fr)' }}>
        <div className="bg-[#1a1a1a] border-b border-[#2e2e2e]" />
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(ws); d.setDate(ws.getDate() + i)
          const isT = d.toDateString() === todayStr
          return (
            <div key={i} className="bg-[#1a1a1a] p-2 text-center border-b border-l border-[#2e2e2e]">
              <div className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
              <div className={`font-serif text-xl leading-tight ${isT ? 'text-[#e8d5a3]' : 'text-[#f0ede8]'}`}>{d.getDate()}</div>
            </div>
          )
        })}
        {/* Time col */}
        <div className="bg-[#1a1a1a] border-r border-[#2e2e2e]">
          {Array.from({ length: HOURS }, (_, h) => {
            const hr = HS + h
            const label = hr === 12 ? '12 PM' : hr < 12 ? `${hr} AM` : `${hr-12} PM`
            return <div key={h} className="h-14 flex items-start pt-1 px-1.5 text-[9px] text-[#444] border-t border-[#2e2e2e]">{label}</div>
          })}
        </div>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(ws); d.setDate(ws.getDate() + i)
          const dayJobs = jobsOnDay(d)
          return (
            <div key={i} className="relative border-l border-[#2e2e2e] bg-[#1a1a1a]" style={{ minHeight: HOURS * 56 }}>
              {Array.from({ length: HOURS }, (_, h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-[#2e2e2e]" style={{ top: h * 56, height: 56 }} />
              ))}
              {dayJobs.map(j => {
                const co = new Date(j.checkoutTime)
                const ci = j.checkinTime ? new Date(j.checkinTime) : new Date(co.getTime() + 3 * 3600000)
                const top = Math.max(0, (co.getHours() + co.getMinutes() / 60 - HS) * 56)
                const height = Math.max(28, ((ci.getTime() - co.getTime()) / 3600000) * 56)
                const c = getPropColor(j.propertyLabel)
                const cl = cleaners.find(x => jobCleanerIds(j).includes(x.id))
                return (
                  <div
                    key={j.id}
                    onClick={() => { setSelectedJob(j); setDutyChecks({}) }}
                    style={{ top, height, background: `${c}22`, color: c, border: `1px solid ${c}44` }}
                    className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 cursor-pointer hover:brightness-125 overflow-hidden z-10 transition-all"
                  >
                    <div className="text-[11px] font-semibold overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{shortName(j.propertyLabel)}</div>
                    <div className="text-[9px] opacity-80">{fmt(j.checkoutTime)}{j.checkinTime ? ` – ${fmt(j.checkinTime)}` : ''}</div>
                    {cl && <div className="text-[9px] opacity-60">{cl.name}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  function DayView() {
    const dayJobs = jobsOnDay(currentDate)
    return (
      <>
        <div className="text-center mb-4">
          <h2 className="font-serif text-2xl">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
        </div>
        <div className="grid border border-[#2e2e2e] rounded-xl overflow-hidden" style={{ gridTemplateColumns: '54px 1fr' }}>
          <div className="bg-[#1a1a1a] border-r border-[#2e2e2e]">
            {Array.from({ length: HOURS }, (_, h) => {
              const hr = HS + h
              const label = hr === 12 ? '12 PM' : hr < 12 ? `${hr} AM` : `${hr-12} PM`
              return <div key={h} className="h-14 flex items-start pt-1 px-1.5 text-[9px] text-[#444] border-t border-[#2e2e2e]">{label}</div>
            })}
          </div>
          <div className="relative bg-[#1a1a1a]" style={{ minHeight: HOURS * 56 }}>
            {Array.from({ length: HOURS }, (_, h) => (
              <div key={h} className="absolute left-0 right-0 border-t border-[#2e2e2e]" style={{ top: h * 56, height: 56 }} />
            ))}
            {dayJobs.map(j => {
              const co = new Date(j.checkoutTime)
              const ci = j.checkinTime ? new Date(j.checkinTime) : new Date(co.getTime() + 3 * 3600000)
              const top = Math.max(0, (co.getHours() + co.getMinutes() / 60 - HS) * 56)
              const height = Math.max(44, ((ci.getTime() - co.getTime()) / 3600000) * 56)
              const c = getPropColor(j.propertyLabel)
              const cl = cleaners.find(x => jobCleanerIds(j).includes(x.id))
              return (
                <div
                  key={j.id}
                  onClick={() => { setSelectedJob(j); setDutyChecks({}) }}
                  style={{ top, height, background: `${c}22`, color: c, borderLeft: `3px solid ${c}` }}
                  className="absolute left-2 right-2 rounded px-2.5 py-1.5 cursor-pointer hover:brightness-125 z-10 transition-all"
                >
                  <div className="font-semibold text-sm whitespace-pre-line">{shortName(j.propertyLabel)}</div>
                  <div className="text-[10px] opacity-70">{j.address}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{fmt(j.checkoutTime)}{j.checkinTime ? ` → ${fmt(j.checkinTime)}` : ''}</div>
                  {cl && <div className="text-[10px] opacity-60">👤 {cl.name}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── JOB MODAL ──────────────────────────────────────────────────────────────
  function JobModal() {
    if (!selectedJob) return null
    const j = selectedJob
    const c = getPropColor(j.propertyLabel)
    const assignedCleaners = jobCleanerIds(j).map(id => cleaners.find(cl => cl.id === id)).filter(Boolean) as Cleaner[]
    const duties = jobDuties(j)
    const platLabel = j.platform.charAt(0).toUpperCase() + j.platform.slice(1)

    async function saveLabel() {
      if (labelDraft.trim()) await updateJob(j.id, { displayName: labelDraft.trim(), propertyLabel: labelDraft.trim() })
      setEditingLabel(false)
    }

    async function assignCleaner(cleanerId: string) {
      if (!cleanerId) return
      const ids = jobCleanerIds(j)
      if (ids.includes(cleanerId)) return
      await updateJob(j.id, { cleanerIds: JSON.stringify([...ids, cleanerId]) })
    }

    async function removeCleaner(cleanerId: string) {
      const ids = jobCleanerIds(j).filter(id => id !== cleanerId)
      await updateJob(j.id, { cleanerIds: JSON.stringify(ids) })
    }

    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="p-5 pb-4 border-b border-[#2e2e2e] sticky top-0 bg-[#1a1a1a] rounded-t-2xl flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2" style={platStyle(j.platform)}>
                {platLabel}
              </span>
              {editingLabel ? (
                <input
                  autoFocus
                  defaultValue={j.displayName}
                  onChange={e => setLabelDraft(e.target.value)}
                  onBlur={saveLabel}
                  onKeyDown={e => e.key === 'Enter' && saveLabel()}
                  className="block w-full bg-[#222] border border-[#e8d5a3] rounded-lg px-2 py-1 text-lg font-serif text-[#f0ede8] outline-none"
                />
              ) : (
                <div className="font-serif text-xl leading-snug cursor-pointer group" onDoubleClick={() => { setEditingLabel(true); setLabelDraft(j.displayName) }}>
                  {shortName(j.propertyLabel)}
                  <span className="text-[11px] text-[#444] ml-2 group-hover:text-[#888] transition-colors">✎</span>
                </div>
              )}
              <div className="text-xs text-[#888] mt-0.5">{j.customerName} · {j.address}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { if (confirm('Delete this job?')) deleteJob(j.id) }} className="w-7 h-7 border border-[#2e2e2e] rounded-lg bg-[#222] text-[#888] hover:text-[#e07b5a] flex items-center justify-center text-xs transition-colors">🗑</button>
              <button onClick={() => setSelectedJob(null)} className="w-7 h-7 border border-[#2e2e2e] rounded-lg bg-[#222] text-[#888] hover:text-[#f0ede8] flex items-center justify-center text-sm transition-colors">✕</button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Schedule */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Schedule</div>
              <div className="bg-[#222] rounded-xl p-3 flex items-center">
                <div className="flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Checkout / Start</div>
                  <div className="text-sm font-semibold">{fmt(j.checkoutTime)}</div>
                  <div className="text-[10px] text-[#888]">{fmtDate(j.checkoutTime)}</div>
                </div>
                <div className="text-[#444] px-3 text-base">→</div>
                <div className="flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">{j.platform === 'jobber' ? 'End Time' : 'Next Check-in'}</div>
                  <div className="text-sm font-semibold">{j.checkinTime ? fmt(j.checkinTime) : '—'}</div>
                  <div className="text-[10px] text-[#888]">{j.checkinTime ? fmtDate(j.checkinTime) : 'Not set'}</div>
                </div>
              </div>
            </div>

            {/* Next guests */}
            {j.nextGuests && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Next Guests</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#222] rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Guest Name</div>
                    <div className="text-sm font-medium">{j.nextGuests}</div>
                  </div>
                  <div className="bg-[#222] rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Guest Count</div>
                    <div className="font-serif text-xl">{j.nextGuestCount ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Property details */}
            {(j.sqft || j.beds) && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Property Details</div>
                <div className="grid grid-cols-2 gap-2">
                  {j.sqft && <div className="bg-[#222] rounded-xl p-3"><div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Sq Ft</div><div className="font-serif text-xl">{j.sqft.toLocaleString()}</div></div>}
                  {j.beds && <div className="bg-[#222] rounded-xl p-3"><div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Beds / Baths</div><div className="font-serif text-xl">{j.beds}bd / {j.baths}ba</div></div>}
                  {j.worth && <div className="bg-[#222] rounded-xl p-3 col-span-2"><div className="text-[9px] uppercase tracking-wider text-[#444] mb-1">Job Value</div><span className="inline-flex items-center gap-1 bg-[#1f2e1a] text-[#6dbf82] border border-[#2e4a26] rounded-lg px-2 py-1 text-sm font-semibold">💵 ${j.worth}</span></div>}
                </div>
              </div>
            )}

            {/* Duties */}
            {duties.length > 0 && (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Duties / Line Items</div>
                <div className="bg-[#222] rounded-xl overflow-hidden">
                  {duties.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-[#2e2e2e] last:border-0 text-xs cursor-pointer hover:bg-[#2a2a2a]" onClick={() => setDutyChecks(prev => ({ ...prev, [i]: !prev[i] }))}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0 transition-all ${dutyChecks[i] ? 'bg-[#2c2c2c] border-[#444] text-[#e8d5a3]' : 'border-[#2e2e2e]'}`}>
                        {dutyChecks[i] ? '✓' : ''}
                      </div>
                      <span className={dutyChecks[i] ? 'line-through text-[#555]' : ''}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cleaners */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Assigned Cleaners</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {assignedCleaners.map(cl => (
                  <span key={cl.id} style={{ background: `${cl.color}22`, color: cl.color, border: `1px solid ${cl.color}44` }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium">
                    {cl.name}
                    <span className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => removeCleaner(cl.id)}>✕</span>
                  </span>
                ))}
                {assignedCleaners.length === 0 && <span className="text-xs text-[#555]">No cleaners assigned</span>}
              </div>
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-[#222] border border-[#2e2e2e] rounded-lg px-2.5 py-2 text-xs text-[#f0ede8] outline-none focus:border-[#c4a882]"
                  onChange={e => { assignCleaner(e.target.value); e.target.value = '' }}
                  defaultValue=""
                >
                  <option value="">Add cleaner...</option>
                  {cleaners.filter(cl => !jobCleanerIds(j).includes(cl.id)).map(cl => (
                    <option key={cl.id} value={cl.id}>{cl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Notes</div>
              <textarea
                defaultValue={j.notes || ''}
                onBlur={e => updateJob(j.id, { notes: e.target.value })}
                placeholder="Add notes..."
                className="w-full bg-[#222] border border-[#2e2e2e] rounded-xl px-3 py-2.5 text-xs text-[#f0ede8] placeholder-[#444] outline-none focus:border-[#c4a882] resize-y min-h-[60px]"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── GMAIL PANEL ────────────────────────────────────────────────────────────
  function GmailPanel() {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowGmailPanel(false)}>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-5 pb-4 border-b border-[#2e2e2e] flex justify-between items-start">
            <div>
              <h2 className="font-serif text-xl">Gmail Accounts</h2>
              <p className="text-xs text-[#888] mt-1">Connected Gmail inboxes that auto-sync Turno job emails</p>
            </div>
            <button onClick={() => setShowGmailPanel(false)} className="w-7 h-7 border border-[#2e2e2e] rounded-lg bg-[#222] text-[#888] hover:text-[#f0ede8] flex items-center justify-center text-sm">✕</button>
          </div>

          <div className="p-5 space-y-4">
            {syncMsg && (
              <div className={`px-3 py-2.5 rounded-xl text-xs border ${syncMsg.startsWith('✓') ? 'bg-[#6dbf8222] text-[#6dbf82] border-[#6dbf8233]' : 'bg-[#e07b5a22] text-[#e07b5a] border-[#e07b5a33]'}`}>
                {syncMsg}
              </div>
            )}

            {/* Connected accounts */}
            {gmailAccounts.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444]">Connected Accounts</div>
                {gmailAccounts.map(acc => (
                  <div key={acc.id} className="bg-[#222] rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{acc.email}</div>
                      <div className="text-[10px] text-[#555] mt-0.5">Last synced: {fmtRelative(acc.lastSynced)}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => syncAccount(acc.id, acc.email)}
                        disabled={syncing === acc.id || syncing === 'all'}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#a78bfa22] text-[#a78bfa] border border-[#a78bfa44] disabled:opacity-50 hover:bg-[#a78bfa33] transition-colors"
                      >
                        {syncing === acc.id ? '⟳ Syncing...' : '⟳ Sync'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Disconnect ${acc.email}?`)) disconnectGmail(acc.id) }}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#e07b5a22] text-[#e07b5a] border border-[#e07b5a44] hover:bg-[#e07b5a33] transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#222] rounded-xl p-4 text-center text-sm text-[#555]">
                No Gmail accounts connected yet.
              </div>
            )}

            {/* Connect new */}
            <button
              onClick={connectGmail}
              className="w-full py-3 rounded-xl bg-[#a78bfa22] text-[#a78bfa] border border-[#a78bfa44] text-sm font-semibold hover:bg-[#a78bfa33] transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span> Connect Gmail Account
            </button>

            {gmailAccounts.length > 1 && (
              <button
                onClick={() => syncAll()}
                disabled={syncing === 'all'}
                className="w-full py-2.5 rounded-xl bg-[#222] text-[#888] border border-[#2e2e2e] text-xs font-semibold hover:text-[#f0ede8] transition-colors disabled:opacity-50"
              >
                {syncing === 'all' ? '⟳ Syncing all...' : '⟳ Sync All Accounts'}
              </button>
            )}

            <div className="bg-[#222] rounded-xl p-3 text-xs text-[#555] leading-relaxed">
              <strong className="text-[#888]">How it works:</strong> CleanSync checks these inboxes every 10 minutes for Turno job notification emails and automatically adds them to your calendar. You can connect multiple Gmail accounts — like <span className="text-[#888]">akcleaningsucasa@gmail.com</span> and any other that receives Turno emails.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const allPlatforms = ['airbnb','jobber','turno','hostaway']
  const propNames = [...new Set(visibleJobs.map(j => j.propertyLabel))].sort()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2e2e2e] bg-[#1a1a1a] sticky top-0 z-40 gap-3 flex-wrap shrink-0">
        <div className="font-serif text-lg text-[#e8d5a3]">CleanSync <em className="text-[#888] text-sm not-italic">pro</em></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(-1)} className="w-8 h-8 border border-[#2e2e2e] rounded-lg bg-[#222] text-[#f0ede8] flex items-center justify-center hover:bg-[#2c2c2c] transition-colors text-lg">‹</button>
          <span className="font-serif text-sm min-w-[150px] text-center">{periodLabel()}</span>
          <button onClick={() => navigate(1)} className="w-8 h-8 border border-[#2e2e2e] rounded-lg bg-[#222] text-[#f0ede8] flex items-center justify-center hover:bg-[#2c2c2c] transition-colors text-lg">›</button>
          <div className="flex bg-[#222] rounded-lg p-0.5 gap-0.5">
            {(['day','month','week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${view === v ? 'bg-[#2c2c2c] text-[#f0ede8]' : 'text-[#888] hover:text-[#f0ede8]'}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => setShowGmailPanel(true)} className="px-3 py-1.5 rounded-lg bg-[#a78bfa22] text-[#a78bfa] border border-[#a78bfa44] text-xs font-semibold hover:bg-[#a78bfa33] transition-colors flex items-center gap-1.5">
            ✉ Gmail {gmailAccounts.length > 0 && <span className="bg-[#a78bfa] text-[#1a1a1a] rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">{gmailAccounts.length}</span>}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-52 shrink-0 bg-[#1a1a1a] border-r border-[#2e2e2e] p-4 overflow-y-auto flex flex-col gap-5">
          {/* Sync status */}
          {gmailAccounts.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Auto-Sync</div>
              <div className="bg-[#222] rounded-lg p-2.5 text-[10px] text-[#555]">
                {gmailAccounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between gap-1 mb-1 last:mb-0">
                    <span className="truncate text-[#888]">{acc.email.split('@')[0]}</span>
                    <span className="shrink-0 text-[#444]">{fmtRelative(acc.lastSynced)}</span>
                  </div>
                ))}
                <button onClick={() => syncAll()} disabled={syncing === 'all'} className="w-full mt-2 py-1 rounded bg-[#2c2c2c] text-[#888] hover:text-[#f0ede8] text-[10px] font-medium transition-colors disabled:opacity-50">
                  {syncing === 'all' ? '⟳ Syncing...' : '⟳ Sync Now'}
                </button>
              </div>
            </div>
          )}

          {/* Platforms */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Platforms</div>
            <div className="flex flex-col gap-1">
              {allPlatforms.map(p => {
                const col = PLAT_COLORS[p]
                const active = activePlatforms.has(p)
                return (
                  <div key={p} onClick={() => togglePlatform(p)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${active ? 'bg-[#222]' : 'opacity-40'}`}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.dot }} />
                    <span className="capitalize">{p}</span>
                    {active && <span className="ml-auto text-[#e8d5a3] text-[10px]">✓</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cleaners */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Cleaners</div>
            <div className="flex flex-col gap-1">
              {cleaners.map(cl => (
                <div key={cl.id} className="flex items-center gap-2 px-1.5 py-1 text-[11px] text-[#888]">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: cl.color }}>
                    {cl.name.split(' ').map((w: string) => w[0]).join('')}
                  </div>
                  {cl.name}
                </div>
              ))}
            </div>
          </div>

          {/* Properties legend */}
          {propNames.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[#444] mb-2">Properties</div>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                {propNames.map(p => (
                  <div key={p} className="flex items-center gap-2 text-[11px] text-[#888]">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: getPropColor(p) }} />
                    <span className="truncate leading-tight">{shortName(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto p-5">
          {view === 'month' && <MonthView />}
          {view === 'week' && <WeekView />}
          {view === 'day' && <DayView />}
        </main>
      </div>

      {/* MODALS */}
      {selectedJob && <JobModal />}
      {showGmailPanel && <GmailPanel />}
    </div>
  )
}
