'use client'
// app/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react'
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

// ── COLOR PALETTE for property assignment ─────────────────────────────────────
const COLOR_PALETTE = [
  '#0e7490','#0891b2','#06b6d4','#0d9488','#059669','#65a30d',
  '#ca8a04','#ea580c','#dc2626','#e11d48','#9333ea','#7c3aed',
  '#2563eb','#1d4ed8','#0369a1','#047857','#b45309','#c2410c',
]

const PLAT_COLORS: Record<string, {bg:string;text:string;border:string;dot:string}> = {
  airbnb:   {bg:'#fce7eb',text:'#be123c',border:'#fbcfe8',dot:'#e11d48'},
  jobber:   {bg:'#e0f2fe',text:'#0369a1',border:'#bae6fd',dot:'#0891b2'},
  turno:    {bg:'#ede9fe',text:'#6d28d9',border:'#ddd6fe',dot:'#7c3aed'},
  hostaway: {bg:'#fff7ed',text:'#c2410c',border:'#fed7aa',dot:'#ea580c'},
}

const PROPERTY_SHORT_NAMES: Record<string,string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star Lodge\nTop Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star Lodge\nEntire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function shortName(label: string) {
  if (PROPERTY_SHORT_NAMES[label]) return PROPERTY_SHORT_NAMES[label]
  return label.split('|')[0].split('•')[0].trim()
}

// Per-property color storage (persisted to localStorage)
function loadColorMap(): Record<string,string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('propColors') || '{}') } catch { return {} }
}
function saveColorMap(map: Record<string,string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem('propColors', JSON.stringify(map))
}

