'use client'
// app/dashboard/page.tsx — CleanSync Pro v2

import { useEffect, useState, useCallback } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Job {
  id: string; platform: string; displayName: string; customerName: string | null
  address: string; propertyLabel: string; checkoutTime: string; checkinTime: string | null
  nextGuests: string | null; nextGuestCount: number | null; sqft: number | null
  beds: number | null; baths: number | null; worth: number | null; notes: string | null
  cleanerIds: string; duties: string
}
interface Cleaner { id: string; name: string; color: string }
interface GmailAccount { id: string; email: string; lastSynced: string | null }

// ── NAV PAGES ─────────────────────────────────────────────────────────────────
type Page = 'calendar' | 'properties' | 'clients' | 'team' | 'invoices' | 'integrations' | 'settings'

const NAV_ITEMS: { id: Page; icon: string; label: string; badge?: string }[] = [
  { id: 'calendar',     icon: '📅', label: 'Calendar' },
  { id: 'properties',  icon: '🏠', label: 'Properties' },
  { id: 'clients',     icon: '👥', label: 'Clients' },
  { id: 'team',        icon: '🧹', label: 'Team' },
  { id: 'invoices',    icon: '💰', label: 'Invoices', badge: 'NEW' },
  { id: 'integrations',icon: '🔗', label: 'Integrations' },
  { id: 'settings',    icon: '⚙️', label: 'Settings' },
]

// ── COLORS ────────────────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  // Teals & greens
  '#00b896','#00d4aa','#06d6a0','#43aa8b','#2d9e6b','#52b788','#40916c',
  // Blues
  '#00b4d8','#0096c7','#4361ee','#3a86ff','#118ab2','#1d4ed8','#2563eb','#1e40af',
  // Purples & violets
  '#7209b7','#8338ec','#7c3aed','#6d28d9','#a78bfa','#9d4edd','#c77dff',
  // Pinks & reds
  '#f72585','#ef476f','#e63946','#e8525a','#ff6b6b','#f43f5e',
  // Oranges & ambers
  '#fb8500','#f97316','#f59e0b','#ffd166','#ffb703','#e76f51',
  // Warm neutrals
  '#6b7280','#4b5563','#78716c','#92400e','#78350f',
]
const DEFAULT_PROP_COLOR = '#ef4444' // red = unassigned manual property
const DEFAULT_EVENT_COLOR = '#f97316' // orange = Jobber calendar events
const DEFAULT_VISIT_COLOR = '#1d4ed8' // dark blue = Jobber visits/jobs

const PLAT_COLORS: Record<string,{bg:string;text:string;dot:string}> = {
  airbnb:   {bg:'rgba(255,56,92,0.15)',  text:'#ff385c', dot:'#ff385c'},
  jobber:   {bg:'rgba(0,196,255,0.15)',  text:'#00c4ff', dot:'#00c4ff'},
  turno:    {bg:'rgba(167,139,250,0.15)',text:'#a78bfa', dot:'#a78bfa'},
  hostaway: {bg:'rgba(251,133,0,0.15)',  text:'#fb8500', dot:'#fb8500'},
}

const PROPERTY_SHORT_NAMES: Record<string,string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star\nTop Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star\nEntire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function shortName(label: string) {
  if (PROPERTY_SHORT_NAMES[label]) return PROPERTY_SHORT_NAMES[label]
  return label.split('|')[0].split('•')[0].trim()
}

function loadColorMap(): Record<string,string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('propColors') || '{}') } catch { return {} }
}
function saveColorMap(m: Record<string,string>) {
  if (typeof window !== 'undefined') localStorage.setItem('propColors', JSON.stringify(m))
}

