'use client'
// app/dashboard/cleaner/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string }
interface Quote {
  id: string; clientId: string; status: string; submissionType: string
  serviceType: string; frequency: string; address: string
  totalPrice: number; subtotal: number; discount: number
  discountLabel: string; instantBookSavings: number | null
  priceBreakdown: string; addonsList: string; additionalNotes: string
  keyAreas: string; preferredDate1: string | null; preferredDate2: string | null
  preferredTimes: string; sqftRange: string | null; bedrooms: number | null
  bathrooms: number | null; airbnbSqft: string | null; airbnbBeds: number | null
  airbnbUnits: string | null; notes: string | null; createdAt: string
  client: QuoteClient
}
interface QuoteClient {
  id: string; firstName: string; lastName: string; email: string
  phone: string; address: string; city: string; state: string; zip: string
  createdAt: string; quotes?: Quote[]
}
interface Job {
  id: string; displayName: string; propertyLabel: string
  checkoutTime: string; platform: string; checkinTime: string | null
}

type Page = 'dashboard' | 'quotes' | 'clients' | 'calendar' | 'integrations' | 'settings'

// ── COLOR THEME ─────────────────────────────────────────────────────────────
const D = {
  bg:      '#020c1f',
  nav:     'rgba(2,8,20,0.98)',
  card:    'rgba(5,30,80,0.5)',
  surf:    'rgba(255,255,255,0.05)',
  border:  'rgba(93,235,241,0.18)',
  borderB: 'rgba(93,235,241,0.35)',
  text:    '#ffffff',
  muted:   'rgba(255,255,255,0.65)',
  dim:     'rgba(255,255,255,0.35)',
  cyan:    '#5debf1',
  cyanD:   '#06b6d4',
  cyanBg:  'rgba(93,235,241,0.1)',
  green:   '#10b981',
  greenBg: 'rgba(16,185,129,0.12)',
  amber:   '#f59e0b',
  amberBg: 'rgba(245,158,11,0.1)',
  red:     '#ef4444',
  redBg:   'rgba(239,68,68,0.1)',
  violet:  '#a78bfa',
}
const L = {
  bg:      '#f0f9ff',
  nav:     '#0c4a6e',
  card:    '#ffffff',
  surf:    '#ffffff',
  border:  'rgba(14,165,233,0.2)',
  borderB: 'rgba(14,165,233,0.4)',
  text:    '#0c4a6e',
  muted:   '#0369a1',
  dim:     '#7dd3fc',
  cyan:    '#0284c7',
  cyanD:   '#0369a1',
  cyanBg:  'rgba(14,165,233,0.08)',
  green:   '#059669',
  greenBg: 'rgba(5,150,105,0.1)',
  amber:   '#d97706',
  amberBg: 'rgba(217,119,6,0.1)',
  red:     '#dc2626',
  redBg:   'rgba(220,38,38,0.08)',
  violet:  '#7c3aed',
}

const STATUS: Record<string,{label:string;color:string}> = {
  pending:   {label:'Pending',   color:'#f59e0b'},
  reviewed:  {label:'Reviewed',  color:'#5debf1'},
  booked:    {label:'Booked',    color:'#10b981'},
  completed: {label:'Completed', color:'#a78bfa'},
  cancelled: {label:'Cancelled', color:'#ef4444'},
}