let _colorMap: Record<string,string> = {}
let _colorIdx = 0
function getPropColor(label: string, colorMap: Record<string,string>): string {
  if (colorMap[label]) return colorMap[label]
  const color = COLOR_PALETTE[_colorIdx++ % COLOR_PALETTE.length]
  return color
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(d: string|null) { return d ? new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—' }
function fmtD(d: string|null) { return d ? new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '—' }
function fmtRel(d: string|null) {
  if (!d) return 'Never'
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if (m<1) return 'Just now'; if (m<60) return `${m}m ago`
  const h=Math.floor(m/60); if (h<24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}
function jobCleanerIds(j: Job): string[] { try { return JSON.parse(j.cleanerIds) } catch { return [] } }
function jobDuties(j: Job): string[] { try { return JSON.parse(j.duties) } catch { return [] } }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function getWeekStart(d: Date) { const r=new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r }
const MAX_VISIBLE = 2

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [view, setView] = useState<'day'|'week'|'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activePlatforms, setActivePlatforms] = useState(new Set(['airbnb','jobber','turno','hostaway']))
  const [selectedJob, setSelectedJob] = useState<Job|null>(null)
  const [showGmailPanel, setShowGmailPanel] = useState(false)
  const [showColorPanel, setShowColorPanel] = useState(false)
  const [syncing, setSyncing] = useState<string|null>(null)
  const [syncMsg, setSyncMsg] = useState<string|null>(null)
  const [dutyChecks, setDutyChecks] = useState<Record<number,boolean>>({})
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [expandedDays, setExpandedDays] = useState<Record<string,boolean>>({})
  const [colorMap, setColorMap] = useState<Record<string,string>>({})
  const today = new Date()
  const HS=7, HE=21, HOURS=HE-HS

  useEffect(() => {
    setColorMap(loadColorMap())
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) { setSyncMsg(`✓ Connected ${connected}`); window.history.replaceState({},'','/dashboard'); loadGmailAccounts(); setTimeout(()=>syncAll(),1000) }
    if (error) { setSyncMsg(`Error: ${error.replace(/_/g,' ')}`); window.history.replaceState({},'','/dashboard') }
  }, [])

  const loadJobs = useCallback(async () => { const r=await fetch('/api/jobs'); if(r.ok) setJobs(await r.json()) }, [])
  const loadCleaners = useCallback(async () => { const r=await fetch('/api/cleaners'); if(r.ok) setCleaners(await r.json()) }, [])
  const loadGmailAccounts = useCallback(async () => { const r=await fetch('/api/gmail/accounts'); if(r.ok) setGmailAccounts(await r.json()) }, [])

  useEffect(() => { loadJobs(); loadCleaners(); loadGmailAccounts() }, [loadJobs,loadCleaners,loadGmailAccounts])
  useEffect(() => { const t=setInterval(()=>syncAll(),24*60*60*1000); return ()=>clearInterval(t) }, [])

  function assignColor(label: string, color: string) {
    const next = { ...colorMap, [label]: color }
    setColorMap(next); saveColorMap(next)
  }

  async function connectGmail() { const r=await fetch('/api/gmail/accounts',{method:'POST'}); const {url}=await r.json(); window.location.href=url }
  async function disconnectGmail(id: string) { await fetch(`/api/gmail/accounts/${id}`,{method:'DELETE'}); loadGmailAccounts() }
  async function syncAccount(id: string, email: string) {
    setSyncing(id); setSyncMsg(null)
    try { const r=await fetch(`/api/gmail/sync?id=${id}`,{method:'POST'}); const d=await r.json(); setSyncMsg(`✓ Synced ${email} — ${d.imported} new job(s)`); loadJobs(); loadGmailAccounts() }
    catch { setSyncMsg(`Error syncing ${email}`) }
    setSyncing(null)
  }
  async function syncAll() {
    setSyncing('all'); setSyncMsg(null)
    try { const r=await fetch('/api/gmail/sync',{method:'POST'}); const d=await r.json(); const total=Array.isArray(d)?d.reduce((s:number,x:any)=>s+(x.imported||0),0):0; setSyncMsg(total>0?`✓ ${total} new job(s) synced`:'✓ All up to date'); loadJobs(); loadGmailAccounts() }
    catch { setSyncMsg('Sync error') }
    setSyncing(null); setTimeout(()=>setSyncMsg(null),5000)
  }
  async function updateJob(id: string, data: Partial<Job>) {
    await fetch(`/api/jobs/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    loadJobs(); if(selectedJob?.id===id) setSelectedJob(prev=>prev?{...prev,...data}:null)
  }
  async function deleteJob(id: string) { await fetch(`/api/jobs/${id}`,{method:'DELETE'}); setSelectedJob(null); loadJobs() }
  async function handleLogout() { await fetch('/api/auth/login',{method:'DELETE'}); router.push('/login') }

  const visibleJobs = jobs.filter(j=>activePlatforms.has(j.platform))
  function jobsOnDay(date: Date) { return visibleJobs.filter(j=>sameDay(new Date(j.checkoutTime),date)) }
  function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

  function navigate(dir: number) {
    setCurrentDate(prev=>{
      const d=new Date(prev)
      if(view==='month') return new Date(d.getFullYear(),d.getMonth()+dir,1)
      if(view==='week'){d.setDate(d.getDate()+dir*7);return d}
      d.setDate(d.getDate()+dir);return d
    })
  }

  function periodLabel() {
    if(view==='month') return currentDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})
    if(view==='week'){const ws=getWeekStart(currentDate),we=new Date(ws);we.setDate(we.getDate()+6);return `${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
    return currentDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})
  }

  function jobColor(j: Job) { return colorMap[j.propertyLabel] || getPropColor(j.propertyLabel, colorMap) }

  // ── MONTH VIEW ───────────────────────────────────────────────────────────────
  function MonthView() {
    const yr=currentDate.getFullYear(),mo=currentDate.getMonth()
    const first=new Date(yr,mo,1),last=new Date(yr,mo+1,0),dow=first.getDay(),ts=today.toDateString()
    const days: React.ReactElement[] = []

    for(let i=0;i<dow;i++){
      const d=new Date(yr,mo,-dow+i+1)
      days.push(<div key={`pre-${i}`} style={{height:130,background:'var(--surface)',opacity:0.5,padding:'6px 7px'}}><div style={{fontSize:11,color:'var(--text-dim)',width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center'}}>{d.getDate()}</div></div>)
    }

    for(let day=1;day<=last.getDate();day++){
      const cd=new Date(yr,mo,day),isT=cd.toDateString()===ts,dk=dayKey(cd),isExp=!!expandedDays[dk]
      const dayJobs=jobsOnDay(cd),showAll=isExp||dayJobs.length<=MAX_VISIBLE
      const visible=showAll?dayJobs:dayJobs.slice(0,MAX_VISIBLE),hidden=showAll?0:dayJobs.length-MAX_VISIBLE

      days.push(
        <div key={day} style={{
          height:isExp?'auto':130,minHeight:130,
          background:isT?'#e8f7fb':'var(--surface)',
          padding:'6px 7px',display:'flex',flexDirection:'column',
          boxShadow:isT?'inset 0 0 0 1.5px var(--cyan-mid)':undefined,
          position:isExp?'relative':undefined,zIndex:isExp?10:undefined,
          transition:'background 0.1s',cursor:'default'
        }}>
          <div style={{
            fontSize:11,fontWeight:600,width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',
            borderRadius:'50%',marginBottom:4,flexShrink:0,
            background:isT?'var(--cyan-dark)':'transparent',
            color:isT?'#fff':'var(--text-muted)'
          }}>{day}</div>
          <div style={{display:'flex',flexDirection:'column',gap:2,flex:1,overflow:'hidden'}}>
            {visible.map(j=>{
              const c=jobColor(j),name=shortName(j.propertyLabel)
              return(
                <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                  style={{padding:'2px 6px 3px',borderRadius:5,cursor:'pointer',fontSize:10,fontWeight:500,
                    background:`${c}18`,color:c,border:`1px solid ${c}30`,flexShrink:0,lineHeight:1.3,
                    display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',wordBreak:'break-word'
                  } as React.CSSProperties}>
                  <span style={{fontSize:9,opacity:0.7,marginRight:3}}>{fmt(j.checkoutTime)}</span>{name}
                </div>
              )
            })}
            {!showAll&&hidden>0&&(
              <button onClick={e=>{e.stopPropagation();setExpandedDays(p=>({...p,[dk]:true}))}}
                style={{marginTop:2,padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer',
                  background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',flexShrink:0}}>
                ▾ {hidden} more
              </button>
            )}
            {isExp&&dayJobs.length>MAX_VISIBLE&&(
              <button onClick={e=>{e.stopPropagation();setExpandedDays(p=>({...p,[dk]:false}))}}
                style={{marginTop:2,padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer',
                  background:'var(--cyan-pale)',color:'var(--cyan-dark)',border:'1px solid var(--border)',flexShrink:0}}>
                ▴ show less
              </button>
            )}
          </div>
        </div>
      )
    }

    const tr=(dow+last.getDate())%7
    if(tr) for(let i=1;i<=7-tr;i++) days.push(<div key={`post-${i}`} style={{height:130,background:'var(--surface)',opacity:0.5,padding:'6px 7px'}}><div style={{fontSize:11,color:'var(--text-dim)',width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center'}}>{i}</div></div>)

    return(
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'var(--border)',borderRadius:14,overflow:'visible',boxShadow:'var(--shadow-sm)'}}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
          <div key={d} style={{background:'var(--surface2)',padding:'8px 0',textAlign:'center',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:1,color:'var(--text-dim)'}}>{d}</div>
        ))}
        {days}
      </div>
    )
  }

  // ── WEEK VIEW ────────────────────────────────────────────────────────────────
  function WeekView() {
    const ws=getWeekStart(currentDate),ts=today.toDateString()
    return(
      <div style={{display:'grid',gridTemplateColumns:'54px repeat(7,1fr)',borderRadius:14,overflow:'hidden',border:'1px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
        <div style={{background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}/>
        {Array.from({length:7},(_,i)=>{const d=new Date(ws);d.setDate(ws.getDate()+i);const iT=d.toDateString()===ts;return(
          <div key={i} style={{background:'var(--surface2)',padding:'8px 6px',textAlign:'center',borderBottom:'1px solid var(--border)',borderLeft:'1px solid var(--border)'}}>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1,color:'var(--text-dim)',fontWeight:600}}>{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:20,color:iT?'var(--cyan-dark)':'var(--text)',lineHeight:1.1}}>{d.getDate()}</div>
          </div>
        )})}
        <div style={{background:'var(--surface)',borderRight:'1px solid var(--border)'}}>
          {Array.from({length:HOURS},(_,h)=>{const hr=HS+h;const l=hr===12?'12 PM':hr<12?`${hr} AM`:`${hr-12} PM`;return<div key={h} style={{height:56,display:'flex',alignItems:'flex-start',padding:'3px 6px 0',fontSize:9,color:'var(--text-dim)',borderTop:'1px solid var(--border-light)'}}>{l}</div>})}
        </div>
        {Array.from({length:7},(_,i)=>{
          const d=new Date(ws);d.setDate(ws.getDate()+i);const dayJobs=jobsOnDay(d)
          return(
            <div key={i} style={{position:'relative',borderLeft:'1px solid var(--border)',background:'var(--surface)',minHeight:HOURS*56}}>
              {Array.from({length:HOURS},(_,h)=><div key={h} style={{position:'absolute',left:0,right:0,top:h*56,borderTop:'1px solid var(--border-light)',height:56}}/>)}
              {dayJobs.map(j=>{
                const co=new Date(j.checkoutTime),ci=j.checkinTime?new Date(j.checkinTime):new Date(co.getTime()+3*3600000)
                const top=Math.max(0,(co.getHours()+co.getMinutes()/60-HS)*56),ht=Math.max(32,((ci.getTime()-co.getTime())/3600000)*56)
                const c=jobColor(j),cl=cleaners.find(x=>jobCleanerIds(j).includes(x.id))
                return(
                  <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                    style={{position:'absolute',left:3,right:3,top,height:ht,borderRadius:6,padding:'4px 7px',cursor:'pointer',
                      background:`${c}18`,color:c,border:`1px solid ${c}30`,overflow:'hidden',zIndex:2,transition:'filter 0.1s'}}
                    onMouseEnter={e=>(e.currentTarget.style.filter='brightness(0.9)')}
                    onMouseLeave={e=>(e.currentTarget.style.filter='')}>
                    <div style={{fontWeight:600,fontSize:11,whiteSpace:'pre-line',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'} as React.CSSProperties}>{shortName(j.propertyLabel)}</div>
                    <div style={{fontSize:9,opacity:0.8}}>{fmt(j.checkoutTime)}{j.checkinTime?` – ${fmt(j.checkinTime)}`:''}</div>
                    {cl&&<div style={{fontSize:9,opacity:0.65}}>{cl.name}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // ── DAY VIEW ─────────────────────────────────────────────────────────────────
  function DayView() {
    const dayJobs=jobsOnDay(currentDate)
    return(
      <>
        <div style={{textAlign:'center',marginBottom:16}}>
          <h2 style={{fontFamily:'Fraunces,serif',fontSize:26,fontWeight:400,color:'var(--text)'}}>{currentDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'54px 1fr',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
          <div style={{background:'var(--surface2)',borderRight:'1px solid var(--border)'}}>
            {Array.from({length:HOURS},(_,h)=>{const hr=HS+h;const l=hr===12?'12 PM':hr<12?`${hr} AM`:`${hr-12} PM`;return<div key={h} style={{height:56,display:'flex',alignItems:'flex-start',padding:'3px 6px 0',fontSize:9,color:'var(--text-dim)',borderTop:'1px solid var(--border-light)'}}>{l}</div>})}
          </div>
          <div style={{position:'relative',background:'var(--surface)',minHeight:HOURS*56}}>
            {Array.from({length:HOURS},(_,h)=><div key={h} style={{position:'absolute',left:0,right:0,top:h*56,borderTop:'1px solid var(--border-light)',height:56}}/>)}
            {dayJobs.map(j=>{
              const co=new Date(j.checkoutTime),ci=j.checkinTime?new Date(j.checkinTime):new Date(co.getTime()+3*3600000)
              const top=Math.max(0,(co.getHours()+co.getMinutes()/60-HS)*56),ht=Math.max(44,((ci.getTime()-co.getTime())/3600000)*56)
              const c=jobColor(j),cl=cleaners.find(x=>jobCleanerIds(j).includes(x.id))
              return(
                <div key={j.id} onClick={()=>{setSelectedJob(j);setDutyChecks({})}}
                  style={{position:'absolute',left:10,right:10,top,height:ht,borderRadius:8,padding:'8px 12px',cursor:'pointer',
                    background:`${c}18`,color:c,borderLeft:`3px solid ${c}`,zIndex:2}}>
                  <div style={{fontWeight:600,fontSize:14,whiteSpace:'pre-line'}}>{shortName(j.propertyLabel)}</div>
                  <div style={{fontSize:11,opacity:0.7,marginTop:1}}>{j.address}</div>
                  <div style={{fontSize:11,opacity:0.75,marginTop:2}}>{fmt(j.checkoutTime)}{j.checkinTime?` → ${fmt(j.checkinTime)}`:''}</div>
                  {cl&&<div style={{fontSize:11,opacity:0.6}}>👤 {cl.name}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── JOB MODAL ────────────────────────────────────────────────────────────────
  function JobModal() {
    if(!selectedJob) return null
    const j=selectedJob,c=jobColor(j),duties=jobDuties(j)
    const assigned=jobCleanerIds(j).map(id=>cleaners.find(cl=>cl.id===id)).filter(Boolean) as Cleaner[]
    const platLabel=j.platform.charAt(0).toUpperCase()+j.platform.slice(1)
    const pc=PLAT_COLORS[j.platform]||PLAT_COLORS.turno
    const name=shortName(j.propertyLabel)

    return(
      <div style={{position:'fixed',inset:0,background:'rgba(10,40,50,0.4)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelectedJob(null)}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,width:'100%',maxWidth:540,maxHeight:'88vh',overflowY:'auto',boxShadow:'var(--shadow-lg)'}} onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div style={{padding:'18px 22px 14px',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--surface)',borderRadius:'18px 18px 0 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,paddingRight:12}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 10px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:6,background:pc.bg,color:pc.text,border:`1px solid ${pc.border}`}}>{platLabel}</span>
              {editingLabel?(
                <input autoFocus defaultValue={name.replace(/\n/g,' ')} onChange={e=>setLabelDraft(e.target.value)}
                  onBlur={async()=>{if(labelDraft.trim())await updateJob(j.id,{displayName:labelDraft.trim()});setEditingLabel(false)}}
                  onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}
                  style={{display:'block',width:'100%',background:'var(--surface2)',border:`1.5px solid ${c}`,borderRadius:8,padding:'4px 8px',fontFamily:'Fraunces,serif',fontSize:20,color:'var(--text)',outline:'none'}}/>
              ):(
                <div style={{fontFamily:'Fraunces,serif',fontSize:20,lineHeight:1.2,color:'var(--text)',cursor:'pointer',whiteSpace:'pre-line'}}
                  onDoubleClick={()=>{setEditingLabel(true);setLabelDraft(name.replace(/\n/g,' '))}}>
                  {name} <span style={{fontSize:11,opacity:0.3,fontFamily:'DM Sans,sans-serif'}}>✎</span>
                </div>
              )}
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{j.customerName} · {j.address}</div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>setShowColorPanel(true)} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}} title="Change color">🎨</button>
              <button onClick={()=>{if(confirm('Delete this job?'))deleteJob(j.id)}} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'var(--text-muted)'}}>🗑</button>
              <button onClick={()=>setSelectedJob(null)} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--text-muted)'}}>✕</button>
            </div>
          </div>

          <div style={{padding:'18px 22px'}}>
            {/* Schedule */}
            <Section title="Schedule">
              <div style={{background:'var(--surface2)',borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',border:'1px solid var(--border-light)'}}>
                <TBI label="Checkout / Start" value={fmt(j.checkoutTime)} sub={fmtD(j.checkoutTime)}/>
                <div style={{color:'var(--text-dim)',fontSize:16,padding:'0 10px'}}>→</div>
                <TBI label={j.platform==='jobber'?'End Time':'Next Check-in'} value={j.checkinTime?fmt(j.checkinTime):'—'} sub={j.checkinTime?fmtD(j.checkinTime):'Not set'}/>
              </div>
            </Section>

            {/* Next guests */}
            {j.nextGuests&&(
              <Section title="Next Guests">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <IC label="Guest Name" value={j.nextGuests}/>
                  <IC label="Guest Count" value={String(j.nextGuestCount??'—')} large/>
                </div>
              </Section>
            )}

            {/* Property details */}
            {(j.sqft||j.beds)&&(
              <Section title="Property Details">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {j.sqft&&<IC label="Sq Ft" value={j.sqft.toLocaleString()} large/>}
                  {j.beds&&<IC label="Beds / Baths" value={`${j.beds}bd / ${j.baths}ba`} large/>}
                  {j.worth&&<div style={{gridColumn:'1/-1',background:'var(--surface2)',borderRadius:9,padding:'10px 12px',border:'1px solid var(--border-light)'}}>
                    <div style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:3}}>Job Value</div>
                    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:7,padding:'3px 10px',fontSize:13,fontWeight:600}}>💵 ${j.worth}</span>
                  </div>}
                </div>
              </Section>
            )}

            {/* Duties */}
            {duties.length>0&&(
              <Section title="Duties / Line Items">
                <div style={{background:'var(--surface2)',borderRadius:10,overflow:'hidden',border:'1px solid var(--border-light)'}}>
                  {duties.map((d,i)=>(
                    <div key={i} onClick={()=>setDutyChecks(p=>({...p,[i]:!p[i]}))}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<duties.length-1?'1px solid var(--border-light)':'none',fontSize:12,cursor:'pointer',background:dutyChecks[i]?'var(--surface3)':'transparent'}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${dutyChecks[i]?'var(--cyan-dark)':'var(--border)'}`,background:dutyChecks[i]?'var(--cyan-dark)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'white',flexShrink:0,transition:'all 0.1s'}}>
                        {dutyChecks[i]&&'✓'}
                      </div>
                      <span style={{textDecoration:dutyChecks[i]?'line-through':'none',color:dutyChecks[i]?'var(--text-dim)':'var(--text)'}}>{d}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Color */}
            <Section title="Property Color">
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                {COLOR_PALETTE.map(col=>(
                  <button key={col} onClick={()=>assignColor(j.propertyLabel,col)}
                    style={{width:24,height:24,borderRadius:6,background:col,border:colorMap[j.propertyLabel]===col?`3px solid var(--text)`:'2px solid transparent',cursor:'pointer',transition:'transform 0.1s'}}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.2)')}
                    onMouseLeave={e=>(e.currentTarget.style.transform='')}/>
                ))}
              </div>
            </Section>

            {/* Cleaners */}
            <Section title="Assigned Cleaners">
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                {assigned.map(cl=>(
                  <span key={cl.id} style={{background:`${cl.color}18`,color:cl.color,border:`1px solid ${cl.color}30`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:500,display:'inline-flex',alignItems:'center',gap:5}}>
                    {cl.name}
                    <span onClick={async()=>{const ids=jobCleanerIds(j).filter(id=>id!==cl.id);await updateJob(j.id,{cleanerIds:JSON.stringify(ids)})}} style={{cursor:'pointer',opacity:0.5,fontSize:11}}>✕</span>
                  </span>
                ))}
                {assigned.length===0&&<span style={{fontSize:12,color:'var(--text-dim)'}}>No cleaners assigned</span>}
              </div>
              <select defaultValue="" onChange={async e=>{const id=e.target.value;if(!id)return;const ids=[...jobCleanerIds(j),id];await updateJob(j.id,{cleanerIds:JSON.stringify(ids)});e.target.value=''}}
                style={{background:'var(--surface2)',border:'1.5px solid var(--border)',borderRadius:8,padding:'8px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:12,cursor:'pointer',outline:'none',width:'100%'}}>
                <option value="">Add cleaner...</option>
                {cleaners.filter(cl=>!jobCleanerIds(j).includes(cl.id)).map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
            </Section>

            {/* Notes */}
            <Section title="Notes">
              <textarea defaultValue={j.notes||''} onBlur={e=>updateJob(j.id,{notes:e.target.value})} placeholder="Add notes..."
                style={{width:'100%',background:'var(--surface2)',border:'1.5px solid var(--border)',borderRadius:8,padding:'10px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:12,resize:'vertical',minHeight:65,outline:'none'}}
                onFocus={e=>(e.target.style.borderColor='var(--cyan-dark)')} onBlurCapture={e=>(e.target.style.borderColor='var(--border)')}/>
            </Section>
          </div>
        </div>
      </div>
    )
  }

  // ── GMAIL PANEL ──────────────────────────────────────────────────────────────
  function GmailPanel() {
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(10,40,50,0.4)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowGmailPanel(false)}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,width:'100%',maxWidth:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'var(--shadow-lg)'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <h2 style={{fontFamily:'Fraunces,serif',fontSize:20,fontWeight:400,color:'var(--text)'}}>Gmail Accounts</h2>
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>Connected inboxes that auto-sync Turno job emails</p>
            </div>
            <button onClick={()=>setShowGmailPanel(false)} style={{width:28,height:28,border:'1px solid var(--border)',borderRadius:8,background:'var(--surface2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--text-muted)'}}>✕</button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {syncMsg&&<div style={{padding:'10px 14px',borderRadius:8,fontSize:12,background:syncMsg.startsWith('✓')?'#f0fdf4':'#fef2f2',color:syncMsg.startsWith('✓')?'#166534':'#dc2626',border:`1px solid ${syncMsg.startsWith('✓')?'#bbf7d0':'#fecaca'}`}}>{syncMsg}</div>}
            {gmailAccounts.length===0&&<div style={{background:'var(--surface2)',borderRadius:10,padding:16,textAlign:'center',fontSize:13,color:'var(--text-dim)'}}>No Gmail accounts connected yet.</div>}
            {gmailAccounts.map(acc=>(
              <div key={acc.id} style={{background:'var(--surface2)',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,border:'1px solid var(--border-light)'}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{acc.email}</div>
                  <div style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>Last synced: {fmtRel(acc.lastSynced)}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>syncAccount(acc.id,acc.email)} disabled={syncing===acc.id||syncing==='all'}
                    style={{padding:'6px 12px',fontSize:11,fontWeight:600,borderRadius:7,background:'var(--cyan-pale)',color:'var(--cyan-dark)',border:'1px solid #b2e9f5',cursor:'pointer',opacity:syncing===acc.id?0.5:1}}>
                    {syncing===acc.id?'Syncing...':'⟳ Sync'}
                  </button>
                  <button onClick={()=>{if(confirm(`Disconnect ${acc.email}?`))disconnectGmail(acc.id)}}
                    style={{padding:'6px 12px',fontSize:11,fontWeight:600,borderRadius:7,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',cursor:'pointer'}}>
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
            <button onClick={connectGmail}
              style={{width:'100%',padding:'11px',borderRadius:10,background:'var(--cyan-dark)',color:'white',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              + Connect Gmail Account
            </button>
            {gmailAccounts.length>1&&(
              <button onClick={()=>syncAll()} disabled={syncing==='all'}
                style={{width:'100%',padding:'9px',borderRadius:10,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                {syncing==='all'?'Syncing all...':'⟳ Sync All Accounts'}
              </button>
            )}
            <div style={{background:'var(--cyan-bg)',borderRadius:10,padding:'12px 14px',fontSize:11,color:'var(--text-muted)',lineHeight:1.6,border:'1px solid #cef0f7'}}>
              <strong style={{color:'var(--cyan-dark)'}}>Auto-sync:</strong> CleanSync checks these inboxes daily at 8am Alaska time for new Turno job emails and adds them to your calendar automatically.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── HELPER COMPONENTS ────────────────────────────────────────────────────────
  function Section({title,children}:{title:string;children:React.ReactNode}) {
    return(
      <div style={{marginBottom:18}}>
        <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8}}>{title}</div>
        {children}
      </div>
    )
  }
  function TBI({label,value,sub}:{label:string;value:string;sub:string}) {
    return(
      <div style={{flex:1}}>
        <div style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:2}}>{label}</div>
        <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{value}</div>
        <div style={{fontSize:10,color:'var(--text-muted)'}}>{sub}</div>
      </div>
    )
  }
  function IC({label,value,large}:{label:string;value:string;large?:boolean}) {
    return(
      <div style={{background:'var(--surface2)',borderRadius:9,padding:'10px 12px',border:'1px solid var(--border-light)'}}>
        <div style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:3}}>{label}</div>
        <div style={{fontSize:large?18:13,fontWeight:large?400:500,fontFamily:large?'Fraunces,serif':'DM Sans,sans-serif',color:'var(--text)'}}>{value}</div>
      </div>
    )
  }

  // ── SIDEBAR ──────────────────────────────────────────────────────────────────
  const propNames=[...new Set(Array.from(visibleJobs.map(j=>j.propertyLabel)))].sort()
  const allPlatforms=['airbnb','jobber','turno','hostaway']

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg)'}}>
      {/* HEADER */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',borderBottom:'1px solid var(--border)',background:'var(--surface)',boxShadow:'var(--shadow-sm)',position:'sticky',top:0,zIndex:40,gap:12,flexWrap:'wrap'}}>
        <div style={{fontFamily:'Fraunces,serif',fontSize:20,fontWeight:400,color:'var(--cyan-dark)',letterSpacing:'-0.3px'}}>
          CleanSync <span style={{fontSize:14,color:'var(--text-dim)',fontStyle:'italic'}}>pro</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>navigate(-1)} style={{width:32,height:32,border:'1px solid var(--border)',borderRadius:7,background:'var(--surface2)',color:'var(--text)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <span style={{fontFamily:'Fraunces,serif',fontSize:15,minWidth:160,textAlign:'center',color:'var(--text)'}}>{periodLabel()}</span>
          <button onClick={()=>navigate(1)} style={{width:32,height:32,border:'1px solid var(--border)',borderRadius:7,background:'var(--surface2)',color:'var(--text)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
          <div style={{display:'flex',background:'var(--surface2)',borderRadius:8,padding:3,gap:2,border:'1px solid var(--border)'}}>
            {(['day','month','week'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:view===v?'white':'transparent',color:view===v?'var(--cyan-dark)':'var(--text-muted)',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:view===v?600:400,cursor:'pointer',boxShadow:view===v?'var(--shadow-sm)':'none',transition:'all 0.15s',textTransform:'capitalize'}}>{v}</button>
            ))}
          </div>
          <button onClick={()=>setShowGmailPanel(true)} style={{padding:'6px 12px',borderRadius:8,background:'var(--cyan-pale)',color:'var(--cyan-dark)',border:'1px solid #b2e9f5',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            ✉ Gmail {gmailAccounts.length>0&&<span style={{background:'var(--cyan-dark)',color:'white',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{gmailAccounts.length}</span>}
          </button>
          <button onClick={handleLogout} style={{padding:'6px 12px',borderRadius:8,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:12,cursor:'pointer'}}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* SIDEBAR */}
        <aside style={{width:210,minWidth:210,background:'var(--surface)',borderRight:'1px solid var(--border)',padding:'16px 13px',overflowY:'auto',display:'flex',flexDirection:'column',gap:20}}>
          {/* Sync status */}
          {gmailAccounts.length>0&&(
            <div>
              <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8}}>Auto-Sync</div>
              <div style={{background:'var(--cyan-bg)',borderRadius:8,padding:'10px 12px',fontSize:10,border:'1px solid #cef0f7'}}>
                {gmailAccounts.map(acc=>(
                  <div key={acc.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:4,marginBottom:4}}>
                    <span style={{color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{acc.email.split('@')[0]}</span>
                    <span style={{color:'var(--text-dim)',flexShrink:0}}>{fmtRel(acc.lastSynced)}</span>
                  </div>
                ))}
                <button onClick={()=>syncAll()} disabled={syncing==='all'}
                  style={{width:'100%',marginTop:6,padding:'4px 0',borderRadius:6,background:'var(--cyan-dark)',color:'white',border:'none',fontFamily:'DM Sans,sans-serif',fontSize:10,fontWeight:600,cursor:'pointer',opacity:syncing==='all'?0.5:1}}>
                  {syncing==='all'?'Syncing...':'⟳ Sync Now'}
                </button>
              </div>
            </div>
          )}

          {/* Platforms */}
          <div>
            <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8}}>Platforms</div>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              {allPlatforms.map(p=>{const pc=PLAT_COLORS[p],active=activePlatforms.has(p);return(
                <div key={p} onClick={()=>setActivePlatforms(prev=>{const n=new Set(prev);n.has(p)?n.delete(p):n.add(p);return n})}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'6px 8px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:500,background:active?'var(--surface2)':'transparent',opacity:active?1:0.4,transition:'all 0.1s'}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:pc.dot,flexShrink:0}}/>
                  <span style={{textTransform:'capitalize',color:'var(--text)'}}>{p}</span>
                  {active&&<span style={{marginLeft:'auto',fontSize:10,color:'var(--cyan-dark)'}}>✓</span>}
                </div>
              )})}
            </div>
          </div>

          {/* Cleaners */}
          <div>
            <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8}}>Cleaners</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {cleaners.map(cl=>(
                <div key={cl.id} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 5px',fontSize:11,color:'var(--text-muted)'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:cl.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>
                    {cl.name.split(' ').map((w:string)=>w[0]).join('')}
                  </div>
                  {cl.name}
                </div>
              ))}
            </div>
          </div>

          {/* Properties */}
          {propNames.length>0&&(
            <div>
              <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:1.5,color:'var(--text-dim)',marginBottom:8}}>Properties</div>
              <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:260,overflowY:'auto'}}>
                {propNames.map(p=>(
                  <div key={p} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:11,color:'var(--text-muted)'}}>
                    <div style={{width:10,height:10,borderRadius:3,background:colorMap[p]||getPropColor(p,colorMap),flexShrink:0,marginTop:1}}/>
                    <span style={{lineHeight:1.3}}>{shortName(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main style={{flex:1,overflowY:'auto',padding:20}}>
          {view==='month'&&<MonthView/>}
          {view==='week'&&<WeekView/>}
          {view==='day'&&<DayView/>}
        </main>
      </div>

      {selectedJob&&<JobModal/>}
      {showGmailPanel&&<GmailPanel/>}
    </div>
  )
}