// Color rules — keyword → color, checked against propertyLabel
interface ColorRule { keyword: string; color: string }
function loadColorRules(): ColorRule[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('colorRules') || '[]') } catch { return [] }
}
function saveColorRules(rules: ColorRule[]) {
  if (typeof window !== 'undefined') localStorage.setItem('colorRules', JSON.stringify(rules))
}
// Returns color from rules if any keyword matches the label (case-insensitive)
function colorFromRules(label: string, rules: ColorRule[]): string | null {
  const lower = label.toLowerCase()
  for (const rule of rules) {
    if (rule.keyword && lower.includes(rule.keyword.toLowerCase())) return rule.color
  }
  return null
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(d: string|null) { return d ? new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—' }
function fmtD(d: string|null) { return d ? new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '—' }
function fmtFull(d: string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—' }
function fmtRel(d: string|null) {
  if (!d) return 'Never'
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if (m<1) return 'Just now'; if (m<60) return `${m}m ago`
  const h=Math.floor(m/60); return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`
}
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function getWeekStart(d: Date) { const r=new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r }
function jobCleanerIds(j: Job): string[] { try { return JSON.parse(j.cleanerIds) } catch { return [] } }
const MAX_VISIBLE = 2
const HS=7, HE=21, HOURS=HE-HS

// ── PROP NAME EDITOR ──────────────────────────────────────────────────────────
function PropNameEditor({ value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) return (
    <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
      onBlur={()=>{onSave(draft);setEditing(false)}}
      onKeyDown={e=>{if(e.key==='Enter'){onSave(draft);setEditing(false)}if(e.key==='Escape')setEditing(false)}}
      style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid var(--teal)',borderRadius:5,padding:'1px 6px',fontSize:11,color:'var(--text)',outline:'none',minWidth:0,fontFamily:'DM Sans,sans-serif'}}
    />
  )
  return (
    <span onClick={()=>{setDraft(value);setEditing(true)}} title="Click to rename"
      style={{flex:1,fontSize:12,color:'var(--text)',lineHeight:1.3,cursor:'text',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>
      {value}
    </span>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('calendar')
  const [jobs, setJobs] = useState<Job[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [view, setView] = useState<'day'|'week'|'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activePlatforms, setActivePlatforms] = useState(new Set(['airbnb','jobber','turno','hostaway']))
  const [selectedJob, setSelectedJob] = useState<Job|null>(null)
  const [showAddJob, setShowAddJob] = useState(false)
  const [addJobDate, setAddJobDate] = useState('')
  const [showGmailPanel, setShowGmailPanel] = useState(false)
  const [syncing, setSyncing] = useState<string|null>(null)
  const [syncMsg, setSyncMsg] = useState<string|null>(null)
  const [dutyChecks, setDutyChecks] = useState<Record<number,boolean>>({})
  const [expandedDays, setExpandedDays] = useState<Record<string,boolean>>({})
  const [colorMap, setColorMap] = useState<Record<string,string>>({})
  const [colorRules, setColorRules] = useState<ColorRule[]>([])
  const [propNameMap, setPropNameMap] = useState<Record<string,string>>({})
  const [hiddenProps, setHiddenProps] = useState<Set<string>>(new Set())
  const [expandedColorProp, setExpandedColorProp] = useState<string|null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [jobberAccounts, setJobberAccounts] = useState<{id:string;email:string;companyName:string|null;lastSynced:string|null}[]>([])
  const [hostawayAccounts, setHostawayAccounts] = useState<{id:string;listingId:string;name:string;icalUrl:string;lastSynced:string|null}[]>([])
  const today = new Date()

  useEffect(() => {
    setColorMap(loadColorMap())
    setColorRules(loadColorRules())
    try { setPropNameMap(JSON.parse(localStorage.getItem('propNames')||'{}')) } catch {}
    try { setHiddenProps(new Set(JSON.parse(localStorage.getItem('hiddenProps')||'[]'))) } catch {}
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected')) {
      setSyncMsg(`✓ Connected ${params.get('connected')}`)
      window.history.replaceState({},'','/dashboard')
      loadGmailAccounts(); loadJobberAccounts()
      setTimeout(syncAll,1200)
      if (params.get('page')) setPage(params.get('page') as Page)
    }
    if (params.get('error')) { setSyncMsg(`Error: ${params.get('error')?.replace(/_/g,' ')}`); window.history.replaceState({},'','/dashboard') }
  }, [])

  const loadJobs = useCallback(async()=>{const r=await fetch('/api/jobs');if(r.ok)setJobs(await r.json())},[])
  const loadCleaners = useCallback(async()=>{const r=await fetch('/api/cleaners');if(r.ok)setCleaners(await r.json())},[])
  const loadGmailAccounts = useCallback(async()=>{const r=await fetch('/api/gmail/accounts');if(r.ok)setGmailAccounts(await r.json())},[])
  const loadJobberAccounts = useCallback(async()=>{const r=await fetch('/api/jobber/accounts');if(r.ok)setJobberAccounts(await r.json())},[])
  const loadHostawayAccounts = useCallback(async()=>{const r=await fetch('/api/hostaway/accounts');if(r.ok)setHostawayAccounts(await r.json())},[])
  useEffect(()=>{loadJobs();loadCleaners();loadGmailAccounts();loadJobberAccounts();loadHostawayAccounts()},[loadJobs,loadCleaners,loadGmailAccounts,loadJobberAccounts,loadHostawayAccounts])

  function displayName(label: string) { return propNameMap[label] || shortName(label) }
  function savePropName(label: string, name: string) {
    const next={...propNameMap,[label]:name.trim()||shortName(label)}
    setPropNameMap(next); localStorage.setItem('propNames',JSON.stringify(next))
  }
  function assignColor(label: string, color: string) {
    const next={...colorMap,[label]:color}; setColorMap(next); saveColorMap(next); setExpandedColorProp(null)
  }
  function togglePropVisibility(label: string) {
    setHiddenProps(prev=>{const n=new Set(prev);n.has(label)?n.delete(label):n.add(label);localStorage.setItem('hiddenProps',JSON.stringify([...n]));return n})
  }
  function jobColor(j: Job) {
    // 1. Explicit per-property color
    if (colorMap[j.propertyLabel]) return colorMap[j.propertyLabel]
    // 2. Keyword rule match
    const ruleColor = colorFromRules(j.propertyLabel, colorRules) || colorFromRules(j.displayName, colorRules)
    if (ruleColor) return ruleColor
    // 3. Platform-aware defaults
    if (j.platform === 'jobber') {
      // Events are jobber platform with no customerName (parsed from calendar events)
      if (!j.customerName) return DEFAULT_EVENT_COLOR  // orange
      return DEFAULT_VISIT_COLOR  // dark blue for visits
    }
    return DEFAULT_PROP_COLOR  // red = needs assignment
  }

  async function connectGmail(){const r=await fetch('/api/gmail/accounts',{method:'POST'});const{url}=await r.json();window.location.href=url}
  async function disconnectGmail(id:string){await fetch(`/api/gmail/accounts/${id}`,{method:'DELETE'});loadGmailAccounts()}
  async function connectJobber(){const r=await fetch('/api/jobber/accounts',{method:'POST'});const{url}=await r.json();window.location.href=url}
  async function disconnectJobber(id:string){await fetch(`/api/jobber/accounts/${id}`,{method:'DELETE'});loadJobberAccounts();loadJobs()}
  async function syncJobberAccount(id:string,email:string){
    setSyncing(`jobber-${id}`);setSyncMsg(null)
    try{
      const r=await fetch(`/api/jobber/sync?id=${id}`,{method:'POST'})
      const d=await r.json()
      if(d.error?.includes('NEEDS_RECONNECT')){
        setSyncMsg('⚠ Jobber token expired — please disconnect and reconnect Jobber in Integrations')
      } else if(d.error){
        setSyncMsg(`Error: ${d.error}`)
      } else {
        setSyncMsg(`✓ Synced Jobber (${email}) — ${d.imported ?? 0} new job(s)`)
        loadJobs();loadJobberAccounts()
      }
    }
    catch{setSyncMsg('Error syncing Jobber')}
    setSyncing(null)
  }
  async function syncAccount(id:string,email:string){
    setSyncing(id);setSyncMsg(null)
    try{const r=await fetch(`/api/gmail/sync?id=${id}`,{method:'POST'});const d=await r.json();setSyncMsg(`✓ Synced ${email} — ${d.imported} new job(s)`);loadJobs();loadGmailAccounts()}
    catch{setSyncMsg(`Error syncing ${email}`)}
    setSyncing(null)
  }
  async function syncAll(){
    setSyncing('all');setSyncMsg(null)
    try{
      const [jobberRes, hostawayRes] = await Promise.allSettled([
        fetch('/api/jobber/sync',{method:'POST'}).then(r=>r.json()),
        fetch('/api/hostaway/sync',{method:'POST'}).then(r=>r.json()),
      ])
      const jobberTotal = jobberRes.status==='fulfilled'&&Array.isArray(jobberRes.value)?jobberRes.value.reduce((s:number,x:any)=>s+(x.imported||0),0):(jobberRes.status==='fulfilled'?(jobberRes.value?.imported||0):0)
      const hostawayTotal = hostawayRes.status==='fulfilled'&&Array.isArray(hostawayRes.value)?hostawayRes.value.reduce((s:number,x:any)=>s+(x.imported||0),0):0
      const total = jobberTotal + hostawayTotal
      setSyncMsg(total>0?`✓ ${total} new job(s) synced`:'✓ All accounts up to date')
      loadJobs(); loadJobberAccounts()
    } catch{ setSyncMsg('Sync error') }
    setSyncing(null); setTimeout(()=>setSyncMsg(null),5000)
  }
  async function updateJob(id:string,data:Partial<Job>){
    await fetch(`/api/jobs/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    loadJobs();if(selectedJob?.id===id)setSelectedJob(prev=>prev?{...prev,...data}:null)
  }
  async function deleteJob(id:string){await fetch(`/api/jobs/${id}`,{method:'DELETE'});setSelectedJob(null);loadJobs()}
  async function handleLogout(){await fetch('/api/auth/login',{method:'DELETE'});router.push('/login')}

  const visibleJobs = jobs.filter(j=>activePlatforms.has(j.platform)&&!hiddenProps.has(j.propertyLabel))
  const allPropNames = [...new Set(jobs.map(j=>j.propertyLabel))].sort()
  function jobsOnDay(date:Date){return visibleJobs.filter(j=>sameDay(new Date(j.checkoutTime),date))}
  function dayKey(d:Date){return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}

  function navigate(dir:number){
    setCurrentDate(prev=>{
      const d=new Date(prev)
      if(view==='month')return new Date(d.getFullYear(),d.getMonth()+dir,1)
      if(view==='week'){d.setDate(d.getDate()+dir*7);return d}
      d.setDate(d.getDate()+dir);return d
    })
  }

  function periodLabel(){
    if(view==='month')return currentDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})
    if(view==='week'){const ws=getWeekStart(currentDate),we=new Date(ws);we.setDate(we.getDate()+6);return`${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
    return currentDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})
  }

  // ── CALENDAR VIEWS ──────────────────────────────────────────────────────────
  function MonthView() {
    const yr=currentDate.getFullYear(),mo=currentDate.getMonth()
    const first=new Date(yr,mo,1),last=new Date(yr,mo+1,0),dow=first.getDay(),ts=today.toDateString()
    const [popup,setPopup]=React.useState<{dk:string;jobs:Job[];x:number;y:number}|null>(null)

    // Build weeks array for equal-row-height rendering
    const cells:({type:'pad';n:number}|{type:'day';day:number;date:Date})[] = []
    for(let i=0;i<dow;i++){const d=new Date(yr,mo,-dow+i+1);cells.push({type:'pad',n:d.getDate()})}
    for(let d=1;d<=last.getDate();d++) cells.push({type:'day',day:d,date:new Date(yr,mo,d)})
    const trailing=(dow+last.getDate())%7
    if(trailing) for(let i=1;i<=7-trailing;i++) cells.push({type:'pad',n:i})

    return(
      <div style={{position:'relative'}}>
        {/* Day header */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'var(--border)',borderRadius:'14px 14px 0 0',overflow:'hidden',marginBottom:1}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
            <div key={d} style={{background:'var(--surface2)',padding:'10px 0',textAlign:'center',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',fontFamily:'Syne,sans-serif'}}>{d}</div>
          ))}
        </div>
        {/* Calendar body — fixed rows, no expanding */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:'130px',gap:1,background:'var(--border)',borderRadius:'0 0 14px 14px',overflow:'hidden',boxShadow:'var(--shadow-md)'}}>
          {cells.map((cell,idx)=>{
            if(cell.type==='pad') return(
              <div key={`pad-${idx}`} style={{background:'var(--surface)',opacity:0.3,padding:'7px 6px'}}>
                <span style={{fontSize:11,color:'var(--text-dim)'}}>{cell.n}</span>
              </div>
            )
            const {day,date}=cell
            const isT=date.toDateString()===ts
            const dk=dayKey(date)
            const dj=jobsOnDay(date)
            const visible=dj.slice(0,MAX_VISIBLE)
            const hidden=dj.length-MAX_VISIBLE
            return(
              <div key={day} style={{background:isT?'rgba(0,212,170,0.06)':'var(--surface)',padding:'6px 5px',display:'flex',flexDirection:'column',overflow:'hidden',borderTop:isT?'2px solid var(--teal)':'2px solid transparent'}}>
                <div style={{fontSize:11,fontWeight:700,fontFamily:'Syne,sans-serif',color:isT?'var(--teal)':'var(--text-muted)',width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',background:isT?'rgba(0,212,170,0.15)':'transparent',marginBottom:4,flexShrink:0}}>{day}</div>
                <div style={{display:'flex',flexDirection:'column',gap:2,flex:1,overflow:'hidden'}}>
                  {visible.map(j=>{
                    const c=jobColor(j),name=displayName(j.propertyLabel)
                    return(
                      <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                        style={{padding:'2px 4px',borderRadius:3,cursor:'pointer',background:`${c}22`,color:c,border:`1px solid ${c}33`,flexShrink:0,display:'flex',alignItems:'center',gap:3,overflow:'hidden',minWidth:0}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${c}40`}}
                        onMouseLeave={e=>{e.currentTarget.style.background=`${c}22`}}>
                        <span style={{fontSize:9,fontWeight:800,opacity:0.8,flexShrink:0,lineHeight:1.4}}>{fmt(j.checkoutTime)}</span>
                        <span style={{fontSize:10,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0,lineHeight:1.4}}>{name}</span>
                      </div>
                    )
                  })}
                </div>
                {hidden>0&&(
                  <button
                    onClick={e=>{
                      e.stopPropagation()
                      const rect=(e.currentTarget as HTMLElement).closest('[data-calday]')?.getBoundingClientRect()||(e.currentTarget as HTMLElement).getBoundingClientRect()
                      setPopup({dk,jobs:dj,x:rect.left,y:rect.bottom+4})
                    }}
                    data-calday={dk}
                    style={{marginTop:2,padding:'1px 4px',borderRadius:3,fontSize:9,fontWeight:700,cursor:'pointer',background:'rgba(255,255,255,0.06)',color:'var(--text-dim)',border:'none',flexShrink:0,textAlign:'left',fontFamily:'DM Sans,sans-serif'}}>
                    +{hidden} more
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {/* Popup overlay for "more" jobs */}
        {popup&&(
          <div style={{position:'fixed',inset:0,zIndex:100}} onClick={()=>setPopup(null)}>
            <div style={{position:'fixed',left:Math.min(popup.x,window.innerWidth-260),top:Math.min(popup.y,window.innerHeight-300),width:250,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'var(--shadow-lg)',overflow:'hidden',zIndex:101}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:700,color:'var(--text)',fontFamily:'Syne,sans-serif'}}>{popup.jobs.length} Jobs</span>
                <button onClick={()=>setPopup(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',fontSize:14}}>✕</button>
              </div>
              <div style={{maxHeight:260,overflowY:'auto',padding:'6px'}}>
                {popup.jobs.map(j=>{
                  const c=jobColor(j),name=displayName(j.propertyLabel)
                  return(
                    <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({});setPopup(null)}}
                      style={{padding:'7px 10px',borderRadius:7,cursor:'pointer',background:`${c}15`,color:c,border:`1px solid ${c}30`,marginBottom:4,display:'flex',alignItems:'center',gap:8}}
                      onMouseEnter={e=>{e.currentTarget.style.background=`${c}30`}}
                      onMouseLeave={e=>{e.currentTarget.style.background=`${c}15`}}>
                      <div style={{flexShrink:0}}>
                        <div style={{fontSize:10,fontWeight:800}}>{fmt(j.checkoutTime)}</div>
                        <div style={{fontSize:9,opacity:0.7}}>{fmt(j.checkinTime)}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                        <div style={{fontSize:10,opacity:0.6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.address}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  function WeekView(){
    const ws=getWeekStart(currentDate),ts=today.toDateString()
    return(
      <div style={{display:'grid',gridTemplateColumns:'52px repeat(7,1fr)',borderRadius:14,overflow:'hidden',border:'1px solid var(--border)',boxShadow:'var(--shadow-md)'}}>
        <div style={{background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}/>
        {Array.from({length:7},(_,i)=>{const d=new Date(ws);d.setDate(ws.getDate()+i);const iT=d.toDateString()===ts;return(
          <div key={i} style={{background:'var(--surface2)',padding:'10px 6px',textAlign:'center',borderBottom:'1px solid var(--border)',borderLeft:'1px solid var(--border)'}}>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',fontWeight:700,fontFamily:'Syne,sans-serif'}}>{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:iT?'var(--teal)':'var(--text)',lineHeight:1.1}}>{d.getDate()}</div>
          </div>
        )})}
        <div style={{background:'var(--surface)',borderRight:'1px solid var(--border)'}}>
          {Array.from({length:HOURS},(_,h)=>{const hr=HS+h;const l=hr===12?'12p':hr<12?`${hr}a`:`${hr-12}p`;return<div key={h} style={{height:56,display:'flex',alignItems:'flex-start',padding:'3px 6px 0',fontSize:9,color:'var(--text-dim)',borderTop:'1px solid var(--border)',fontWeight:600}}>{l}</div>})}
        </div>
        {Array.from({length:7},(_,i)=>{
          const d=new Date(ws);d.setDate(ws.getDate()+i);const dj=jobsOnDay(d)
          return(
            <div key={i} style={{position:'relative',borderLeft:'1px solid var(--border)',background:'var(--surface)',minHeight:HOURS*56}}>
              {Array.from({length:HOURS},(_,h)=><div key={h} style={{position:'absolute',left:0,right:0,top:h*56,borderTop:'1px solid var(--border)',height:56}}/>)}
              {dj.map(j=>{
                const co=new Date(j.checkoutTime),ci=j.checkinTime?new Date(j.checkinTime):new Date(co.getTime()+3*3600000)
                const top=Math.max(0,(co.getHours()+co.getMinutes()/60-HS)*56),ht=Math.max(32,((ci.getTime()-co.getTime())/3600000)*56)
                const c=jobColor(j),cl=cleaners.find(x=>jobCleanerIds(j).includes(x.id))
                return(
                  <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                    style={{position:'absolute',left:3,right:3,top,height:ht,borderRadius:6,padding:'4px 7px',cursor:'pointer',background:`${c}20`,color:c,borderLeft:`3px solid ${c}`,overflow:'hidden',zIndex:2,transition:'all 0.1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${c}35`}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${c}20`}}>
                    <div style={{fontSize:10,fontWeight:800}}>{fmt(j.checkoutTime)}</div>
                    <div style={{fontSize:11,fontWeight:700,whiteSpace:'pre-line',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'} as React.CSSProperties}>{displayName(j.propertyLabel)}</div>
                    {cl&&<div style={{fontSize:9,opacity:0.7,marginTop:2}}>{cl.name}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  function DayView(){
    const dj=jobsOnDay(currentDate)
    return(
      <>
        <div style={{textAlign:'center',marginBottom:20}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:700,color:'var(--text)'}}>{currentDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'52px 1fr',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-md)'}}>
          <div style={{background:'var(--surface2)',borderRight:'1px solid var(--border)'}}>
            {Array.from({length:HOURS},(_,h)=>{const hr=HS+h;const l=hr===12?'12p':hr<12?`${hr}a`:`${hr-12}p`;return<div key={h} style={{height:56,display:'flex',alignItems:'flex-start',padding:'3px 6px 0',fontSize:9,color:'var(--text-dim)',borderTop:'1px solid var(--border)',fontWeight:600}}>{l}</div>})}
          </div>
          <div style={{position:'relative',background:'var(--surface)',minHeight:HOURS*56}}>
            {Array.from({length:HOURS},(_,h)=><div key={h} style={{position:'absolute',left:0,right:0,top:h*56,borderTop:'1px solid var(--border)',height:56}}/>)}
            {dj.map(j=>{
              const co=new Date(j.checkoutTime),ci=j.checkinTime?new Date(j.checkinTime):new Date(co.getTime()+3*3600000)
              const top=Math.max(0,(co.getHours()+co.getMinutes()/60-HS)*56),ht=Math.max(44,((ci.getTime()-co.getTime())/3600000)*56)
              const c=jobColor(j)
              return(
                <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                  style={{position:'absolute',left:10,right:10,top,height:ht,borderRadius:8,padding:'10px 14px',cursor:'pointer',background:`${c}18`,color:c,borderLeft:`4px solid ${c}`,zIndex:2}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,whiteSpace:'pre-line'}}>{displayName(j.propertyLabel)}</div>
                  <div style={{fontSize:11,opacity:0.7,marginTop:2}}>{j.address}</div>
                  <div style={{fontSize:12,fontWeight:700,marginTop:4}}>{fmt(j.checkoutTime)} → {j.checkinTime?fmt(j.checkinTime):fmt(new Date(co.getTime()+3*3600000).toISOString())}</div>
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── ADD JOB MODAL ────────────────────────────────────────────────────────────
  function AddJobModal(){
    const [form, setForm] = useState({
      displayName: '',
      address: '',
      propertyLabel: '',
      platform: 'manual',
      checkoutTime: addJobDate,
      checkoutTimeHour: '10:00',
      checkinTime: '',
      checkinTimeHour: '15:00',
      notes: '',
      beds: '',
      baths: '',
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function set(k: string, v: string) { setForm(p=>({...p,[k]:v})) }

    async function save() {
      if (!form.displayName.trim() || !form.checkoutTime) {
        setError('Name and date are required')
        return
      }
      setSaving(true)
      try {
        const checkoutDT = new Date(`${form.checkoutTime}T${form.checkoutTimeHour}:00-08:00`)
        const checkinDT = form.checkinTime ? new Date(`${form.checkinTime}T${form.checkinTimeHour}:00-08:00`) : null

        const body = {
          platform: form.platform,
          displayName: form.displayName.trim(),
          address: form.address.trim() || form.displayName.trim(),
          propertyLabel: form.propertyLabel.trim() || form.displayName.trim(),
          customerName: null,
          checkoutTime: checkoutDT.toISOString(),
          checkinTime: checkinDT?.toISOString() || null,
          notes: form.notes,
          beds: form.beds ? parseInt(form.beds) : null,
          baths: form.baths ? parseFloat(form.baths) : null,
          cleanerIds: '[]',
          duties: '[]',
        }
        const r = await fetch('/api/jobs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
        if (!r.ok) throw new Error('Failed to save')
        loadJobs()
        setShowAddJob(false)
      } catch(e) {
        setError('Error saving job')
      }
      setSaving(false)
    }

    const inputStyle = {
      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
      fontFamily: 'DM Sans,sans-serif', fontSize: 13, outline: 'none'
    }
    const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4, display: 'block' }

    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowAddJob(false)}>
        <div style={{background:'var(--surface)',borderRadius:18,width:'100%',maxWidth:480,boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)'}} onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div style={{padding:'18px 22px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700,color:'var(--text)'}}>Add Job</div>
              <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>Create a manual cleaning job</div>
            </div>
            <button onClick={()=>setShowAddJob(false)} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',color:'var(--text-muted)',fontSize:16}}>✕</button>
          </div>
          <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:14}}>
            {error&&<div style={{padding:'8px 12px',borderRadius:7,background:'var(--red-bg)',color:'var(--red)',fontSize:12,border:'1px solid rgba(232,82,90,0.2)'}}>{error}</div>}

            {/* Name */}
            <div>
              <label style={labelStyle}>Job Name *</label>
              <input value={form.displayName} onChange={e=>set('displayName',e.target.value)}
                placeholder="e.g. Listing 1 Cleaning" style={inputStyle}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
            </div>

            {/* Property */}
            <div>
              <label style={labelStyle}>Property Label</label>
              <select value={form.propertyLabel} onChange={e=>set('propertyLabel',e.target.value)}
                style={{...inputStyle,cursor:'pointer'}}>
                <option value="">— Select property or type below —</option>
                {allPropNames.map(p=><option key={p} value={p}>{displayName(p)}</option>)}
              </select>
            </div>

            {/* Address */}
            <div>
              <label style={labelStyle}>Address</label>
              <input value={form.address} onChange={e=>set('address',e.target.value)}
                placeholder="Street address" style={inputStyle}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
            </div>

            {/* Checkout date/time */}
            <div>
              <label style={labelStyle}>Cleaning / Checkout Date & Time *</label>
              <div style={{display:'flex',gap:8}}>
                <input type="date" value={form.checkoutTime} onChange={e=>set('checkoutTime',e.target.value)}
                  style={{...inputStyle,flex:2}}
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
                <input type="time" value={form.checkoutTimeHour} onChange={e=>set('checkoutTimeHour',e.target.value)}
                  style={{...inputStyle,flex:1}}
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              </div>
            </div>

            {/* Checkin date/time */}
            <div>
              <label style={labelStyle}>Next Checkin Date & Time (optional)</label>
              <div style={{display:'flex',gap:8}}>
                <input type="date" value={form.checkinTime} onChange={e=>set('checkinTime',e.target.value)}
                  style={{...inputStyle,flex:2}}
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
                <input type="time" value={form.checkinTimeHour} onChange={e=>set('checkinTimeHour',e.target.value)}
                  style={{...inputStyle,flex:1}}
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              </div>
            </div>

            {/* Beds/baths row */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div>
                <label style={labelStyle}>Beds</label>
                <input type="number" value={form.beds} onChange={e=>set('beds',e.target.value)}
                  placeholder="—" style={inputStyle} min="0"
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              </div>
              <div>
                <label style={labelStyle}>Baths</label>
                <input type="number" value={form.baths} onChange={e=>set('baths',e.target.value)}
                  placeholder="—" style={inputStyle} min="0" step="0.5"
                  onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select value={form.platform} onChange={e=>set('platform',e.target.value)}
                  style={{...inputStyle,cursor:'pointer'}}>
                  <option value="manual">Manual</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="hostaway">Hostaway</option>
                  <option value="jobber">Jobber</option>
                  <option value="turno">Turno</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
                placeholder="Access codes, special instructions..." rows={2}
                style={{...inputStyle,resize:'vertical' as const}}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
            </div>

            {/* Actions */}
            <div style={{display:'flex',gap:8,paddingTop:4}}>
              <button onClick={()=>setShowAddJob(false)}
                style={{flex:1,padding:'10px',borderRadius:9,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                style={{flex:2,padding:'10px',borderRadius:9,background:'var(--teal)',color:'#fff',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving?0.7:1}}>
                {saving?'Saving...':'+ Create Job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── JOB MODAL ───────────────────────────────────────────────────────────────
  function JobModal(){
    if(!selectedJob)return null
    const j=selectedJob,c=jobColor(j)
    const assigned=jobCleanerIds(j).map(id=>cleaners.find(cl=>cl.id===id)).filter(Boolean) as Cleaner[]
    const bedsMatch=j.notes?.match(/Beds:\s*(\d+)/i)
    const pc=PLAT_COLORS[j.platform]||PLAT_COLORS.turno
    const platLabel=j.platform.charAt(0).toUpperCase()+j.platform.slice(1)
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelectedJob(null)}>
        <div style={{background:'var(--surface)',border:`1px solid ${c}30`,borderRadius:18,width:'100%',maxWidth:540,maxHeight:'88vh',overflowY:'auto',boxShadow:`0 0 40px ${c}20, var(--shadow-lg)`}} onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div style={{padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--surface)',borderRadius:'18px 18px 0 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,paddingRight:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,background:pc.bg,color:pc.text}}>{platLabel}</span>
                <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
              </div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:'var(--text)',lineHeight:1.2,whiteSpace:'pre-line'}}>{displayName(j.propertyLabel)}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>{j.customerName} · {j.address}</div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>{if(confirm('Delete this job?'))deleteJob(j.id)}} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--coral)'}}>🗑</button>
              <button onClick={()=>setSelectedJob(null)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'var(--text-muted)'}}>✕</button>
            </div>
          </div>
          <div style={{padding:'20px 24px'}}>
            {/* Schedule */}
            <ModalSection title="Schedule">
              <div style={{background:'var(--surface2)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',border:'1px solid var(--border)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>Checkout / Start</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--teal)'}}>{fmt(j.checkoutTime)}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtD(j.checkoutTime)}</div>
                </div>
                <div style={{color:'var(--text-dim)',fontSize:20,padding:'0 12px'}}>→</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>{j.platform==='jobber'?'End Time':'Next Check-in'}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--coral)'}}>{j.checkinTime?fmt(j.checkinTime):'—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{j.checkinTime?fmtD(j.checkinTime):'Not set'}</div>
                </div>
              </div>
            </ModalSection>

            {/* Property details */}
            {(j.beds!=null||j.baths!=null)&&(
              <ModalSection title="Property Details">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {j.beds!=null&&<StatCard label="Bedrooms" value={String(j.beds)} color={c}/>}
                  {bedsMatch&&<StatCard label="Beds" value={bedsMatch[1]} color={c}/>}
                  {j.baths!=null&&<StatCard label="Bathrooms" value={String(j.baths)} color={c}/>}
                </div>
              </ModalSection>
            )}

            {/* Next guests */}
            {j.nextGuests&&(
              <ModalSection title="Next Guests">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <StatCard label="Guest Name" value={j.nextGuests} color="var(--violet)"/>
                  <StatCard label="Guest Count" value={String(j.nextGuestCount??'—')} color="var(--violet)"/>
                </div>
              </ModalSection>
            )}

            {/* Cleaners */}
            <ModalSection title="Assigned Cleaners">
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                {assigned.map(cl=>(
                  <span key={cl.id} style={{background:`${cl.color}20`,color:cl.color,border:`1px solid ${cl.color}40`,borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:600,display:'inline-flex',alignItems:'center',gap:6}}>
                    {cl.name}<span onClick={async()=>{const ids=jobCleanerIds(j).filter(id=>id!==cl.id);await updateJob(j.id,{cleanerIds:JSON.stringify(ids)})}} style={{cursor:'pointer',opacity:0.5,fontSize:12}}>✕</span>
                  </span>
                ))}
                {assigned.length===0&&<span style={{fontSize:12,color:'var(--text-dim)'}}>No cleaners assigned</span>}
              </div>
              <select defaultValue="" onChange={async e=>{const id=e.target.value;if(!id)return;const ids=[...jobCleanerIds(j),id];await updateJob(j.id,{cleanerIds:JSON.stringify(ids)});e.target.value=''}}
                style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:12,cursor:'pointer',outline:'none'}}>
                <option value="">Add cleaner...</option>
                {cleaners.filter(cl=>!jobCleanerIds(j).includes(cl.id)).map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
            </ModalSection>

            {/* Notes */}
            <ModalSection title="Notes">
              <textarea defaultValue={j.notes?.replace(/\nBeds:.*$/,'').trim()||''} onBlur={e=>{
                const bedsLine=j.notes?.match(/\nBeds:.*$/)?.[0]||''
                updateJob(j.id,{notes:e.target.value+(bedsLine)})
              }} placeholder="Add notes..."
                style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:12,resize:'vertical',minHeight:65,outline:'none'}}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlurCapture={e=>(e.target.style.borderColor='var(--border)')}/>
            </ModalSection>
          </div>
        </div>
      </div>
    )
  }

  // ── GMAIL PANEL ─────────────────────────────────────────────────────────────
  function GmailPanel(){
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowGmailPanel(false)}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,width:'100%',maxWidth:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'var(--shadow-lg)'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)'}}>Gmail Accounts</h2>
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>Gmail connected — ready for future integrations</p>
            </div>
            <button onClick={()=>setShowGmailPanel(false)} style={{width:30,height:30,border:'1px solid var(--border)',borderRadius:8,background:'var(--surface2)',cursor:'pointer',color:'var(--text-muted)',fontSize:16}}>✕</button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:12}}>
            {syncMsg&&<div style={{padding:'10px 14px',borderRadius:8,fontSize:12,background:syncMsg.startsWith('✓')?'var(--green-bg)':'var(--red-bg)',color:syncMsg.startsWith('✓')?'var(--green)':'var(--red)',border:`1px solid ${syncMsg.startsWith('✓')?'rgba(16,185,129,0.3)':'rgba(244,63,94,0.3)'}`}}>{syncMsg}</div>}
            {gmailAccounts.length===0&&<div style={{background:'var(--surface2)',borderRadius:10,padding:16,textAlign:'center',fontSize:13,color:'var(--text-dim)'}}>No Gmail accounts connected yet.</div>}
            {gmailAccounts.map(acc=>(
              <div key={acc.id} style={{background:'var(--surface2)',borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{acc.email}</div>
                  <div style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>Last synced: {fmtRel(acc.lastSynced)}</div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>syncAccount(acc.id,acc.email)} disabled={syncing===acc.id||syncing==='all'}
                    style={{padding:'6px 12px',fontSize:11,fontWeight:700,borderRadius:7,background:'var(--teal-bg)',color:'var(--teal)',border:'1px solid var(--teal-border)',cursor:'pointer',opacity:syncing?0.5:1,fontFamily:'DM Sans,sans-serif'}}>
                    {syncing===acc.id?'Syncing...':'⟳ Sync'}
                  </button>
                  <button onClick={()=>{if(confirm(`Disconnect ${acc.email}?`))disconnectGmail(acc.id)}}
                    style={{padding:'6px 12px',fontSize:11,fontWeight:700,borderRadius:7,background:'var(--red-bg)',color:'var(--red)',border:'1px solid rgba(244,63,94,0.3)',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
            <button onClick={connectGmail}
              style={{width:'100%',padding:'12px',borderRadius:10,background:'var(--teal)',color:'#000',border:'none',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>
              + Connect Gmail Account
            </button>
            {gmailAccounts.length>1&&(
              <button onClick={syncAll} disabled={syncing==='all'}
                style={{width:'100%',padding:'10px',borderRadius:10,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,cursor:'pointer',opacity:syncing==='all'?0.5:1}}>
                {syncing==='all'?'Syncing all...':'⟳ Sync All Accounts'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── OTHER PAGES ─────────────────────────────────────────────────────────────
  function PropertiesPage(){
    const [tab, setTab] = useState<'properties'|'clients'>('properties')
    const [platFilter, setPlatFilter] = useState('all')
    const [searchQ, setSearchQ] = useState('')
    const [expandedClient, setExpandedClient] = useState<string|null>(null)
    const [newClientName, setNewClientName] = useState('')

    // persisted propClientMap — property label → client name
    const [propClientMap, setPropClientMap] = useState<Record<string,string>>(()=>{
      try{return JSON.parse(localStorage.getItem('propClientMap')||'{}')}catch{return{}}
    })
    // custom clients list (additions beyond what jobs derive)
    const [customClients, setCustomClients] = useState<string[]>(()=>{
      try{return JSON.parse(localStorage.getItem('customClients')||'[]')}catch{return[]}
    })

    function assignPropClient(prop: string, client: string) {
      const next={...propClientMap,[prop]:client}
      setPropClientMap(next); localStorage.setItem('propClientMap',JSON.stringify(next))
    }
    function addCustomClient(name: string) {
      if(!name.trim())return
      const next=[...new Set([...customClients,name.trim()])]
      setCustomClients(next); localStorage.setItem('customClients',JSON.stringify(next))
    }
    function removeCustomClient(name: string) {
      const next=customClients.filter(c=>c!==name)
      setCustomClients(next); localStorage.setItem('customClients',JSON.stringify(next))
    }

    // All client names = from jobs + custom
    const autoClients=[...new Set(jobs.map(j=>j.customerName).filter(Boolean))] as string[]
    const allClientNames=[...new Set([...autoClients,...customClients])].sort()

    // All properties with optional client assigned
    const propsWithClient = allPropNames.map(p=>{
      const propJobs=jobs.filter(j=>j.propertyLabel===p)
      const autoClient=propJobs.find(j=>j.customerName)?.customerName||null
      const assignedClient=propClientMap[p]||autoClient
      return {p, assignedClient, propJobs}
    })

    // Build client → properties map
    const clientPropMap: Record<string,{p:string;propJobs:any[]}[]> = {}
    for(const {p,assignedClient,propJobs} of propsWithClient){
      const key=assignedClient||'__unassigned__'
      if(!clientPropMap[key]) clientPropMap[key]=[]
      clientPropMap[key].push({p,propJobs})
    }

    const filteredProps = allPropNames
      .filter(p=>platFilter==='all'||jobs.find(j=>j.propertyLabel===p&&j.platform===platFilter))
      .filter(p=>!searchQ||p.toLowerCase().includes(searchQ.toLowerCase())||displayName(p).toLowerCase().includes(searchQ.toLowerCase()))

    const PLAT_OPTS=['all','airbnb','turno','jobber','hostaway']

    return(
      <div>
        {/* Header with tabs */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h1 style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:700,color:'var(--text)'}}>Properties & Clients</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{allPropNames.length} properties · {allClientNames.length} clients</p>
          </div>
          <div style={{display:'flex',gap:3,background:'var(--surface2)',borderRadius:10,padding:4,border:'1px solid var(--border)'}}>
            {(['properties','clients'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{padding:'7px 16px',borderRadius:7,border:'none',background:tab===t?'var(--teal)':'transparent',color:tab===t?'#000':'var(--text-muted)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab==='properties'&&(
          <div>
            {/* Filters */}
            <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search properties..."
                style={{flex:'1 1 180px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:12,outline:'none'}}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {PLAT_OPTS.map(p=>(
                  <button key={p} onClick={()=>setPlatFilter(p)}
                    style={{padding:'6px 12px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif',
                      background:platFilter===p?'var(--teal)':'var(--surface2)',color:platFilter===p?'#000':'var(--text-muted)',
                      border:`1px solid ${platFilter===p?'var(--teal)':'var(--border)'}`,textTransform:'capitalize'}}>
                    {p==='all'?'All':p.charAt(0).toUpperCase()+p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
              {filteredProps.map(p=>{
                const c=colorMap[p]||colorFromRules(p,colorRules)||DEFAULT_PROP_COLOR
                const propJobs=jobs.filter(j=>j.propertyLabel===p)
                const upcoming=propJobs.filter(j=>new Date(j.checkoutTime)>new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
                const isHidden=hiddenProps.has(p)
                const plats=[...new Set(propJobs.map(j=>j.platform))]
                const autoClient=propJobs.find(j=>j.customerName)?.customerName||null
                const assignedClient=propClientMap[p]||autoClient
                return(
                  <div key={p} style={{background:'var(--surface)',border:`1px solid ${c}25`,borderRadius:12,overflow:'hidden',transition:'box-shadow 0.15s'}}
                    onMouseEnter={e=>(e.currentTarget.style.boxShadow=`0 4px 20px ${c}18`)}
                    onMouseLeave={e=>(e.currentTarget.style.boxShadow='')}>
                    <div style={{height:4,background:`linear-gradient(90deg,${c},${c}50)`}}/>
                    <div style={{padding:'13px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:700,color:'var(--text)',lineHeight:1.2,marginBottom:2}}>{displayName(p)}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{propJobs[0]?.address||p}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginLeft:8}}>
                          <button onClick={()=>setExpandedColorProp(expandedColorProp===p?null:p)}
                            style={{width:16,height:16,borderRadius:3,background:c,border:'none',cursor:'pointer',flexShrink:0}}/>
                          <button onClick={()=>togglePropVisibility(p)}
                            style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:isHidden?'var(--text-dim)':'var(--teal)',flexShrink:0,padding:0}}
                            title={isHidden?'Hidden from calendar':'Visible on calendar'}>
                            {isHidden?'○':'●'}
                          </button>
                        </div>
                      </div>
                      {expandedColorProp===p&&(
                        <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:8,padding:'7px',background:'var(--surface2)',borderRadius:6}}>
                          {COLOR_PALETTE.map(col=>(
                            <button key={col} onClick={()=>assignColor(p,col)}
                              style={{width:16,height:16,borderRadius:2,background:col,border:colorMap[p]===col?'2px solid white':'2px solid transparent',cursor:'pointer'}}/>
                          ))}
                        </div>
                      )}
                      {/* Platform + client row */}
                      <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
                        {plats.map(plt=>{const pc=PLAT_COLORS[plt]||PLAT_COLORS.turno;return(
                          <span key={plt} style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:pc.bg,color:pc.text,fontWeight:700,textTransform:'capitalize'}}>{plt}</span>
                        )})}
                        {assignedClient&&(
                          <span style={{fontSize:9,padding:'2px 8px',borderRadius:8,background:'var(--violet-bg)',color:'var(--violet)',fontWeight:600,border:'1px solid rgba(167,139,250,0.2)'}}>👤 {assignedClient}</span>
                        )}
                      </div>
                      {/* Client assignment */}
                      <select value={assignedClient||''} onChange={e=>assignPropClient(p,e.target.value)}
                        style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:11,outline:'none',cursor:'pointer',marginBottom:8}}>
                        <option value="">— Assign to client —</option>
                        {allClientNames.map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      {/* Stats */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:upcoming[0]?8:0}}>
                        <MiniStat label="Total" value={String(propJobs.length)}/>
                        <MiniStat label="Upcoming" value={String(upcoming.length)} color="var(--teal)"/>
                      </div>
                      {upcoming[0]&&(
                        <div style={{background:'var(--teal-bg)',borderRadius:6,padding:'6px 8px',border:'1px solid var(--teal-border)'}}>
                          <div style={{fontSize:9,color:'var(--teal)',fontWeight:700,textTransform:'uppercase',letterSpacing:0.8,marginBottom:2}}>Next</div>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--teal)'}}>{fmtD(upcoming[0].checkoutTime)} · {fmt(upcoming[0].checkoutTime)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab==='clients'&&(
          <div>
            {/* Add new client */}
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:20,display:'flex',gap:10,alignItems:'center'}}>
              <input value={newClientName} onChange={e=>setNewClientName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){addCustomClient(newClientName);setNewClientName('')}}}
                placeholder="Type a client name and press Enter..."
                style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 14px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:13,outline:'none'}}
                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
              <button onClick={()=>{addCustomClient(newClientName);setNewClientName('')}} disabled={!newClientName.trim()}
                style={{padding:'9px 18px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',opacity:newClientName.trim()?1:0.4}}>
                + Add Client
              </button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {allClientNames.map(name=>{
                const isExpanded=expandedClient===name
                const clientJobs=jobs.filter(j=>j.customerName===name)
                // Properties assigned to this client via propClientMap OR auto-assigned
                const assignedProps=propsWithClient.filter(({assignedClient})=>assignedClient===name).map(x=>x.p)
                const upcoming=clientJobs.filter(j=>new Date(j.checkoutTime)>new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
                const accentColor=colorMap[assignedProps[0]]||colorFromRules(name,colorRules)||'#a78bfa'
                const isCustom=!autoClients.includes(name)
                const initials=name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()
                return(
                  <div key={name} style={{background:'var(--surface)',border:`1px solid ${accentColor}20`,borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
                    {/* Client header row — always visible */}
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpandedClient(isExpanded?null:name)}>
                      <div style={{width:40,height:40,borderRadius:'50%',background:`${accentColor}20`,border:`2px solid ${accentColor}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:accentColor,flexShrink:0}}>
                        {initials}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)',display:'flex',alignItems:'center',gap:8}}>
                          {name}
                          {isCustom&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:6,background:'var(--surface2)',color:'var(--text-dim)',fontWeight:600}}>custom</span>}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                          {assignedProps.length} propert{assignedProps.length===1?'y':'ies'}
                          {clientJobs.length>0&&` · ${clientJobs.length} jobs`}
                          {upcoming.length>0&&` · ${upcoming.length} upcoming`}
                        </div>
                      </div>
                      {/* Property color dots */}
                      <div style={{display:'flex',gap:3,marginRight:8}}>
                        {assignedProps.slice(0,5).map(p=>{
                          const c=colorMap[p]||colorFromRules(p,colorRules)||DEFAULT_PROP_COLOR
                          return <div key={p} style={{width:8,height:8,borderRadius:2,background:c}} title={displayName(p)}/>
                        })}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {isCustom&&<button onClick={e=>{e.stopPropagation();removeCustomClient(name)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--text-dim)',padding:'2px 4px'}} title="Remove custom client">✕</button>}
                        <span style={{fontSize:12,color:'var(--text-dim)'}}>{isExpanded?'▾':'▸'}</span>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded&&(
                      <div style={{padding:'0 16px 16px',borderTop:'1px solid var(--border)'}}>
                        {/* Properties */}
                        {assignedProps.length>0&&(
                          <div style={{marginTop:12,marginBottom:12}}>
                            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'var(--text-dim)',marginBottom:8}}>Properties</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                              {assignedProps.map(p=>{
                                const c=colorMap[p]||colorFromRules(p,colorRules)||DEFAULT_PROP_COLOR
                                const propJobs=jobs.filter(j=>j.propertyLabel===p)
                                const propUpcoming=propJobs.filter(j=>new Date(j.checkoutTime)>new Date())
                                return(
                                  <div key={p} style={{background:`${c}12`,border:`1px solid ${c}30`,borderRadius:8,padding:'8px 12px',minWidth:140}}>
                                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                                      <div style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>
                                      <span style={{fontSize:12,fontWeight:700,color:c}}>{displayName(p)}</span>
                                    </div>
                                    <div style={{fontSize:10,color:'var(--text-dim)'}}>{propJobs[0]?.address||p}</div>
                                    <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{propUpcoming.length} upcoming</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {/* Next 3 upcoming jobs */}
                        {upcoming.length>0&&(
                          <div>
                            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'var(--text-dim)',marginBottom:8}}>Upcoming Jobs</div>
                            <div style={{display:'flex',flexDirection:'column',gap:4}}>
                              {upcoming.slice(0,3).map(j=>{
                                const c=jobColor(j)
                                return(
                                  <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                                    style={{display:'flex',alignItems:'center',gap:10,background:`${c}10`,border:`1px solid ${c}25`,borderRadius:8,padding:'8px 12px',cursor:'pointer'}}
                                    onMouseEnter={e=>(e.currentTarget.style.background=`${c}20`)}
                                    onMouseLeave={e=>(e.currentTarget.style.background=`${c}10`)}>
                                    <div style={{width:4,height:32,borderRadius:2,background:c,flexShrink:0}}/>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName(j.propertyLabel)}</div>
                                      <div style={{fontSize:10,color:'var(--text-muted)'}}>{fmtD(j.checkoutTime)} · {fmt(j.checkoutTime)} → {fmt(j.checkinTime)}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {assignedProps.length===0&&clientJobs.length===0&&(
                          <div style={{padding:'16px 0',textAlign:'center',fontSize:12,color:'var(--text-dim)'}}>No properties or jobs assigned yet. Go to Properties tab to assign.</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {allClientNames.length===0&&(
                <div style={{textAlign:'center',padding:'40px',color:'var(--text-dim)',fontSize:13}}>
                  No clients yet. Type a name above to create one, or assign properties to clients on the Properties tab.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }


  function TeamPage(){
    return(
      <div>
        <PageHeader title="Team" subtitle={`${cleaners.length} cleaners`} action={<Chip color="var(--amber)">+ Add Cleaner</Chip>}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
          {cleaners.map(cl=>{
            const assigned=jobs.filter(j=>jobCleanerIds(j).includes(cl.id))
            const upcoming=assigned.filter(j=>new Date(j.checkoutTime)>new Date())
            return(
              <div key={cl.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'18px',boxShadow:'var(--shadow-sm)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                  <div style={{width:48,height:48,borderRadius:'50%',background:`${cl.color}20`,border:`2px solid ${cl.color}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:cl.color,flexShrink:0}}>
                    {cl.name.split(' ').map(w=>w[0]).join('')}
                  </div>
                  <div>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>{cl.name}</div>
                    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}/>
                      <span style={{fontSize:11,color:'var(--text-muted)'}}>Active</span>
                    </div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  <MiniStat label="Total Jobs" value={String(assigned.length)}/>
                  <MiniStat label="Upcoming" value={String(upcoming.length)} color={cl.color}/>
                </div>
                {upcoming[0]&&(
                  <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 12px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:10,color:'var(--text-dim)',fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Next Job</div>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{displayName(upcoming[0].propertyLabel)}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{fmtD(upcoming[0].checkoutTime)} · {fmt(upcoming[0].checkoutTime)}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function InvoicesPage(){
    const upcoming=jobs.filter(j=>new Date(j.checkoutTime)>new Date()).slice(0,10)
    return(
      <div>
        <PageHeader title="Invoices" subtitle="Create and track invoices for cleaning jobs" action={<Chip color="var(--amber)">+ New Invoice</Chip>}/>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-md)',marginBottom:24}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:16}}>
            {[{label:'Draft',count:0,color:'var(--text-muted)'},{label:'Sent',count:0,color:'var(--amber)'},{label:'Paid',count:0,color:'var(--green)'},{label:'Overdue',count:0,color:'var(--coral)'}].map(s=>(
              <div key={s.label} style={{textAlign:'center',flex:1}}>
                <div style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:700,color:s.color}}>{s.count}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'40px',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>💰</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>Invoice Management Coming Soon</div>
            <div style={{fontSize:13,color:'var(--text-muted)',maxWidth:400,margin:'0 auto',lineHeight:1.6}}>
              Create professional invoices for each cleaning job, send them directly to clients, and track payment status. You can convert any job directly into an invoice.
            </div>
            <div style={{marginTop:24,display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
              {['Per-job invoicing','Client email delivery','Payment tracking','PDF export','Stripe integration'].map(f=>(
                <span key={f} style={{padding:'6px 14px',borderRadius:20,background:'var(--surface2)',border:'1px solid var(--border)',fontSize:12,color:'var(--text-muted)',fontWeight:500}}>{f}</span>
              ))}
            </div>
            <div style={{marginTop:24}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:12}}>Ready to invoice from upcoming jobs:</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,maxWidth:500,margin:'0 auto'}}>
                {upcoming.slice(0,5).map(j=>(
                  <div key={j.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface2)',borderRadius:8,padding:'10px 14px',border:'1px solid var(--border)'}}>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{displayName(j.propertyLabel)}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{fmtD(j.checkoutTime)}</div>
                    </div>
                    <button style={{padding:'5px 12px',borderRadius:6,background:'var(--amber-bg)',color:'var(--amber)',border:'1px solid rgba(255,209,102,0.3)',fontSize:11,fontWeight:700,cursor:'not-allowed',fontFamily:'DM Sans,sans-serif'}}>Create Invoice</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function IntegrationsPage(){
    const integrations=[
      {name:'Gmail',icon:'✉️',desc:'Connect Gmail account (sync paused — manual entry available)',status:gmailAccounts.length>0?'connected':'available',count:gmailAccounts.length,color:'var(--coral)',type:'gmail'},
      {name:'Jobber',icon:'💼',desc:'Sync scheduled visits directly from Jobber',status:jobberAccounts.length>0?'connected':'available',count:jobberAccounts.length,color:'#00c4ff',type:'jobber'},
      {name:'Airbnb',icon:'🏠',desc:'Sync reservations via iCal link',status:'coming',color:'var(--coral)',type:'airbnb'},
      {name:'Hostaway',icon:'🔑',desc:'iCal calendar sync',status:hostawayAccounts.length>0?'connected':'available',count:hostawayAccounts.length,color:'var(--amber)',type:'hostaway'},
      {name:'Stripe',icon:'💳',desc:'Payment processing for invoices',status:'coming',color:'var(--violet)',type:'stripe'},
      {name:'QuickBooks',icon:'📊',desc:'Accounting integration',status:'coming',color:'var(--green)',type:'qb'},
      {name:'Google Calendar',icon:'📅',desc:'Two-way calendar sync',status:'coming',color:'var(--teal)',type:'gcal'},
    ]
    return(
      <div>
        <PageHeader title="Integrations" subtitle="Connect your platforms and tools"/>
        {syncMsg&&<div style={{marginBottom:16,padding:'10px 14px',borderRadius:8,fontSize:12,background:syncMsg.startsWith('✓')?'var(--green-bg)':'var(--red-bg)',color:syncMsg.startsWith('✓')?'var(--green)':'var(--red)',border:`1px solid ${syncMsg.startsWith('✓')?'rgba(16,185,129,0.3)':'rgba(244,63,94,0.3)'}`}}>{syncMsg}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
          {integrations.map(intg=>(
            <div key={intg.name} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'18px',boxShadow:'var(--shadow-sm)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:44,height:44,borderRadius:12,background:`${intg.color}18`,border:`1px solid ${intg.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{intg.icon}</div>
                  <div>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>{intg.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{intg.desc}</div>
                  </div>
                </div>
                <StatusBadge status={intg.status}/>
              </div>

              {/* Connected accounts list */}
              {intg.type==='gmail'&&gmailAccounts.length>0&&(
                <div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>
                  {gmailAccounts.map(acc=>(
                    <div key={acc.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface2)',borderRadius:8,padding:'7px 10px',border:'1px solid var(--border)'}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{acc.email}</div>
                        <div style={{fontSize:10,color:'var(--text-dim)'}}>Synced {fmtRel(acc.lastSynced)}</div>
                      </div>
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>syncAccount(acc.id,acc.email)} disabled={!!syncing}
                          style={{padding:'4px 10px',fontSize:10,fontWeight:700,borderRadius:6,background:'var(--teal-bg)',color:'var(--teal)',border:'1px solid var(--teal-border)',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                          ⟳
                        </button>
                        <button onClick={()=>{if(confirm(`Disconnect ${acc.email}?`))disconnectGmail(acc.id)}}
                          style={{padding:'4px 10px',fontSize:10,fontWeight:700,borderRadius:6,background:'var(--red-bg)',color:'var(--red)',border:'1px solid rgba(244,63,94,0.3)',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {intg.type==='jobber'&&jobberAccounts.length>0&&(
                <div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>
                  {jobberAccounts.map(acc=>(
                    <div key={acc.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface2)',borderRadius:8,padding:'7px 10px',border:'1px solid var(--border)'}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{acc.companyName||acc.email}</div>
                        <div style={{fontSize:10,color:'var(--text-dim)'}}>Synced {fmtRel(acc.lastSynced)}</div>
                      </div>
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>syncJobberAccount(acc.id,acc.email)} disabled={!!syncing}
                          style={{padding:'4px 10px',fontSize:10,fontWeight:700,borderRadius:6,background:'rgba(0,196,255,0.1)',color:'#00c4ff',border:'1px solid rgba(0,196,255,0.3)',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                          ⟳
                        </button>
                        <button onClick={()=>{if(confirm('Disconnect Jobber account?'))disconnectJobber(acc.id)}}
                          style={{padding:'4px 10px',fontSize:10,fontWeight:700,borderRadius:6,background:'var(--red-bg)',color:'var(--red)',border:'1px solid rgba(244,63,94,0.3)',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {intg.type==='hostaway'&&(
                <HostawayPanel
                  accounts={hostawayAccounts}
                  onRefresh={loadHostawayAccounts}
                  onJobsRefresh={loadJobs}
                  syncing={syncing}
                  setSyncing={setSyncing}
                  setSyncMsg={setSyncMsg}
                />
              )}

              {/* Action button — not shown for hostaway (managed in panel above) */}
              {intg.type!=='hostaway'&&(
              <button
                onClick={intg.type==='gmail'?connectGmail:intg.type==='jobber'?connectJobber:undefined}
                disabled={intg.status==='coming'}
                style={{width:'100%',padding:'9px',borderRadius:8,fontSize:12,fontWeight:700,
                  cursor:intg.status==='coming'?'default':'pointer',
                  background:intg.status==='connected'?`${intg.color}18`:intg.status==='coming'?'var(--surface2)':'var(--surface2)',
                  color:intg.status==='connected'?intg.color:intg.status==='coming'?'var(--text-dim)':'var(--text-muted)',
                  border:`1px solid ${intg.status==='connected'?`${intg.color}35`:'var(--border)'}`,
                  fontFamily:'DM Sans,sans-serif',opacity:intg.status==='coming'?0.4:1,transition:'all 0.15s',
                  display:intg.type==='hostaway'?'none':'block'}}>
                {intg.status==='connected'?`+ Connect Another ${intg.name} Account`:intg.status==='coming'?'Coming Soon':`Connect ${intg.name}`}
              </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function SettingsPage(){
    return(
      <div>
        <PageHeader title="Settings" subtitle="Manage your CleanSync account"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:800}}>
          {[
            {title:'Account',icon:'👤',items:['Profile name','Email address','Change password','Two-factor auth']},
            {title:'Notifications',icon:'🔔',items:['Email alerts for new jobs','Daily sync summary','Payment reminders','Team assignment alerts']},
            {title:'Client Portal',icon:'🌐',items:['Enable client login','Custom portal URL','Client permissions','Branding & logo']},
            {title:'Calendar',icon:'📅',items:['Default view','Timezone (Alaska)','Working hours','Color scheme']},
          ].map(section=>(
            <div key={section.title} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'18px',boxShadow:'var(--shadow-sm)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:20}}>{section.icon}</span>
                <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>{section.title}</span>
              </div>
              {section.items.map(item=>(
                <div key={item} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,color:'var(--text-muted)'}}>{item}</span>
                  <button style={{padding:'4px 12px',borderRadius:6,background:'var(--surface2)',border:'1px solid var(--border)',fontSize:11,color:'var(--text-muted)',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontWeight:600}}>Edit</button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{marginTop:20,maxWidth:800}}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'18px',boxShadow:'var(--shadow-sm)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span style={{fontSize:20}}>🔐</span>
              <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>Danger Zone</span>
            </div>
            <button onClick={handleLogout}
              style={{padding:'10px 20px',borderRadius:8,background:'var(--red-bg)',color:'var(--red)',border:'1px solid rgba(244,63,94,0.3)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── HELPER COMPONENTS ────────────────────────────────────────────────────────
  function ModalSection({title,children}:{title:string;children:React.ReactNode}){return(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8,fontFamily:'Syne,sans-serif'}}>{title}</div>
      {children}
    </div>
  )}
  function StatCard({label,value,color='var(--teal)'}:{label:string;value:string;color?:string}){return(
    <div style={{background:'var(--surface2)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--border)'}}>
      <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:4,fontWeight:700}}>{label}</div>
      <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color}}>{value}</div>
    </div>
  )}
  function MiniStat({label,value,color='var(--text)'}:{label:string;value:string;color?:string}){return(
    <div style={{background:'var(--surface2)',borderRadius:8,padding:'8px 10px',border:'1px solid var(--border)'}}>
      <div style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,fontWeight:700,marginBottom:2}}>{label}</div>
      <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color}}>{value}</div>
    </div>
  )}
  function Chip({children,color='var(--teal)'}:{children:React.ReactNode;color?:string}){return(
    <button style={{padding:'8px 16px',borderRadius:8,background:`${color}18`,color,border:`1px solid ${color}35`,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>{children}</button>
  )}
  function PageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
      <div>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:700,color:'var(--text)'}}>{title}</h1>
        {subtitle&&<p style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )}
  function StatusBadge({status,count}:{status:string;count?:number}){
    const cfg:{[k:string]:{label:string;color:string}}={
      'connected':{label:'Connected',color:'var(--green)'},
      'available':{label:'Available',color:'var(--text-muted)'},
      'via-email':{label:'Via Email',color:'var(--teal)'},
      'coming':{label:'Coming Soon',color:'var(--text-dim)'},
    }
    const s=cfg[status]||cfg['available']
    return <span style={{fontSize:10,padding:'3px 8px',borderRadius:20,background:`${s.color}18`,color:s.color,border:`1px solid ${s.color}30`,fontWeight:700,whiteSpace:'nowrap'}}>{s.label}</span>
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg)',fontFamily:'DM Sans,sans-serif'}}>

      {/* LEFT NAV */}
      <nav style={{width:sidebarCollapsed?64:220,minWidth:sidebarCollapsed?64:220,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',transition:'width 0.2s,min-width 0.2s',overflow:'hidden',flexShrink:0}}>
        {/* Logo */}
        <div style={{padding:'20px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,minWidth:220}}>
          <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,var(--teal),#0099cc)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 0 12px rgba(0,212,170,0.3)'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="white" opacity="0.9"/><rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity="0.6"/><rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity="0.6"/><rect x="13" y="13" width="8" height="8" rx="2" fill="white" opacity="0.3"/></svg>
          </div>
          {!sidebarCollapsed&&<div><div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)'}}>CleanSync</div><div style={{fontSize:10,color:'var(--teal)',fontWeight:600,letterSpacing:1}}>PRO</div></div>}
        </div>

        {/* Nav items */}
        <div style={{flex:1,padding:'12px 8px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto',minWidth:sidebarCollapsed?64:220}}>
          {NAV_ITEMS.map(item=>{
            const active=page===item.id
            return(
              <button key={item.id} onClick={()=>setPage(item.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:sidebarCollapsed?'10px':'10px 12px',borderRadius:10,border:'none',cursor:'pointer',background:active?'var(--teal-bg)':'transparent',color:active?'var(--teal)':'var(--text-muted)',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:active?700:500,transition:'all 0.15s',textAlign:'left',width:'100%',position:'relative',justifyContent:sidebarCollapsed?'center':'flex-start'}}>
                <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                {!sidebarCollapsed&&<span style={{flex:1,whiteSpace:'nowrap'}}>{item.label}</span>}
                {!sidebarCollapsed&&item.badge&&<span style={{fontSize:8,padding:'2px 5px',borderRadius:4,background:'var(--amber)',color:'#000',fontWeight:800,letterSpacing:0.5}}>{item.badge}</span>}
                {active&&<div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:20,borderRadius:'0 2px 2px 0',background:'var(--teal)'}}/>}
              </button>
            )
          })}
        </div>

        {/* Collapse toggle */}
        <div style={{padding:'12px 8px',borderTop:'1px solid var(--border)'}}>
          <button onClick={()=>setSidebarCollapsed(p=>!p)}
            style={{width:'100%',padding:'8px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',color:'var(--text-muted)',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:'DM Sans,sans-serif',fontWeight:500}}>
            {sidebarCollapsed?'→':'← Collapse'}
          </button>
        </div>
      </nav>

      {/* MAIN AREA */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* TOP BAR */}
        <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexShrink:0,gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {page==='calendar'&&(
              <>
                <button onClick={()=>navigate(-1)} style={{width:30,height:30,border:'1px solid var(--border)',borderRadius:7,background:'var(--surface2)',color:'var(--text)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
                <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,minWidth:160,textAlign:'center',color:'var(--text)'}}>{periodLabel()}</span>
                <button onClick={()=>navigate(1)} style={{width:30,height:30,border:'1px solid var(--border)',borderRadius:7,background:'var(--surface2)',color:'var(--text)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
              </>
            )}
            {page!=='calendar'&&<h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)'}}>{NAV_ITEMS.find(n=>n.id===page)?.label}</h2>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {page==='calendar'&&(
              <div style={{display:'flex',background:'var(--surface2)',borderRadius:8,padding:3,gap:2,border:'1px solid var(--border)'}}>
                {(['day','month','week'] as const).map(v=>(
                  <button key={v} onClick={()=>setView(v)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:view===v?'var(--teal)':'transparent',color:view===v?'#000':'var(--text-muted)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s',textTransform:'capitalize'}}>{v}</button>
                ))}
              </div>
            )}
            {page==='calendar'&&(
              <button onClick={()=>{setAddJobDate(new Date().toISOString().slice(0,10));setShowAddJob(true)}}
                style={{padding:'6px 14px',borderRadius:8,background:'var(--teal)',color:'#fff',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                + Job
              </button>
            )}
            {/* Sync status */}
            {gmailAccounts.length>0&&(
              <button onClick={syncAll} disabled={syncing==='all'}
                style={{padding:'6px 12px',borderRadius:8,background:'var(--teal-bg)',color:'var(--teal)',border:'1px solid var(--teal-border)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:syncing==='all'?0.5:1}}>
                {syncing==='all'?'⟳ Syncing...':'⟳ Sync'}
              </button>
            )}
            <button onClick={()=>setShowGmailPanel(true)}
              style={{padding:'6px 12px',borderRadius:8,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              ✉ Gmail {gmailAccounts.length>0&&<span style={{background:'var(--teal)',color:'#000',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800}}>{gmailAccounts.length}</span>}
            </button>
          </div>
        </header>

        {/* CONTENT + RIGHT SIDEBAR */}
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>

          {/* MAIN CONTENT */}
          <main style={{flex:1,overflowY:'auto',padding:20}}>
            {syncMsg&&page==='calendar'&&<div style={{marginBottom:12,padding:'10px 14px',borderRadius:8,fontSize:12,background:syncMsg.startsWith('✓')?'var(--green-bg)':'var(--red-bg)',color:syncMsg.startsWith('✓')?'var(--green)':'var(--red)',border:`1px solid ${syncMsg.startsWith('✓')?'rgba(16,185,129,0.3)':'rgba(244,63,94,0.3)'}`}}>{syncMsg}</div>}
            {page==='calendar'&&view==='month'&&<MonthView/>}
            {page==='calendar'&&view==='week'&&<WeekView/>}
            {page==='calendar'&&view==='day'&&<DayView/>}
            {page==='properties'&&<PropertiesPage/>}
            {page==='clients'&&<PropertiesPage/>}
            {page==='team'&&<TeamPage/>}
            {page==='invoices'&&<InvoicesPage/>}
            {page==='integrations'&&<IntegrationsPage/>}
            {page==='settings'&&<SettingsPage/>}
          </main>

          {/* RIGHT SIDEBAR — calendar page only */}
          {page==='calendar'&&(
            <aside style={{width:220,minWidth:220,background:'var(--surface)',borderLeft:'1px solid var(--border)',padding:'16px 13px',overflowY:'auto',display:'flex',flexDirection:'column',gap:18,flexShrink:0}}>
              {/* Auto-sync */}
              {gmailAccounts.length>0&&(
                <div>
                  <SidebarLabel>Auto-Sync</SidebarLabel>
                  <div style={{background:'var(--teal-bg)',borderRadius:8,padding:'10px 12px',fontSize:10,border:'1px solid var(--teal-border)'}}>
                    {gmailAccounts.map(acc=>(
                      <div key={acc.id} style={{display:'flex',justifyContent:'space-between',gap:4,marginBottom:4}}>
                        <span style={{color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{acc.email.split('@')[0]}</span>
                        <span style={{color:'var(--text-dim)',flexShrink:0}}>{fmtRel(acc.lastSynced)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platforms */}
              <div>
                <SidebarLabel>Platforms</SidebarLabel>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {['airbnb','jobber','turno','hostaway'].map(p=>{
                    const pc=PLAT_COLORS[p],active=activePlatforms.has(p)
                    return(
                      <div key={p} onClick={()=>setActivePlatforms(prev=>{const n=new Set(prev);n.has(p)?n.delete(p):n.add(p);return n})}
                        style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:8,cursor:'pointer',background:active?'var(--surface2)':'transparent',opacity:active?1:0.35,transition:'all 0.1s',border:`1px solid ${active?'var(--border)':'transparent'}`}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:pc.dot,flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--text)',textTransform:'capitalize',flex:1}}>{p}</span>
                        {active&&<span style={{fontSize:10,color:'var(--teal)',fontWeight:700}}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Properties by platform — collapsible groups */}
              {allPropNames.length>0&&(
                <div>
                  <SidebarLabel>Properties</SidebarLabel>
                  <SidebarPropGroups
                    jobs={jobs}
                    colorMap={colorMap}
                    colorRules={colorRules}
                    hiddenProps={hiddenProps}
                    expandedColorProp={expandedColorProp}
                    setExpandedColorProp={setExpandedColorProp}
                    displayName={displayName}
                    savePropName={savePropName}
                    togglePropVisibility={togglePropVisibility}
                    assignColor={assignColor}
                  />
                </div>
              )}

              {/* Color Rules — keyword → color */}
              <div>
                <SidebarLabel>Color Rules</SidebarLabel>
                <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
                  {colorRules.map((rule,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:5,background:'var(--surface2)',borderRadius:7,padding:'5px 7px',border:'1px solid var(--border)'}}>
                      <div style={{width:10,height:10,borderRadius:3,background:rule.color,flexShrink:0}}/>
                      <span style={{fontSize:11,color:'var(--text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rule.keyword}</span>
                      <button onClick={()=>{const next=colorRules.filter((_,j)=>j!==i);setColorRules(next);saveColorRules(next)}}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'var(--text-dim)',padding:'0 2px',flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
                <ColorRuleAdder onAdd={(rule)=>{const next=[...colorRules,rule];setColorRules(next);saveColorRules(next)}}/>
              </div>
            </aside>
          )}
        </div>
      </div>

      {selectedJob&&<JobModal/>}
      {showAddJob&&<AddJobModal/>}
      {showGmailPanel&&<GmailPanel/>}
    </div>
  )
}

function ColorRuleAdder({onAdd}:{onAdd:(r:ColorRule)=>void}){
  const [keyword,setKeyword]=useState('')
  const [color,setColor]=useState(COLOR_PALETTE[0])
  const [open,setOpen]=useState(false)
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{width:'100%',padding:'5px',borderRadius:7,background:'var(--surface2)',border:'1px solid var(--border)',fontSize:11,color:'var(--text-muted)',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontWeight:600}}>+ Add Rule</button>
  )
  return(
    <div style={{background:'var(--surface2)',borderRadius:8,padding:'8px',border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:6}}>
      <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="keyword (e.g. Eric)"
        style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:11,outline:'none'}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
        {COLOR_PALETTE.map(c=>(
          <button key={c} onClick={()=>setColor(c)}
            style={{width:16,height:16,borderRadius:3,background:c,border:color===c?'2px solid white':'2px solid transparent',cursor:'pointer'}}/>
        ))}
      </div>
      <div style={{display:'flex',gap:5}}>
        <button onClick={()=>{if(keyword.trim()){onAdd({keyword:keyword.trim(),color});setKeyword('');setOpen(false)}}}
          style={{flex:1,padding:'5px',borderRadius:6,background:'var(--teal)',color:'#000',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:11,fontWeight:700,cursor:'pointer'}}>Save</button>
        <button onClick={()=>setOpen(false)}
          style={{padding:'5px 8px',borderRadius:6,background:'var(--surface3)',color:'var(--text-muted)',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:11,cursor:'pointer'}}>Cancel</button>
      </div>
    </div>
  )
}

function HostawayPanel({accounts, onRefresh, onJobsRefresh, syncing, setSyncing, setSyncMsg}: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({listingId:'', name:'', icalUrl:''})
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  async function addListing() {
    if (!form.listingId.trim() || !form.name.trim() || !form.icalUrl.trim()) {
      setErr('All fields required'); return
    }
    setAdding(true); setErr('')
    try {
      const r = await fetch('/api/hostaway/accounts', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(form)
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed') }
      setForm({listingId:'', name:'', icalUrl:''})
      setShowAdd(false)
      onRefresh()
    } catch(e) { setErr(String(e)) }
    setAdding(false)
  }

  async function removeListing(id: string, name: string) {
    if (!confirm(`Remove ${name}? This will not delete synced jobs.`)) return
    await fetch(`/api/hostaway/accounts/${id}`, {method:'DELETE'})
    onRefresh()
  }

  async function syncAll() {
    setSyncing('hostaway'); setSyncMsg(null)
    try {
      const r = await fetch('/api/hostaway/sync', {method:'POST'})
      const d = await r.json()
      const total = Array.isArray(d) ? d.reduce((s:number,x:any)=>s+(x.imported||0),0) : 0
      setSyncMsg(`✓ Hostaway synced — ${total} new job(s)`)
      onJobsRefresh(); onRefresh()
    } catch { setSyncMsg('Hostaway sync error') }
    setSyncing(null)
  }

  async function syncOne(id: string, name: string) {
    setSyncing(`hostaway-${id}`); setSyncMsg(null)
    try {
      const r = await fetch(`/api/hostaway/sync?id=${id}`, {method:'POST'})
      const d = await r.json()
      setSyncMsg(`✓ ${name} synced — ${d.imported||0} new job(s)`)
      onJobsRefresh(); onRefresh()
    } catch { setSyncMsg('Sync error') }
    setSyncing(null)
  }

  const inputStyle = {
    width:'100%', background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:7, padding:'7px 10px', color:'var(--text)',
    fontFamily:'DM Sans,sans-serif', fontSize:12, outline:'none', marginBottom:6
  }

  return(
    <div style={{marginBottom:10}}>
      {/* Listing list */}
      {accounts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
          {accounts.map((acc:any) => (
            <div key={acc.id} style={{background:'var(--surface2)',borderRadius:8,padding:'8px 10px',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{acc.name}</div>
                <div style={{fontSize:10,color:'var(--text-dim)'}}>#{acc.listingId} · Synced {acc.lastSynced ? new Date(acc.lastSynced).toLocaleDateString() : 'never'}</div>
              </div>
              <button onClick={()=>syncOne(acc.id, acc.name)} disabled={!!syncing}
                style={{padding:'3px 8px',fontSize:10,fontWeight:700,borderRadius:5,background:'rgba(251,133,0,0.1)',color:'var(--amber)',border:'1px solid rgba(251,133,0,0.3)',cursor:'pointer',flexShrink:0}}>
                ⟳
              </button>
              <button onClick={()=>removeListing(acc.id, acc.name)}
                style={{padding:'3px 8px',fontSize:10,fontWeight:700,borderRadius:5,background:'var(--red-bg)',color:'var(--red)',border:'1px solid rgba(232,82,90,0.2)',cursor:'pointer',flexShrink:0}}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sync all button */}
      {accounts.length > 0 && (
        <button onClick={syncAll} disabled={!!syncing}
          style={{width:'100%',padding:'7px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',background:'rgba(251,133,0,0.1)',color:'var(--amber)',border:'1px solid rgba(251,133,0,0.3)',fontFamily:'DM Sans,sans-serif',marginBottom:6}}>
          {syncing==='hostaway'?'Syncing...':'⟳ Sync All Listings'}
        </button>
      )}

      {/* Add listing form */}
      {showAdd ? (
        <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 12px',border:'1px solid var(--border)'}}>
          {err && <div style={{fontSize:11,color:'var(--red)',marginBottom:6}}>{err}</div>}
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            placeholder="Listing name (e.g. Listing 1)" style={inputStyle}/>
          <input value={form.listingId} onChange={e=>setForm(p=>({...p,listingId:e.target.value}))}
            placeholder="Listing ID (e.g. 203528)" style={inputStyle}/>
          <input value={form.icalUrl} onChange={e=>setForm(p=>({...p,icalUrl:e.target.value}))}
            placeholder="iCal URL (https://platform.hostaway.com/ical/...)" style={{...inputStyle,marginBottom:8}}/>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>{setShowAdd(false);setErr('')}}
              style={{flex:1,padding:'6px',borderRadius:6,background:'var(--surface3)',color:'var(--text-muted)',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:11,cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={addListing} disabled={adding}
              style={{flex:2,padding:'6px',borderRadius:6,background:'var(--amber)',color:'#000',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',opacity:adding?0.6:1}}>
              {adding?'Adding...':'+ Add Listing'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setShowAdd(true)}
          style={{width:'100%',padding:'8px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif'}}>
          + Add iCal Listing
        </button>
      )}
    </div>
  )
}

function SidebarLabel({children}:{children:React.ReactNode}){return(
  <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8,fontFamily:'Syne,sans-serif'}}>{children}</div>
)}

// Sidebar property groups — grouped by platform with collapsible sections
function SidebarPropGroups({jobs,colorMap,colorRules,hiddenProps,expandedColorProp,setExpandedColorProp,displayName,savePropName,togglePropVisibility,assignColor}:any){
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({})

  const groups = [
    {key:'airbnb',  label:'Airbnb',   dot:'#ff385c'},
    {key:'turno',   label:'Turno',    dot:'#a78bfa'},
    {key:'hostaway',label:'Hostaway', dot:'#fb8500'},
    {key:'jobber',  label:'Jobber — Events',   dot:'#f97316', filter:(j:any)=>j.platform==='jobber'&&!j.customerName},
    {key:'jobber-v',label:'Jobber — Jobs/Visits',dot:'#1d4ed8', filter:(j:any)=>j.platform==='jobber'&&!!j.customerName},
  ]

  function PropItem({p,c}:{p:string,c:string}){
    const isHidden=hiddenProps.has(p),isExp=expandedColorProp===p
    return(
      <div style={{borderRadius:6,border:`1px solid ${isHidden?'var(--border)':c+'30'}`,background:'var(--surface2)',overflow:'hidden',opacity:isHidden?0.5:1}}>
        <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 7px'}}>
          <button onClick={()=>setExpandedColorProp(isExp?null:p)}
            style={{width:10,height:10,borderRadius:2,background:c,border:'none',cursor:'pointer',flexShrink:0}}/>
          <PropNameEditor label={p} value={displayName(p)} onSave={(v:string)=>savePropName(p,v)}/>
          <button onClick={()=>togglePropVisibility(p)}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:10,opacity:0.5,flexShrink:0,color:'var(--text-muted)'}}>
            {isHidden?'○':'●'}
          </button>
        </div>
        {isExp&&(
          <div style={{padding:'4px 7px 6px',borderTop:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:3}}>
            {COLOR_PALETTE.map((col:string)=>(
              <button key={col} onClick={()=>assignColor(p,col)}
                style={{width:14,height:14,borderRadius:2,background:col,border:colorMap[p]===col?'2px solid white':'2px solid transparent',cursor:'pointer'}}/>
            ))}
          </div>
        )}
      </div>
    )
  }

  return(
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {groups.map(g=>{
        const filter = (g as any).filter || ((j:any)=>j.platform===g.key)
        const props=[...new Set(jobs.filter(filter).map((j:any)=>j.propertyLabel))] as string[]
        if(!props.length) return null
        const isCollapsed=collapsed[g.key]
        return(
          <div key={g.key}>
            <button onClick={()=>setCollapsed((p:any)=>({...p,[g.key]:!p[g.key]}))}
              style={{display:'flex',alignItems:'center',gap:6,width:'100%',background:'none',border:'none',cursor:'pointer',padding:'3px 0',marginBottom:isCollapsed?0:4}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:g.dot,flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',flex:1,textAlign:'left',textTransform:'uppercase',letterSpacing:0.8}}>{g.label}</span>
              <span style={{fontSize:9,color:'var(--text-dim)',marginRight:2}}>{props.length}</span>
              <span style={{fontSize:9,color:'var(--text-dim)'}}>{isCollapsed?'▸':'▾'}</span>
            </button>
            {!isCollapsed&&(
              <div style={{display:'flex',flexDirection:'column',gap:3,paddingLeft:4}}>
                {props.map((p:string)=>{
                  const c=colorMap[p]||(colorRules?colorRules.find((r:any)=>p.toLowerCase().includes(r.keyword.toLowerCase()))?.color:null)||DEFAULT_PROP_COLOR
                  return <PropItem key={p} p={p} c={c}/>
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