function fmtDate(d:string|null){
  if(!d)return'—'
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
}
function fmtTime(d:string){return new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function fmtRel(d:string|null){
  if(!d)return'Never'
  const m=Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1)return'Just now';if(m<60)return`${m}m ago`
  const h=Math.floor(m/60);return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`
}
function fmtMoney(n:number){return`$${n.toFixed(2)}`}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}

export default function CleanerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User|null>(null)
  const [dark, setDark] = useState(true)
  const [page, setPage] = useState<Page>('dashboard')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<QuoteClient[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote|null>(null)

  const T = dark ? D : L

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      if(!d.user){router.push('/login');return}
      if(d.user.role==='provider'){router.replace('/dashboard/provider');return}
      setUser(d.user)
    })
  },[router])

  const load = useCallback(async()=>{
    const [qr,cr,jr]=await Promise.all([fetch('/api/quotes'),fetch('/api/quote-clients'),fetch('/api/jobs')])
    const [q,c,j]=await Promise.all([qr.json(),cr.json(),jr.json()])
    setQuotes(Array.isArray(q)?q:[])
    setClients(Array.isArray(c)?c:[])
    setJobs(Array.isArray(j)?j:[])
    setLoading(false)
  },[])

  useEffect(()=>{if(user)load()},[user,load])

  async function updateStatus(id:string,status:string){
    await fetch(`/api/quotes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    load()
    setSelectedQuote(prev=>prev?.id===id?{...prev,status}:prev)
  }

  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}

  if(!user||loading) return(
    <div style={{minHeight:'100vh',background:'#020c1f',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:'3px solid rgba(93,235,241,0.2)',borderTopColor:'#5debf1',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <div style={{color:'rgba(93,235,241,0.6)',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:600,letterSpacing:1}}>Loading CleanSync</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const pending  = quotes.filter(q=>q.status==='pending')
  const booked   = quotes.filter(q=>q.status==='booked')
  const upcoming = jobs.filter(j=>new Date(j.checkoutTime)>=new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())

  // Shared styles
  const card = {background:T.card,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:dark?'0 8px 30px rgba(0,0,0,0.4)':undefined}
  const inp  = {width:'100%',background:T.surf,border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 13px',color:T.text,fontFamily:'Inter,sans-serif',fontSize:13,outline:'none'} as React.CSSProperties

  // ── QUOTE MODAL ────────────────────────────────────────────────────────────
  function QuoteModal(){
    if(!selectedQuote)return null
    const q=selectedQuote
    const sc=STATUS[q.status]||STATUS.pending
    const isIB=q.submissionType==='instant_book'
    const bdBg=dark?'rgba(2,8,30,0.98)':'#ffffff'
    const modalBorder=dark?`1px solid ${D.borderB}`:`1px solid ${L.borderB}`
    const sec=(title:string,icon:string,children:React.ReactNode)=>(
      <div style={{marginBottom:18}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
          <span>{icon}</span>{title}
        </div>
        <div style={{background:dark?'rgba(255,255,255,0.03)':L.cyanBg,borderRadius:10,padding:'12px',border:`1px solid ${T.border}`}}>
          {children}
        </div>
      </div>
    )
    const row=(label:string,value:string)=>(
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'5px 0',borderBottom:`1px solid ${T.border}`,gap:10}}>
        <span style={{fontSize:11,color:T.dim,fontWeight:600,flexShrink:0,minWidth:110}}>{label}</span>
        <span style={{fontSize:12,color:T.text,fontWeight:600,textAlign:'right' as const}}>{value}</span>
      </div>
    )
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelectedQuote(null)}>
        <div style={{background:bdBg,border:modalBorder,borderRadius:22,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',boxShadow:dark?'0 30px 80px rgba(0,0,0,0.7)':'0 20px 60px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div style={{padding:'20px 22px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap' as const}}>
                <span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:isIB?D.greenBg:D.cyanBg,color:isIB?D.green:D.cyan,border:`1px solid ${isIB?'rgba(16,185,129,0.3)':'rgba(93,235,241,0.3)'}`,letterSpacing:.5,textTransform:'uppercase' as const}}>
                  {isIB?'⚡ Instant Book':'📋 Quote Request'}
                </span>
                <span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,color:sc.color,border:`1px solid ${sc.color}40`,background:dark?'rgba(255,255,255,0.05)':L.surf}}>{sc.label}</span>
              </div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:T.text}}>{q.client.firstName} {q.client.lastName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2}}>{fmtDate(q.createdAt)} · {q.serviceType}</div>
            </div>
            <div style={{textAlign:'right' as const,flexShrink:0}}>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:26,fontWeight:900,color:isIB?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</div>
              {q.instantBookSavings!=null&&q.instantBookSavings>0&&<div style={{fontSize:11,color:D.green,fontWeight:700}}>🎉 Saving {fmtMoney(q.instantBookSavings)}/visit</div>}
            </div>
          </div>
          <div style={{padding:'18px 22px'}}>
            {sec('Client','👤',<>
              {row('Name',`${q.client.firstName} ${q.client.lastName}`)}
              {row('Email',q.client.email)}
              {row('Phone',q.client.phone||'—')}
              {row('Address',[q.client.address,q.client.city,q.client.state,q.client.zip].filter(Boolean).join(', ')||'—')}
            </>)}
            {sec('Service Details','🏠',<>
              {row('Service',q.serviceType)}
              {row('Frequency',q.frequency)}
              {row('Address',q.address||'—')}
              {q.sqftRange&&row('Sq Ft',parseInt(q.sqftRange).toLocaleString()+' sq ft')}
              {q.bedrooms!=null&&row('Bedrooms',String(q.bedrooms))}
              {q.bathrooms!=null&&row('Bathrooms',String(q.bathrooms))}
              {q.airbnbSqft&&row('Airbnb Sq Ft',q.airbnbSqft)}
              {q.airbnbBeds!=null&&row('Beds',String(q.airbnbBeds))}
              {q.airbnbUnits&&row('Units',q.airbnbUnits)}
            </>)}
            {sec('Scheduling','📅',<>
              {row('Preferred Date 1',fmtDate(q.preferredDate1))}
              {row('Preferred Date 2',fmtDate(q.preferredDate2))}
              {row('Preferred Times',q.preferredTimes||'—')}
            </>)}
            {sec('Pricing','💰',<>
              {q.priceBreakdown.split('\n').filter(Boolean).map((line,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                  <span style={{color:T.muted}}>{line.split('..')[0]?.trim()}</span>
                  <span style={{color:T.text,fontWeight:700}}>{line.includes('$')?'$'+line.split('$')[1]:''}</span>
                </div>
              ))}
              {q.discount>0&&(
                <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',marginTop:4}}>
                  <span style={{color:D.green,fontWeight:700,fontSize:12}}>✓ {q.discountLabel}</span>
                  <span style={{color:D.green,fontWeight:800,fontSize:12}}>-{fmtMoney(q.discount)}</span>
                </div>
              )}
              {q.instantBookSavings!=null&&q.instantBookSavings>0&&(
                <div style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:D.greenBg,borderRadius:8,marginTop:4,border:'1px solid rgba(16,185,129,0.3)'}}>
                  <span style={{color:D.green,fontWeight:700,fontSize:12}}>⚡ Instant Book (10% × 5 cleans)</span>
                  <span style={{color:D.green,fontWeight:800,fontSize:12}}>-{fmtMoney(q.instantBookSavings)}/visit</span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:`2px solid ${T.borderB}`,marginTop:8}}>
                <span style={{color:T.text,fontWeight:800,fontSize:14}}>Total per visit</span>
                <span style={{color:isIB?D.green:T.cyan,fontWeight:900,fontSize:18}}>{fmtMoney(q.totalPrice)}</span>
              </div>
            </>)}
            {q.addonsList&&q.addonsList!=='None selected'&&sec('Add-ons','✨',
              <div style={{color:T.muted,fontSize:12,lineHeight:1.8}}>{q.addonsList}</div>
            )}
            {(q.keyAreas||q.additionalNotes)&&sec('Notes','📝',<>
              {q.keyAreas&&row('Key Areas',q.keyAreas)}
              {q.additionalNotes&&row('Notes',q.additionalNotes)}
            </>)}
            {/* Actions */}
            <div style={{display:'flex',gap:8,marginTop:18,flexWrap:'wrap' as const}}>
              {q.status==='pending'&&(
                <button onClick={()=>updateStatus(q.id,'reviewed')} style={{flex:1,padding:'11px',borderRadius:10,background:T.cyanBg,border:`1px solid ${T.borderB}`,color:T.cyan,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Mark Reviewed</button>
              )}
              {['pending','reviewed'].includes(q.status)&&(
                <button onClick={()=>updateStatus(q.id,'booked')} style={{flex:2,padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 6px 20px rgba(16,185,129,0.3)'}}>
                  ✓ Confirm Booking
                </button>
              )}
              {q.status==='booked'&&(
                <button onClick={()=>updateStatus(q.id,'completed')} style={{flex:2,padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  Mark Completed
                </button>
              )}
              {q.status!=='cancelled'&&(
                <button onClick={()=>updateStatus(q.id,'cancelled')} style={{padding:'11px 14px',borderRadius:10,background:D.redBg,border:'1px solid rgba(239,68,68,0.3)',color:D.red,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  function DashboardPage(){
    return(
      <div>
        {/* Welcome banner */}
        <div style={{background:dark?'linear-gradient(135deg,rgba(5,30,80,0.9),rgba(2,12,40,0.95))':'linear-gradient(135deg,#e0f2fe,#bae6fd)',border:`1px solid ${T.borderB}`,borderRadius:18,padding:'24px 28px',marginBottom:24,position:'relative',overflow:'hidden'}}>
          {dark&&<div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle at 20% 50%,rgba(5,53,116,0.6) 0%,transparent 50%),radial-gradient(circle at 80% 30%,rgba(93,235,241,0.08) 0%,transparent 40%)',pointerEvents:'none'}}/>}
          <div style={{position:'relative',zIndex:1}}>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:22,fontWeight:900,color:dark?'#fff':L.text,marginBottom:4}}>
              Welcome back, {user!.name.split(' ')[0]} 👋
            </div>
            <div style={{fontSize:13,color:T.muted}}>
              {pending.length>0?`${pending.length} quote${pending.length>1?'s':''} waiting for review`:'Your CleanSync dashboard'}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {label:'Pending Quotes',value:pending.length,  color:D.amber,  click:()=>setPage('quotes')},
            {label:'Active Bookings',value:booked.length,  color:D.green,  click:()=>setPage('quotes')},
            {label:'Total Clients',  value:clients.length, color:T.cyan,   click:()=>setPage('clients')},
            {label:'Upcoming Jobs',  value:upcoming.length,color:D.violet, click:()=>setPage('calendar')},
          ].map(s=>(
            <div key={s.label} onClick={s.click} style={{...card,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
              onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:28,fontWeight:900,color:s.color,lineHeight:1,textShadow:dark?`0 0 12px ${s.color}50`:undefined}}>{s.value}</div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase' as const,color:T.dim,marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pending callout */}
        {pending.length>0&&(
          <div onClick={()=>setPage('quotes')} style={{background:D.amberBg,border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,padding:'14px 18px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:D.amber}}>{pending.length} quote{pending.length>1?'s':''} waiting for review</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                {pending.filter(q=>q.submissionType==='instant_book').length>0&&
                  <span style={{color:D.green,fontWeight:700}}>⚡ {pending.filter(q=>q.submissionType==='instant_book').length} instant book · </span>}
                Click to review and confirm bookings
              </div>
            </div>
            <span style={{color:D.amber,fontSize:20}}>→</span>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20}}>
          {/* Recent quotes */}
          <div>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:12}}>Recent Quotes</div>
            {quotes.length===0?(
              <div style={{color:T.dim,fontSize:13,padding:'20px 0'}}>No quotes yet. Share your booking form to get started.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {quotes.slice(0,6).map(q=>{
                  const sc=STATUS[q.status]||STATUS.pending
                  const isIB=q.submissionType==='instant_book'
                  return(
                    <div key={q.id} onClick={()=>setSelectedQuote(q)} style={{...card,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color .15s'}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                      <div style={{width:38,height:38,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:T.cyan,flexShrink:0}}>
                        {q.client.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.text,display:'flex',alignItems:'center',gap:6}}>
                          {q.client.firstName} {q.client.lastName}
                          {isIB&&<span style={{fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:8,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.25)'}}>⚡</span>}
                        </div>
                        <div style={{fontSize:11,color:T.dim}}>{q.serviceType} · {fmtRel(q.createdAt)}</div>
                      </div>
                      <div style={{textAlign:'right' as const,flexShrink:0}}>
                        <div style={{fontSize:15,fontWeight:900,color:isIB?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</div>
                        <span style={{fontSize:9,fontWeight:700,color:sc.color}}>{sc.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming jobs */}
          <div>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:12}}>Upcoming Jobs</div>
            {upcoming.length===0?(
              <div style={{color:T.dim,fontSize:13}}>No upcoming synced jobs.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {upcoming.slice(0,7).map(j=>(
                  <div key={j.id} style={{...card,padding:'9px 12px',display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:T.cyan,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.displayName}</div>
                      <div style={{fontSize:10,color:T.dim}}>{j.propertyLabel}</div>
                    </div>
                    <div style={{fontSize:11,color:T.cyan,fontWeight:700,flexShrink:0}}>{fmtDate(j.checkoutTime)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── QUOTES PAGE ────────────────────────────────────────────────────────────
  function QuotesPage(){
    const [filter,setFilter]=useState('all')
    const [search,setSearch]=useState('')
    const filtered=quotes
      .filter(q=>filter==='all'||q.status===filter)
      .filter(q=>!search||`${q.client.firstName} ${q.client.lastName} ${q.client.email} ${q.serviceType}`.toLowerCase().includes(search.toLowerCase()))
    return(
      <div>
        <div style={{marginBottom:24}}><h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Quotes & Bookings</h1><p style={{fontSize:13,color:T.muted,marginTop:4}}>{quotes.length} total · {pending.length} pending</p></div>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' as const}}>
          <input style={{...inp,flex:1,minWidth:200}} placeholder="Search by name, email, service..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{display:'flex',gap:3,background:T.surf,borderRadius:9,padding:3,border:`1px solid ${T.border}`}}>
            {['all','pending','reviewed','booked','completed','cancelled'].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:'5px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:filter===s?T.cyanBg:'transparent',color:filter===s?T.cyan:T.dim,fontFamily:'Inter,sans-serif',textTransform:'capitalize' as const}}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {filtered.length===0?(
          <div style={{textAlign:'center' as const,padding:'60px 0',color:T.dim,fontSize:14}}>
            {quotes.length===0?'No quotes yet. They\'ll appear here when clients submit the booking form.':'No quotes match this filter.'}
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(q=>{
              const sc=STATUS[q.status]||STATUS.pending
              const isIB=q.submissionType==='instant_book'
              return(
                <div key={q.id} onClick={()=>setSelectedQuote(q)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'border-color .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:T.cyan,flexShrink:0}}>
                    {q.client.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap' as const}}>
                      <span style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</span>
                      {isIB&&<span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>⚡ INSTANT BOOK</span>}
                      <span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,color:sc.color,border:`1px solid ${sc.color}40`,background:dark?'rgba(255,255,255,0.04)':L.surf}}>{sc.label}</span>
                    </div>
                    <div style={{fontSize:11,color:T.dim}}>{q.serviceType} · {q.frequency} · {fmtRel(q.createdAt)}</div>
                  </div>
                  <div style={{textAlign:'right' as const,flexShrink:0}}>
                    <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:isIB?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</div>
                    {q.instantBookSavings!=null&&q.instantBookSavings>0&&<div style={{fontSize:10,color:D.green,fontWeight:700}}>saving {fmtMoney(q.instantBookSavings)}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── CLIENTS PAGE ───────────────────────────────────────────────────────────
  function ClientsPage(){
    const [search,setSearch]=useState('')
    const [expanded,setExpanded]=useState<string|null>(null)
    const filtered=clients.filter(c=>!search||`${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase()))
    return(
      <div>
        <div style={{marginBottom:24}}><h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Clients</h1><p style={{fontSize:13,color:T.muted,marginTop:4}}>{clients.length} client{clients.length!==1?'s':''}</p></div>
        <input style={{...inp,marginBottom:16}} placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {filtered.length===0?<div style={{textAlign:'center' as const,padding:'60px 0',color:T.dim,fontSize:14}}>No clients yet.</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(c=>{
              const isExp=expanded===c.id
              const cq=quotes.filter(q=>q.clientId===c.id)
              const spent=cq.filter(q=>q.status==='completed').reduce((s,q)=>s+q.totalPrice,0)
              return(
                <div key={c.id} style={{...card,overflow:'hidden',transition:'border-color .15s'}}>
                  <div style={{padding:'13px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setExpanded(isExp?null:c.id)}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:900,color:T.cyan,flexShrink:0}}>
                      {`${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text}}>{c.firstName} {c.lastName}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{c.email} · {c.phone||'No phone'}</div>
                    </div>
                    <div style={{textAlign:'right' as const,flexShrink:0,marginRight:8}}>
                      <div style={{fontSize:12,color:T.muted}}>{cq.length} quote{cq.length!==1?'s':''}</div>
                      {spent>0&&<div style={{fontSize:12,color:D.green,fontWeight:700}}>{fmtMoney(spent)} total</div>}
                    </div>
                    <span style={{color:T.dim,fontSize:12}}>{isExp?'▲':'▼'}</span>
                  </div>
                  {isExp&&(
                    <div style={{borderTop:`1px solid ${T.border}`,padding:'13px 16px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                        <div style={{background:T.surf,borderRadius:8,padding:'10px 12px',border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:9,color:T.dim,textTransform:'uppercase' as const,letterSpacing:1,fontWeight:700,marginBottom:3}}>Location</div>
                          <div style={{fontSize:12,color:T.text,fontWeight:600}}>{[c.city,c.state].filter(Boolean).join(', ')||'—'}</div>
                        </div>
                        <div style={{background:T.surf,borderRadius:8,padding:'10px 12px',border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:9,color:T.dim,textTransform:'uppercase' as const,letterSpacing:1,fontWeight:700,marginBottom:3}}>Member Since</div>
                          <div style={{fontSize:12,color:T.text,fontWeight:600}}>{fmtDate(c.createdAt)}</div>
                        </div>
                      </div>
                      {cq.length>0&&(
                        <div>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:8}}>Quote History</div>
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {cq.slice(0,4).map(q=>{
                              const sc=STATUS[q.status]||STATUS.pending
                              return(
                                <div key={q.id} onClick={()=>setSelectedQuote(q)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:T.surf,borderRadius:8,cursor:'pointer',border:`1px solid ${T.border}`}}>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:T.text}}>{q.serviceType}</div>
                                    <div style={{fontSize:10,color:T.dim}}>{fmtDate(q.createdAt)}</div>
                                  </div>
                                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                                    <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,color:sc.color,background:dark?'rgba(255,255,255,0.04)':L.surf}}>{sc.label}</span>
                                    <span style={{fontSize:13,fontWeight:900,color:T.cyan}}>{fmtMoney(q.totalPrice)}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── CALENDAR PAGE ──────────────────────────────────────────────────────────
  function CalendarPage(){
    const [calDate,setCalDate]=useState(new Date())
    const yr=calDate.getFullYear(),mo=calDate.getMonth()
    const first=new Date(yr,mo,1),dow=first.getDay(),last=new Date(yr,mo+1,0)
    const today=new Date()
    const cells:({type:'pad';n:number}|{type:'day';day:number;date:Date})[]=[]
    for(let i=0;i<dow;i++){const d=new Date(yr,mo,-dow+i+1);cells.push({type:'pad',n:d.getDate()})}
    for(let d=1;d<=last.getDate();d++) cells.push({type:'day',day:d,date:new Date(yr,mo,d)})
    const trail=(dow+last.getDate())%7;if(trail) for(let i=1;i<=7-trail;i++) cells.push({type:'pad',n:i})
    function jobsOn(d:Date){return upcoming.filter(j=>sameDay(new Date(j.checkoutTime),d))}
    function quotesOn(d:Date){return quotes.filter(q=>(q.preferredDate1&&sameDay(new Date(q.preferredDate1),d))||(q.preferredDate2&&sameDay(new Date(q.preferredDate2),d)))}
    return(
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>{calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:2}}>{upcoming.length} upcoming jobs · {quotes.filter(q=>q.preferredDate1).length} quote appointments</p>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setCalDate(new Date(yr,mo-1,1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.muted,cursor:'pointer',fontSize:14}}>‹</button>
            <button onClick={()=>setCalDate(new Date())} style={{padding:'0 12px',height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.cyan,cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}}>Today</button>
            <button onClick={()=>setCalDate(new Date(yr,mo+1,1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.muted,cursor:'pointer',fontSize:14}}>›</button>
          </div>
        </div>
        <div style={{display:'flex',gap:14,marginBottom:10}}>
          {[{color:T.cyan,label:'Synced Job'},{color:D.green,label:'Quote/Booking'},{color:D.amber,label:'Instant Book'}].map(l=>(
            <div key={l.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:T.muted}}>
              <div style={{width:10,height:10,borderRadius:3,background:l.color}}/>{l.label}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:1}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
            <div key={d} style={{textAlign:'center' as const,padding:'8px 0',fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,background:T.cyanBg,borderRadius:4}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:'100px',gap:1,background:T.border,borderRadius:12,overflow:'hidden'}}>
          {cells.map((cell,idx)=>{
            if(cell.type==='pad') return <div key={`p${idx}`} style={{background:dark?'rgba(255,255,255,0.01)':L.surf,opacity:.4,padding:'6px 6px'}}><span style={{fontSize:11,color:T.dim}}>{cell.n}</span></div>
            const{day,date}=cell,isT=sameDay(date,today)
            const dj=jobsOn(date),dq=quotesOn(date)
            return(
              <div key={day} style={{background:isT?T.cyanBg:dark?D.surf:L.surf,padding:'5px 4px',borderTop:isT?`2px solid ${T.cyan}`:'2px solid transparent',display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{fontSize:11,fontWeight:700,color:isT?T.cyan:T.dim,marginBottom:3,width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',background:isT?T.cyanBg:'transparent'}}>{day}</div>
                <div style={{display:'flex',flexDirection:'column',gap:2,flex:1,overflow:'hidden'}}>
                  {dj.slice(0,2).map(j=>(
                    <div key={j.id} style={{padding:'1px 4px',borderRadius:3,background:T.cyanBg,borderLeft:`2px solid ${T.cyan}`,fontSize:9,fontWeight:700,color:T.cyan,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fmtTime(j.checkoutTime)} {j.displayName}</div>
                  ))}
                  {dq.slice(0,1).map(q=>(
                    <div key={q.id} onClick={()=>setSelectedQuote(q)} style={{padding:'1px 4px',borderRadius:3,background:q.submissionType==='instant_book'?D.amberBg:D.greenBg,borderLeft:`2px solid ${q.submissionType==='instant_book'?D.amber:D.green}`,fontSize:9,fontWeight:700,color:q.submissionType==='instant_book'?D.amber:D.green,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}>
                      {q.client.firstName} {q.client.lastName.charAt(0)}.
                    </div>
                  ))}
                  {dj.length+dq.length>3&&<div style={{fontSize:8,color:T.dim,fontWeight:700}}>+{dj.length+dq.length-3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── INTEGRATIONS PAGE ──────────────────────────────────────────────────────
  function IntegrationsPage(){
    const [jobberAccts,setJobberAccts]=useState<any[]>([])
    const [hostawayAccts,setHostawayAccts]=useState<any[]>([])
    const [gmailAccts,setGmailAccts]=useState<any[]>([])
    const [syncing,setSyncing]=useState<string|null>(null)
    const [msg,setMsg]=useState<string|null>(null)
    useEffect(()=>{
      fetch('/api/jobber/accounts').then(r=>r.json()).then(d=>setJobberAccts(Array.isArray(d)?d:[]))
      fetch('/api/hostaway/accounts').then(r=>r.json()).then(d=>setHostawayAccts(Array.isArray(d)?d:[]))
      fetch('/api/gmail/accounts').then(r=>r.json()).then(d=>setGmailAccts(Array.isArray(d)?d:[]))
    },[])
    async function syncJobber(){setSyncing('jobber');setMsg(null);const r=await fetch('/api/jobber/sync',{method:'POST'});const d=await r.json();if(d.error?.includes('NEEDS_RECONNECT')){setMsg('⚠ Jobber token expired — please reconnect')}else{setMsg(`✓ Synced — ${d.imported??0} new jobs`);load()};setSyncing(null)}
    async function syncHostaway(){setSyncing('hostaway');setMsg(null);const r=await fetch('/api/hostaway/sync',{method:'POST'});const d=await r.json();const t=Array.isArray(d)?d.reduce((s:number,x:any)=>s+(x.imported||0),0):0;setMsg(`✓ Synced — ${t} new jobs`);load();setSyncing(null)}
    async function connectJobber(){const r=await fetch('/api/jobber/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    async function connectGmail(){const r=await fetch('/api/gmail/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    const icard={...card,padding:'20px'} as React.CSSProperties
    return(
      <div>
        <div style={{marginBottom:24}}><h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Integrations</h1><p style={{fontSize:13,color:T.muted,marginTop:4}}>Connect your cleaning platforms</p></div>
        {msg&&<div style={{marginBottom:16,padding:'10px 14px',borderRadius:8,fontSize:12,background:msg.startsWith('✓')?D.greenBg:D.amberBg,color:msg.startsWith('✓')?D.green:D.amber,border:`1px solid ${msg.startsWith('✓')?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}`}}>{msg}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
          {/* Booking Form */}
          <div style={icard}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:46,height:46,borderRadius:12,background:T.cyanBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,border:`1px solid ${T.borderB}`}}>🧹</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>Booking Form</div>
                <div style={{fontSize:11,color:T.muted}}>Quotes sync automatically when clients submit</div>
              </div>
              <span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>Live</span>
            </div>
            <div style={{fontSize:12,color:T.muted,padding:'10px 12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>
              {quotes.length} quotes received · {pending.length} pending review
            </div>
          </div>
          {/* Hostaway */}
          <div style={icard}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:46,height:46,borderRadius:12,background:'rgba(251,133,0,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,border:'1px solid rgba(251,133,0,0.2)'}}>🔑</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>Hostaway</div>
                <div style={{fontSize:11,color:T.muted}}>iCal calendar sync</div>
              </div>
              {hostawayAccts.length>0&&<span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>Connected</span>}
            </div>
            {hostawayAccts.length>0&&<div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>{hostawayAccts.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.surf,borderRadius:7,border:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.text,fontWeight:600}}>{a.name}</span><span style={{color:T.dim}}>#{a.listingId}</span></div>)}</div>}
            <button onClick={syncHostaway} disabled={syncing==='hostaway'} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(251,133,0,0.4)',background:'rgba(251,133,0,0.1)',color:'#fb8500',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{syncing==='hostaway'?'Syncing...':'⟳ Sync Hostaway'}</button>
          </div>
          {/* Jobber */}
          <div style={icard}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:46,height:46,borderRadius:12,background:'rgba(0,196,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,border:'1px solid rgba(0,196,255,0.2)'}}>💼</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>Jobber</div>
                <div style={{fontSize:11,color:T.muted}}>Sync scheduled visits & events</div>
              </div>
              {jobberAccts.length>0&&<span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>Connected</span>}
            </div>
            {jobberAccts.length>0&&<div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>{jobberAccts.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.surf,borderRadius:7,border:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.text,fontWeight:600}}>{a.companyName||a.email}</span><span style={{color:T.dim}}>{fmtRel(a.lastSynced)}</span></div>)}</div>}
            <div style={{display:'flex',gap:6}}>
              {jobberAccts.length>0&&<button onClick={syncJobber} disabled={!!syncing} style={{flex:1,padding:'9px',borderRadius:9,border:'1px solid rgba(0,196,255,0.4)',background:'rgba(0,196,255,0.1)',color:'#00c4ff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{syncing==='jobber'?'Syncing...':'⟳ Sync'}</button>}
              <button onClick={connectJobber} style={{flex:1,padding:'9px',borderRadius:9,border:'1px solid rgba(0,196,255,0.4)',background:'rgba(0,196,255,0.1)',color:'#00c4ff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{jobberAccts.length>0?'+ Another':'Connect Jobber'}</button>
            </div>
          </div>
          {/* Gmail */}
          <div style={icard}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:46,height:46,borderRadius:12,background:'rgba(234,67,53,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,border:'1px solid rgba(234,67,53,0.2)'}}>✉️</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>Gmail</div>
                <div style={{fontSize:11,color:T.muted}}>Connect for future email features</div>
              </div>
              {gmailAccts.length>0&&<span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>Connected</span>}
            </div>
            <button onClick={connectGmail} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(234,67,53,0.3)',background:'rgba(234,67,53,0.1)',color:'#ea4335',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{gmailAccts.length>0?'+ Connect Another':'Connect Gmail'}</button>
          </div>
        </div>
      </div>
    )
  }

  const NAV_ITEMS:[Page,string,string,number?][]=[
    ['dashboard','◉','Dashboard'],
    ['quotes','📋','Quotes',pending.length||undefined],
    ['clients','👤','Clients'],
    ['calendar','📅','Calendar'],
    ['integrations','🔗','Integrations'],
    ['settings','⚙️','Settings'],
  ]

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:T.bg,fontFamily:'Inter,-apple-system,sans-serif',backgroundImage:dark?'radial-gradient(circle at 20% 30%,rgba(5,53,116,0.5) 0%,transparent 50%),radial-gradient(circle at 80% 70%,rgba(10,79,168,0.4) 0%,transparent 40%)':'none'}}>

      {/* SIDEBAR */}
      <nav style={{width:collapsed?64:220,minWidth:collapsed?64:220,background:T.nav,borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column',transition:'width .2s,min-width .2s',overflow:'hidden',flexShrink:0,boxShadow:dark?'4px 0 20px rgba(0,0,0,0.4)':undefined}}>
        {/* Logo */}
        <div style={{padding:'18px 14px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,minWidth:220}}>
          <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#0ea5e9,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 0 14px rgba(6,182,212,0.4)'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="white" opacity=".9"/><rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity=".6"/><rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity=".6"/><rect x="13" y="13" width="8" height="8" rx="2" fill="white" opacity=".3"/></svg>
          </div>
          {!collapsed&&<div>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:15,fontWeight:900,color:'#fff',letterSpacing:.2}}>CleanSync</div>
            <div style={{fontSize:9,color:'rgba(93,235,241,0.7)',fontWeight:700,letterSpacing:1.5,textTransform:'uppercase' as const}}>Cleaner Portal</div>
          </div>}
        </div>
        {/* Nav */}
        <div style={{flex:1,padding:'10px 7px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
          {NAV_ITEMS.map(([id,icon,label,badge])=>{
            const active=page===id
            return(
              <button key={id} onClick={()=>setPage(id as Page)} style={{display:'flex',alignItems:'center',gap:10,padding:collapsed?'10px':'9px 11px',borderRadius:9,border:'none',cursor:'pointer',background:active?'rgba(93,235,241,0.12)':'transparent',color:active?'#5debf1':'rgba(255,255,255,0.5)',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:active?700:500,transition:'all .14s',textAlign:'left',width:'100%',justifyContent:collapsed?'center':'flex-start',position:'relative'}}>
                <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
                {!collapsed&&<span style={{flex:1,whiteSpace:'nowrap'}}>{label}</span>}
                {!collapsed&&badge!=null&&badge>0&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:'#f59e0b',color:'#000',fontWeight:800}}>{badge}</span>}
                {active&&<div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:20,borderRadius:'0 2px 2px 0',background:'#5debf1'}}/>}
              </button>
            )
          })}
        </div>
        {/* Bottom */}
        <div style={{padding:'8px 7px',borderTop:`1px solid ${T.border}`,display:'flex',flexDirection:'column',gap:4}}>
          <button onClick={()=>setDark(d=>!d)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 11px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:11,fontFamily:'Inter,sans-serif',fontWeight:600,justifyContent:collapsed?'center':'flex-start'}}>
            <span style={{fontSize:13}}>{dark?'☀️':'🌙'}</span>
            {!collapsed&&<span>{dark?'Light Mode':'Dark Mode'}</span>}
          </button>
          {!collapsed&&<div style={{padding:'7px 10px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.75)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user!.name}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user!.email}</div>
          </div>}
          <button onClick={logout} style={{width:'100%',padding:'7px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.35)',fontSize:11,fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            {collapsed?'↩':'Sign out'}
          </button>
          <button onClick={()=>setCollapsed(p=>!p)} style={{width:'100%',padding:'7px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.35)',fontSize:11,fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {collapsed?'→':'← Collapse'}
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{flex:1,overflowY:'auto',padding:24}}>
        {page==='dashboard'    &&<DashboardPage/>}
        {page==='quotes'       &&<QuotesPage/>}
        {page==='clients'      &&<ClientsPage/>}
        {page==='calendar'     &&<CalendarPage/>}
        {page==='integrations' &&<IntegrationsPage/>}
        {page==='settings'     &&(
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text,marginBottom:24}}>Settings</h1>
            <div style={{...card,padding:'22px',maxWidth:480}}>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Account</div>
              {[{l:'Name',v:user!.name},{l:'Email',v:user!.email},{l:'Role',v:'Cleaner'}].map(f=>(
                <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${T.border}`}}>
                  <span style={{fontSize:12,color:T.dim,fontWeight:600}}>{f.l}</span>
                  <span style={{fontSize:12,color:T.text,fontWeight:700}}>{f.v}</span>
                </div>
              ))}
              <div style={{marginTop:18,padding:'12px 14px',background:T.cyanBg,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted}}>
                Profile editing, notifications, and more settings coming soon.
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedQuote&&<QuoteModal/>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(93,235,241,0.2);border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(93,235,241,0.4);}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
