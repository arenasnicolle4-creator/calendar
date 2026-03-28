'use client'
// app/dashboard/cleaner/page.tsx — CleanSync Pro Cleaner Portal v3
// Comprehensive business management portal for cleaners

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── TYPES ────────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; role: string; phone?: string; company?: string; bio?: string }
interface Quote {
  id: string; clientId: string; cleanerId: string|null; status: string; submissionType: string
  serviceType: string; frequency: string; address: string
  totalPrice: number; subtotal: number; discount: number
  discountLabel: string; instantBookSavings: number | null
  priceBreakdown: string; addonsList: string; additionalNotes: string
  keyAreas: string; preferredDate1: string | null; preferredDate2: string | null
  preferredTimes: string; sqftRange: string | null; bedrooms: number | null
  bathrooms: number | null; airbnbSqft: string | null; airbnbBeds: number | null
  airbnbUnits: string | null; notes: string | null; createdAt: string; updatedAt: string
  client: QuoteClient
}
interface QuoteClient {
  id: string; firstName: string; lastName: string; email: string
  phone: string; address: string; city: string; state: string; zip: string
  notes?: string; createdAt: string; updatedAt: string; quotes?: Quote[]
}
interface Job {
  id: string; displayName: string; propertyLabel: string; address: string
  checkoutTime: string; platform: string; checkinTime: string | null
  customerName: string | null; sqft: number | null; beds: number | null
  baths: number | null; worth: number | null; notes: string | null
}
interface Invoice {
  id: string; jobId: string | null; fromId: string; toId: string
  amount: number; tax: number; status: string; dueDate: string | null
  paidAt: string | null; notes: string | null; lineItems: string
  createdAt: string; updatedAt: string
  from?: User; to?: User
}

type Page = 'dashboard'|'quotes'|'quote-detail'|'create-quote'|'jobs'|'create-job'
  |'clients'|'create-client'|'client-detail'|'invoices'|'create-invoice'|'invoice-detail'
  |'calendar'|'reports'|'activity'|'integrations'|'settings'

// ── THEME ────────────────────────────────────────────────────────────────────
const D = {
  bg:'#020c1f', nav:'rgba(2,8,20,0.98)', card:'rgba(5,30,80,0.45)',
  surf:'rgba(255,255,255,0.04)', border:'rgba(93,235,241,0.15)',
  borderB:'rgba(93,235,241,0.35)', text:'#ffffff', muted:'rgba(255,255,255,0.65)',
  dim:'rgba(255,255,255,0.35)', cyan:'#5debf1', cyanD:'#06b6d4',
  cyanBg:'rgba(93,235,241,0.08)', green:'#10b981', greenBg:'rgba(16,185,129,0.1)',
  amber:'#f59e0b', amberBg:'rgba(245,158,11,0.08)', red:'#ef4444',
  redBg:'rgba(239,68,68,0.08)', violet:'#a78bfa', violetBg:'rgba(167,139,250,0.08)',
  rose:'#f472b6', roseBg:'rgba(244,114,182,0.08)',
}
const L = {
  bg:'#f0f9ff', nav:'#0c4a6e', card:'#ffffff',
  surf:'#ffffff', border:'rgba(14,165,233,0.18)',
  borderB:'rgba(14,165,233,0.4)', text:'#0c4a6e', muted:'#0369a1',
  dim:'#7dd3fc', cyan:'#0284c7', cyanD:'#0369a1',
  cyanBg:'rgba(14,165,233,0.06)', green:'#059669', greenBg:'rgba(5,150,105,0.08)',
  amber:'#d97706', amberBg:'rgba(217,119,6,0.08)', red:'#dc2626',
  redBg:'rgba(220,38,38,0.06)', violet:'#7c3aed', violetBg:'rgba(124,58,237,0.08)',
  rose:'#db2777', roseBg:'rgba(219,39,119,0.08)',
}

const STATUS: Record<string,{label:string;color:string;bg:string}> = {
  pending:   {label:'Pending',   color:'#f59e0b', bg:'rgba(245,158,11,0.1)'},
  reviewed:  {label:'Reviewed',  color:'#5debf1', bg:'rgba(93,235,241,0.1)'},
  booked:    {label:'Booked',    color:'#10b981', bg:'rgba(16,185,129,0.1)'},
  completed: {label:'Completed', color:'#a78bfa', bg:'rgba(167,139,250,0.1)'},
  cancelled: {label:'Cancelled', color:'#ef4444', bg:'rgba(239,68,68,0.1)'},
}
const INV_STATUS: Record<string,{label:string;color:string;bg:string}> = {
  draft:     {label:'Draft',     color:'#94a3b8', bg:'rgba(148,163,184,0.1)'},
  sent:      {label:'Sent',      color:'#f59e0b', bg:'rgba(245,158,11,0.1)'},
  paid:      {label:'Paid',      color:'#10b981', bg:'rgba(16,185,129,0.1)'},
  overdue:   {label:'Overdue',   color:'#ef4444', bg:'rgba(239,68,68,0.1)'},
  cancelled: {label:'Cancelled', color:'#6b7280', bg:'rgba(107,114,128,0.1)'},
}

// ── UTILS ────────────────────────────────────────────────────────────────────
function fmtDate(d:string|null){if(!d)return'—';return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtTime(d:string){return new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function fmtRel(d:string|null){
  if(!d)return'Never';const m=Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1)return'Just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60)
  return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`
}
function fmtMoney(n:number){return`$${n.toFixed(2)}`}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}

// ── SERVICE TYPES ────────────────────────────────────────────────────────────
const SERVICE_TYPES = ['Standard Clean','Deep Clean','Move-In/Move-Out','Airbnb Turnover','Office Clean','Post-Construction','Custom']
const FREQUENCIES = ['One-Time','Weekly','Bi-Weekly','Every 3 Weeks','Monthly','As Needed']


// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function CleanerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User|null>(null)
  const [dark, setDark] = useState(true)
  const [page, setPage] = useState<Page>('dashboard')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<QuoteClient[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [activeQuoteId, setActiveQuoteId] = useState<string|null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string|null>(null)
  const [activeClientId, setActiveClientId] = useState<string|null>(null)
  const [selectedJob, setSelectedJob] = useState<Job|null>(null)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const T = dark ? D : L
  const showToast = (msg:string,type:'ok'|'err'='ok')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      if(!d.user){router.push('/login');return}
      if(d.user.role==='provider'){router.replace('/dashboard/provider');return}
      setUser(d.user)
    })
  },[router])

  // ── DATA LOADING ─────────────────────────────────────────────────────────
  const load = useCallback(async()=>{
    const [qr,cr,jr,ir]=await Promise.all([
      fetch('/api/quotes'),fetch('/api/quote-clients'),fetch('/api/jobs'),fetch('/api/invoices')
    ])
    const [q,c,j,i]=await Promise.all([qr.json(),cr.json(),jr.json(),ir.json().catch(()=>[])])
    setQuotes(Array.isArray(q)?q:[])
    setClients(Array.isArray(c)?c:[])
    setJobs(Array.isArray(j)?j:[])
    setInvoices(Array.isArray(i)?i:[])
    setLoading(false)
  },[])

  useEffect(()=>{if(user)load()},[user,load])
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}

  // ── QUOTE OPERATIONS ─────────────────────────────────────────────────────
  async function updateQuoteStatus(id:string,status:string){
    await fetch(`/api/quotes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    await load(); showToast(`Quote marked ${status}`)
  }
  async function deleteQuote(id:string){
    await fetch(`/api/quotes/${id}`,{method:'DELETE'}); await load()
    if(activeQuoteId===id){setActiveQuoteId(null);setPage('quotes')}
    showToast('Quote deleted')
  }
  async function saveQuote(id:string,data:Record<string,any>){
    await fetch(`/api/quotes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    await load(); showToast('Quote saved')
  }
  async function createQuote(data:Record<string,any>){
    const r=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    const d=await r.json(); await load()
    if(d.quoteId){setActiveQuoteId(d.quoteId);setPage('quote-detail');showToast('Quote created')}
    return d
  }
  async function sendQuoteEmail(id:string){
    const r=await fetch(`/api/quotes/${id}/email`,{method:'POST'})
    const d=await r.json()
    if(r.ok){await load();showToast('Quote email sent!')}
    else showToast(d.error||'Failed to send email','err')
    return r.ok
  }

  // ── CLIENT OPERATIONS ────────────────────────────────────────────────────
  async function createClient(data:Record<string,any>){
    const r=await fetch('/api/quote-clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    const d=await r.json(); await load()
    if(d.id){showToast('Client created');return d}
    showToast(d.error||'Failed to create client','err'); return null
  }

  // ── INVOICE OPERATIONS ───────────────────────────────────────────────────
  async function createInvoice(data:Record<string,any>){
    const r=await fetch('/api/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    const d=await r.json(); await load()
    if(d.id){setActiveInvoiceId(d.id);setPage('invoice-detail');showToast('Invoice created')}
    return d
  }
  async function updateInvoice(id:string,data:Record<string,any>){
    await fetch(`/api/invoices/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    await load(); showToast('Invoice updated')
  }
  async function deleteInvoice(id:string){
    await fetch(`/api/invoices/${id}`,{method:'DELETE'}); await load()
    if(activeInvoiceId===id){setActiveInvoiceId(null);setPage('invoices')}
    showToast('Invoice deleted')
  }

  // ── NAVIGATION HELPERS ───────────────────────────────────────────────────
  function openQuote(q:Quote){setActiveQuoteId(q.id);setPage('quote-detail')}
  function openClient(c:QuoteClient){setActiveClientId(c.id);setPage('client-detail')}
  function openInvoice(id:string){setActiveInvoiceId(id);setPage('invoice-detail')}

  // ── LOADING SCREEN ───────────────────────────────────────────────────────
  if(!user||loading) return(
    <div style={{minHeight:'100vh',background:'#020c1f',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:'3px solid rgba(93,235,241,0.2)',borderTopColor:'#5debf1',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <div style={{color:'rgba(93,235,241,0.6)',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:600,letterSpacing:1}}>Loading CleanSync</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── COMPUTED DATA ────────────────────────────────────────────────────────
  const pending = quotes.filter(q=>q.status==='pending')
  const booked = quotes.filter(q=>q.status==='booked')
  const completed = quotes.filter(q=>q.status==='completed')
  const upcoming = jobs.filter(j=>new Date(j.checkoutTime)>=new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
  const totalRevenue = completed.reduce((s,q)=>s+q.totalPrice,0) + invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0)
  const conversionRate = quotes.length>0 ? Math.round((booked.length+completed.length)/quotes.length*100) : 0
  const avgQuote = quotes.length>0 ? quotes.reduce((s,q)=>s+q.totalPrice,0)/quotes.length : 0

  // ── SHARED STYLES ────────────────────────────────────────────────────────
  const card:React.CSSProperties = {background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:dark?'0 8px 30px rgba(0,0,0,0.3)':undefined}
  const inp:React.CSSProperties = {width:'100%',background:T.surf,border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 13px',color:T.text,fontFamily:'Inter,sans-serif',fontSize:13,outline:'none'}
  const btnPrimary:React.CSSProperties = {padding:'10px 20px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#0ea5e9,#0284c7)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 14px rgba(14,165,233,0.3)'}
  const btnSecondary:React.CSSProperties = {padding:'10px 16px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}
  const sectionHdr = (title:string,icon:string) => (
    <div style={{fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:14,display:'flex',alignItems:'center',gap:7,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontSize:14}}>{icon}</span>{title}
    </div>
  )
  const badge = (label:string,color:string,bg:string) => (
    <span style={{fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,color,background:bg,border:`1px solid ${color}30`}}>{label}</span>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function DashboardPage(){
    return(
      <div>
        {/* Welcome */}
        <div style={{background:dark?'linear-gradient(135deg,rgba(5,30,80,0.9),rgba(2,12,40,0.95))':'linear-gradient(135deg,#e0f2fe,#bae6fd)',border:`1px solid ${T.borderB}`,borderRadius:18,padding:'26px 30px',marginBottom:24,position:'relative',overflow:'hidden'}}>
          {dark&&<div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle at 20% 50%,rgba(5,53,116,0.6) 0%,transparent 50%),radial-gradient(circle at 80% 30%,rgba(93,235,241,0.08) 0%,transparent 40%)',pointerEvents:'none'}}/>}
          <div style={{position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
            <div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:dark?'#fff':L.text}}>Welcome back, {user!.name.split(' ')[0]}</div>
              <div style={{fontSize:13,color:T.muted,marginTop:4}}>
                {pending.length>0?`${pending.length} quote${pending.length>1?'s':''} waiting for review · `:''}
                {upcoming.length} upcoming job{upcoming.length!==1?'s':''}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPage('create-quote')} style={btnPrimary}>+ New Quote</button>
              <button onClick={()=>setPage('create-invoice')} style={{...btnPrimary,background:'linear-gradient(135deg,#10b981,#059669)',boxShadow:'0 4px 14px rgba(16,185,129,0.3)'}}>+ Invoice</button>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:24}}>
          {[
            {label:'Pending',value:pending.length,color:D.amber,click:()=>setPage('quotes')},
            {label:'Active Bookings',value:booked.length,color:D.green,click:()=>setPage('quotes')},
            {label:'Total Clients',value:clients.length,color:T.cyan,click:()=>setPage('clients')},
            {label:'Upcoming Jobs',value:upcoming.length,color:D.violet,click:()=>setPage('calendar')},
            {label:'Revenue',value:fmtMoney(totalRevenue),color:D.rose,click:()=>setPage('reports'),isText:true},
          ].map((s:any)=>(
            <div key={s.label} onClick={s.click} style={{...card,padding:'16px 18px',cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
              onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:s.isText?22:28,fontWeight:900,color:s.color,lineHeight:1,textShadow:dark?`0 0 12px ${s.color}40`:undefined}}>{s.isText?s.value:s.value}</div>
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
                Click to review and action
              </div>
            </div>
            <span style={{color:D.amber,fontSize:20}}>→</span>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>
          {/* Recent Quotes */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan}}>Recent Quotes</div>
              <button onClick={()=>setPage('quotes')} style={{fontSize:11,color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif'}}>View All →</button>
            </div>
            {quotes.length===0?(
              <div style={{color:T.dim,fontSize:13,padding:'30px 0',textAlign:'center'}}>No quotes yet. Share your booking form to get started.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {quotes.slice(0,8).map(q=>{
                  const sc=STATUS[q.status]||STATUS.pending
                  const isIB=q.submissionType==='instant_book'
                  return(
                    <div key={q.id} onClick={()=>openQuote(q)} style={{...card,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color .15s'}}
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

          {/* Right sidebar: upcoming + quick stats */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Quick Actions */}
            <div style={{...card,padding:'16px'}}>
              {sectionHdr('Quick Actions','⚡')}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  {label:'Create Quote',icon:'📋',click:()=>setPage('create-quote'),color:T.cyan},
                  {label:'Add Client',icon:'👤',click:()=>setPage('create-client'),color:D.green},
                  {label:'Create Invoice',icon:'💰',click:()=>setPage('create-invoice'),color:D.amber},
                  {label:'Add Job',icon:'🗓',click:()=>setPage('create-job'),color:D.violet},
                ].map(a=>(
                  <button key={a.label} onClick={a.click} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:600,color:T.text,textAlign:'left',width:'100%',transition:'all .12s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.cyanBg;(e.currentTarget as HTMLButtonElement).style.borderColor=T.borderB}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent';(e.currentTarget as HTMLButtonElement).style.borderColor=T.border}}>
                    <span style={{fontSize:14}}>{a.icon}</span><span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming Jobs */}
            <div style={{...card,padding:'16px'}}>
              {sectionHdr('Upcoming Jobs','📅')}
              {upcoming.length===0?<div style={{color:T.dim,fontSize:12}}>No upcoming synced jobs.</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {upcoming.slice(0,7).map(j=>(
                    <div key={j.id} onClick={()=>setSelectedJob(j)} style={{padding:'9px 10px',borderRadius:8,background:T.surf,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8,cursor:'pointer',transition:'border-color .12s'}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:T.cyan,flexShrink:0}}/>
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

            {/* Business Snapshot */}
            <div style={{...card,padding:'16px'}}>
              {sectionHdr('Business Snapshot','📊')}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {l:'Conversion',v:`${conversionRate}%`,c:D.green},
                  {l:'Avg Quote',v:fmtMoney(avgQuote),c:T.cyan},
                  {l:'This Month',v:fmtMoney(quotes.filter(q=>new Date(q.createdAt).getMonth()===new Date().getMonth()&&q.status==='completed').reduce((s,q)=>s+q.totalPrice,0)),c:D.amber},
                  {l:'Invoices Due',v:String(invoices.filter(i=>i.status==='sent').length),c:D.rose},
                ].map(s=>(
                  <div key={s.l} style={{background:T.surf,borderRadius:8,padding:'10px',border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase' as const,color:T.dim}}>{s.l}</div>
                    <div style={{fontSize:16,fontWeight:900,color:s.c,marginTop:2}}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // QUOTES PAGE (List + Pipeline toggle)
  // ══════════════════════════════════════════════════════════════════════════
  function QuotesPage(){
    const [filter,setFilter]=useState('all')
    const [search,setSearch]=useState('')
    const [view,setView]=useState<'list'|'pipeline'>('list')
    const [deleteId,setDeleteId]=useState<string|null>(null)
    const [deletingId,setDeletingId]=useState<string|null>(null)
    const filtered=quotes
      .filter(q=>filter==='all'||q.status===filter)
      .filter(q=>!search||`${q.client.firstName} ${q.client.lastName} ${q.client.email} ${q.serviceType}`.toLowerCase().includes(search.toLowerCase()))

    async function handleDelete(id:string,e:React.MouseEvent){
      e.stopPropagation(); setDeletingId(id); await deleteQuote(id); setDeletingId(null); setDeleteId(null)
    }

    // Pipeline columns
    const pipelineCols = ['pending','reviewed','booked','completed','cancelled']

    return(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Quotes & Bookings</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:4}}>{quotes.length} total · {pending.length} pending · {booked.length} booked</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setView(v=>v==='list'?'pipeline':'list')} style={btnSecondary}>
              {view==='list'?'Pipeline View':'List View'}
            </button>
            <button onClick={()=>setPage('create-quote')} style={btnPrimary}>+ New Quote</button>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' as const}}>
          <input style={{...inp,flex:1,minWidth:200}} placeholder="Search by name, email, service..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{display:'flex',gap:3,background:T.surf,borderRadius:9,padding:3,border:`1px solid ${T.border}`}}>
            {['all','pending','reviewed','booked','completed','cancelled'].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:'5px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:filter===s?T.cyanBg:'transparent',color:filter===s?T.cyan:T.dim,fontFamily:'Inter,sans-serif',textTransform:'capitalize' as const}}>{s}</button>
            ))}
          </div>
        </div>

        {/* PIPELINE VIEW */}
        {view==='pipeline' ? (
          <div style={{display:'grid',gridTemplateColumns:`repeat(${pipelineCols.length},1fr)`,gap:10,minHeight:400}}>
            {pipelineCols.map(col=>{
              const sc=STATUS[col]||STATUS.pending
              const colQuotes=quotes.filter(q=>q.status===col)
              return(
                <div key={col} style={{background:T.surf,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                  <div style={{padding:'12px 14px',borderBottom:`2px solid ${sc.color}40`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:sc.color}}/>
                      <span style={{fontSize:12,fontWeight:800,color:T.text,textTransform:'capitalize'}}>{sc.label}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:T.dim,background:T.cyanBg,padding:'2px 7px',borderRadius:8}}>{colQuotes.length}</span>
                  </div>
                  <div style={{flex:1,padding:8,display:'flex',flexDirection:'column',gap:6,overflowY:'auto',maxHeight:500}}>
                    {colQuotes.map(q=>(
                      <div key={q.id} onClick={()=>openQuote(q)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 12px',cursor:'pointer',transition:'all .12s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=sc.color}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</div>
                        <div style={{fontSize:10,color:T.dim,marginTop:2}}>{q.serviceType}</div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                          <span style={{fontSize:14,fontWeight:900,color:q.submissionType==='instant_book'?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</span>
                          <span style={{fontSize:9,color:T.dim}}>{fmtRel(q.createdAt)}</span>
                        </div>
                        {q.submissionType==='instant_book'&&<div style={{fontSize:8,fontWeight:800,color:D.green,marginTop:3}}>⚡ INSTANT BOOK</div>}
                      </div>
                    ))}
                    {colQuotes.length===0&&<div style={{padding:16,textAlign:'center',color:T.dim,fontSize:11}}>None</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* LIST VIEW */
          filtered.length===0?(
            <div style={{textAlign:'center' as const,padding:'60px 0',color:T.dim,fontSize:14}}>
              {quotes.length===0?'No quotes yet. They\'ll appear here when clients submit the booking form.':'No quotes match this filter.'}
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filtered.map(q=>{
                const sc=STATUS[q.status]||STATUS.pending
                const isIB=q.submissionType==='instant_book'
                const isDelTarget=deleteId===q.id
                return(
                  <div key={q.id} style={{position:'relative'}}>
                    <div onClick={()=>openQuote(q)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'border-color .15s',opacity:isDelTarget?.5:1}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                      <div style={{width:44,height:44,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:T.cyan,flexShrink:0}}>
                        {q.client.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap' as const}}>
                          <span style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</span>
                          {isIB&&badge('⚡ INSTANT BOOK',D.green,D.greenBg)}
                          {badge(sc.label,sc.color,sc.bg)}
                        </div>
                        <div style={{fontSize:11,color:T.dim}}>{q.serviceType} · {q.frequency} · {fmtRel(q.createdAt)}</div>
                      </div>
                      <div style={{textAlign:'right' as const,flexShrink:0,marginRight:36}}>
                        <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:isIB?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</div>
                        {q.instantBookSavings!=null&&q.instantBookSavings>0&&<div style={{fontSize:10,color:D.green,fontWeight:700}}>saving {fmtMoney(q.instantBookSavings)}</div>}
                      </div>
                    </div>
                    {/* Delete */}
                    {!isDelTarget ? (
                      <button onClick={(e)=>{e.stopPropagation();setDeleteId(q.id)}} title="Delete" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:6,border:`1px solid rgba(239,68,68,0.15)`,background:'transparent',color:D.red,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.3,transition:'opacity .15s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.opacity='1'}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity='0.3'}}>🗑</button>
                    ) : (
                      <div onClick={e=>e.stopPropagation()} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',display:'flex',gap:4,alignItems:'center',background:dark?'rgba(2,8,20,0.95)':L.card,padding:'5px 8px',borderRadius:8,border:`1px solid rgba(239,68,68,0.3)`,boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
                        <span style={{fontSize:11,color:D.red,fontWeight:600,marginRight:4}}>Delete?</span>
                        <button onClick={(e)=>handleDelete(q.id,e)} disabled={deletingId===q.id} style={{padding:'4px 10px',borderRadius:5,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Inter,sans-serif',opacity:deletingId===q.id?.6:1}}>{deletingId===q.id?'...':'Yes'}</button>
                        <button onClick={(e)=>{e.stopPropagation();setDeleteId(null)}} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'Inter,sans-serif'}}>No</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // QUOTE DETAIL PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function QuoteDetailPage(){
    const quote = quotes.find(q=>q.id===activeQuoteId)
    if(!quote) return <div style={{padding:40,color:T.dim,textAlign:'center'}}>Quote not found. <button onClick={()=>setPage('quotes')} style={{color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif'}}>Back to Quotes</button></div>
    const q = quote, sc=STATUS[q.status]||STATUS.pending, isIB=q.submissionType==='instant_book'

    const [editing,setEditing]=useState(false)
    const [saving,setSaving]=useState(false)
    const [sending,setSending]=useState(false)
    const [confirmDelete,setConfirmDelete]=useState(false)
    const [deleting,setDeleting]=useState(false)

    const [editTotal,setEditTotal]=useState(q.totalPrice.toString())
    const [editSubtotal,setEditSubtotal]=useState(q.subtotal.toString())
    const [editDiscount,setEditDiscount]=useState(q.discount.toString())
    const [editDiscountLabel,setEditDiscountLabel]=useState(q.discountLabel)
    const [editService,setEditService]=useState(q.serviceType)
    const [editFrequency,setEditFrequency]=useState(q.frequency)
    const [editAddress,setEditAddress]=useState(q.address)
    const [editSqft,setEditSqft]=useState(q.sqftRange||'')
    const [editBeds,setEditBeds]=useState(q.bedrooms?.toString()||'')
    const [editBaths,setEditBaths]=useState(q.bathrooms?.toString()||'')
    const [editAddons,setEditAddons]=useState(q.addonsList)
    const [editNotes,setEditNotes]=useState(q.additionalNotes)
    const [editKeyAreas,setEditKeyAreas]=useState(q.keyAreas)

    const [lineItems,setLineItems]=useState<{label:string;amount:string}[]>(()=>{
      const lines = q.priceBreakdown.split('\n').filter(Boolean)
      return lines.length>0 ? lines.map(line => {
        const parts = line.split('...'); const label = parts[0]?.trim() || line
        const amtMatch = line.match(/\$[\d,.]+/)
        return { label, amount: amtMatch ? amtMatch[0].replace('$','') : '0' }
      }) : [{label:'Base Service',amount:q.totalPrice.toString()}]
    })

    function updateLineItem(idx:number,field:'label'|'amount',value:string){
      const updated=[...lineItems]; updated[idx]={...updated[idx],[field]:value}; setLineItems(updated)
      const newSub=updated.reduce((s,li)=>s+(parseFloat(li.amount)||0),0)
      setEditSubtotal(newSub.toFixed(2)); setEditTotal(Math.max(0,newSub-(parseFloat(editDiscount)||0)).toFixed(2))
    }

    async function handleSave(){
      setSaving(true)
      const breakdown = lineItems.map(li=>`${li.label}...$${parseFloat(li.amount||'0').toFixed(2)}`).join('\n')
      await saveQuote(q.id,{
        totalPrice:parseFloat(editTotal),subtotal:parseFloat(editSubtotal),
        discount:parseFloat(editDiscount),discountLabel:editDiscountLabel,
        priceBreakdown:breakdown,serviceType:editService,frequency:editFrequency,
        address:editAddress,sqftRange:editSqft||null,
        bedrooms:editBeds?parseInt(editBeds):null,bathrooms:editBaths?parseFloat(editBaths):null,
        addonsList:editAddons,additionalNotes:editNotes,keyAreas:editKeyAreas,
      })
      setSaving(false); setEditing(false)
    }

    async function handleSendEmail(){setSending(true);await sendQuoteEmail(q.id);setSending(false)}
    async function handleDelete(){setDeleting(true);await deleteQuote(q.id);setDeleting(false)}
    async function convertToInvoice(){
      const liArr = lineItems.map(li=>({description:li.label,amount:parseFloat(li.amount)||0,quantity:1}))
      await createInvoice({toClientId:q.clientId,amount:parseFloat(editTotal),lineItems:JSON.stringify(liArr),notes:`From quote for ${q.client.firstName} ${q.client.lastName}`})
    }

    const fieldStyle = editing ? {...inp,background:dark?'rgba(255,255,255,0.06)':'#f0f9ff',border:`1px solid ${T.borderB}`} as React.CSSProperties : {...inp,background:'transparent',border:'1px solid transparent',cursor:'default',padding:'10px 0'} as React.CSSProperties

    return(
      <div style={{maxWidth:960,margin:'0 auto'}}>
        {/* Breadcrumb */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>setPage('quotes')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Quotes</button>
            <span style={{color:T.dim,fontSize:12}}>/</span>
            <span style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</span>
            {badge(sc.label,sc.color,sc.bg)}
            {isIB&&badge('⚡ Instant Book',D.green,D.greenBg)}
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {!editing ? (
              <button onClick={()=>setEditing(true)} style={{...btnSecondary,borderColor:T.borderB,color:T.cyan}}>✎ Edit</button>
            ) : (
              <><button onClick={()=>setEditing(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{...btnPrimary,opacity:saving?.7:1}}>{saving?'Saving...':'✓ Save'}</button></>
            )}
          </div>
        </div>

        {/* Header card */}
        <div style={{...card,padding:'22px 26px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,color:T.cyan,flexShrink:0}}>
              {q.client.firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:20,fontWeight:900,color:T.text}}>{q.client.firstName} {q.client.lastName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2}}>{q.client.email} · {q.client.phone||'No phone'}</div>
              <div style={{fontSize:11,color:T.dim,marginTop:1}}>Submitted {fmtDate(q.createdAt)} · {q.serviceType}</div>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:32,fontWeight:900,color:isIB?D.green:T.cyan,lineHeight:1}}>{fmtMoney(parseFloat(editTotal)||q.totalPrice)}</div>
            {q.instantBookSavings!=null&&q.instantBookSavings>0&&<div style={{fontSize:12,color:D.green,fontWeight:700,marginTop:3}}>Saving {fmtMoney(q.instantBookSavings)}/visit</div>}
          </div>
        </div>

        {/* Content grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Line Items */}
            <div style={{...card,padding:'22px'}}>
              {sectionHdr('Pricing & Line Items','💰')}
              {lineItems.map((li,idx)=>(
                <div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${T.border}`}}>
                  {editing ? (<>
                    <input value={li.label} onChange={e=>updateLineItem(idx,'label',e.target.value)} style={{...fieldStyle,flex:1}}/>
                    <span style={{color:T.muted,fontSize:13,fontWeight:700}}>$</span>
                    <input value={li.amount} onChange={e=>updateLineItem(idx,'amount',e.target.value)} style={{...fieldStyle,width:80,textAlign:'right'}} type="number" step="0.01"/>
                    <button onClick={()=>setLineItems(lineItems.filter((_,i)=>i!==idx))} style={{width:26,height:26,borderRadius:6,border:`1px solid rgba(239,68,68,0.3)`,background:D.redBg,color:D.red,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                  </>) : (<>
                    <span style={{flex:1,fontSize:13,color:T.muted,fontWeight:500}}>{li.label}</span>
                    <span style={{fontSize:13,color:T.text,fontWeight:700}}>${parseFloat(li.amount||'0').toFixed(2)}</span>
                  </>)}
                </div>
              ))}
              {editing&&<button onClick={()=>setLineItems([...lineItems,{label:'New Item',amount:'0'}])} style={{marginTop:10,padding:'8px',borderRadius:7,border:`1px dashed ${T.borderB}`,background:'transparent',color:T.cyan,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',width:'100%'}}>+ Add Line Item</button>}
              {/* Discount + Total */}
              {(q.discount>0||editing)&&(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',marginTop:6,borderTop:`1px solid ${T.border}`}}>
                  {editing ? (<>
                    <input value={editDiscountLabel} onChange={e=>setEditDiscountLabel(e.target.value)} placeholder="Discount label" style={{...fieldStyle,flex:1,fontSize:12,color:D.green}}/>
                    <span style={{color:D.green,fontSize:12,fontWeight:700}}>-$</span>
                    <input value={editDiscount} onChange={e=>{setEditDiscount(e.target.value)}} onBlur={()=>{const s=parseFloat(editSubtotal)||0;const d=parseFloat(editDiscount)||0;setEditTotal(Math.max(0,s-d).toFixed(2))}} style={{...fieldStyle,width:80,textAlign:'right',color:D.green}} type="number" step="0.01"/>
                  </>) : (<>
                    <span style={{fontSize:12,color:D.green,fontWeight:700}}>✓ {q.discountLabel}</span>
                    <span style={{fontSize:12,color:D.green,fontWeight:800}}>-{fmtMoney(q.discount)}</span>
                  </>)}
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderTop:`2px solid ${T.borderB}`,marginTop:6}}>
                <span style={{color:T.text,fontWeight:800,fontSize:15}}>Total per visit</span>
                <span style={{color:isIB?D.green:T.cyan,fontWeight:900,fontSize:22}}>{fmtMoney(parseFloat(editTotal)||q.totalPrice)}</span>
              </div>
            </div>

            {/* Service Details */}
            <div style={{...card,padding:'22px'}}>
              {sectionHdr('Service Details','🏠')}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  {l:'Service Type',v:editService,s:setEditService},{l:'Frequency',v:editFrequency,s:setEditFrequency},
                  {l:'Sq Ft',v:editSqft,s:setEditSqft},{l:'Bedrooms',v:editBeds,s:setEditBeds},{l:'Bathrooms',v:editBaths,s:setEditBaths},
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div>
                    {editing ? <input value={f.v} onChange={e=>f.s(e.target.value)} style={fieldStyle}/> : <div style={{fontSize:13,fontWeight:600,color:T.text,padding:'10px 0'}}>{f.v||'—'}</div>}
                  </div>
                ))}
              </div>
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Address</div>
                {editing ? <input value={editAddress} onChange={e=>setEditAddress(e.target.value)} style={fieldStyle}/> : <div style={{fontSize:13,fontWeight:600,color:T.text,padding:'10px 0'}}>{q.address||'—'}</div>}
              </div>
            </div>

            {/* Notes */}
            <div style={{...card,padding:'22px'}}>
              {sectionHdr('Add-ons & Notes','📝')}
              {[{l:'Add-ons',v:editAddons,s:setEditAddons},{l:'Key Areas',v:editKeyAreas,s:setEditKeyAreas},{l:'Notes',v:editNotes,s:setEditNotes}].map(f=>(
                <div key={f.l} style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div>
                  {editing ? <textarea value={f.v} onChange={e=>f.s(e.target.value)} rows={2} style={{...fieldStyle,resize:'vertical'}}/> : <div style={{fontSize:13,color:T.muted,lineHeight:1.6,padding:'6px 0'}}>{f.v&&f.v!=='None selected'?f.v:'—'}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Client */}
            <div style={{...card,padding:'20px'}}>
              {sectionHdr('Client','👤')}
              {[{l:'Name',v:`${q.client.firstName} ${q.client.lastName}`},{l:'Email',v:q.client.email},{l:'Phone',v:q.client.phone||'—'},
                {l:'Address',v:[q.client.address,q.client.city,q.client.state,q.client.zip].filter(Boolean).join(', ')||'—'},
                {l:'Client Since',v:fmtDate(q.client.createdAt)},
              ].map(f=>(
                <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`,gap:8}}>
                  <span style={{fontSize:11,color:T.dim,fontWeight:600,flexShrink:0}}>{f.l}</span>
                  <span style={{fontSize:12,color:T.text,fontWeight:600,textAlign:'right'}}>{f.v}</span>
                </div>
              ))}
              <button onClick={()=>{setActiveClientId(q.clientId);setPage('client-detail')}} style={{...btnSecondary,width:'100%',marginTop:10,fontSize:11}}>View Client Profile →</button>
            </div>

            {/* Scheduling */}
            <div style={{...card,padding:'20px'}}>
              {sectionHdr('Scheduling','📅')}
              {[{l:'Date 1',v:fmtDate(q.preferredDate1)},{l:'Date 2',v:fmtDate(q.preferredDate2)},{l:'Times',v:q.preferredTimes||'—'}].map(f=>(
                <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`,gap:8}}>
                  <span style={{fontSize:11,color:T.dim,fontWeight:600,flexShrink:0}}>{f.l}</span>
                  <span style={{fontSize:12,color:T.text,fontWeight:600,textAlign:'right'}}>{f.v}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{...card,padding:'20px'}}>
              {sectionHdr('Actions','⚡')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {!isIB&&<button onClick={handleSendEmail} disabled={sending} style={{width:'100%',padding:'12px',borderRadius:10,...(sending?{}:{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',boxShadow:'0 4px 16px rgba(14,165,233,0.3)'}),color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:sending?.6:1}}>{sending?'Sending...':'✉ Send Quote Email'}</button>}
                {q.status==='pending'&&<button onClick={()=>updateQuoteStatus(q.id,'reviewed')} style={{width:'100%',padding:'11px',borderRadius:10,background:T.cyanBg,border:`1px solid ${T.borderB}`,color:T.cyan,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Mark Reviewed</button>}
                {['pending','reviewed'].includes(q.status)&&<button onClick={()=>updateQuoteStatus(q.id,'booked')} style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 14px rgba(16,185,129,0.3)'}}>✓ Confirm Booking</button>}
                {q.status==='booked'&&<button onClick={()=>updateQuoteStatus(q.id,'completed')} style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Mark Completed</button>}
                {q.status!=='cancelled'&&<button onClick={()=>updateQuoteStatus(q.id,'cancelled')} style={{width:'100%',padding:'11px',borderRadius:10,background:D.redBg,border:'1px solid rgba(239,68,68,0.3)',color:D.red,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel Quote</button>}
                <button onClick={convertToInvoice} style={{width:'100%',padding:'11px',borderRadius:10,background:D.amberBg,border:'1px solid rgba(245,158,11,0.3)',color:D.amber,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>💰 Convert to Invoice</button>
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:4}}>
                  {!confirmDelete ? (
                    <button onClick={()=>setConfirmDelete(true)} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid rgba(239,68,68,0.2)`,background:'transparent',color:D.red,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:0.7}}>🗑 Delete Quote</button>
                  ) : (
                    <div style={{background:D.redBg,borderRadius:10,padding:'14px',border:'1px solid rgba(239,68,68,0.3)'}}>
                      <div style={{fontSize:12,fontWeight:700,color:D.red,marginBottom:8}}>Delete permanently?</div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>setConfirmDelete(false)} style={{...btnSecondary,flex:1,fontSize:11}}>Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} style={{flex:1,padding:'8px',borderRadius:7,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif',opacity:deleting?.6:1}}>{deleting?'...':'Yes, Delete'}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE QUOTE PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function CreateQuotePage(){
    const [selClient,setSelClient]=useState('')
    const [newClient,setNewClient]=useState(false)
    const [nc,setNc]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',city:'',state:'AK',zip:''})
    const [qf,setQf]=useState({serviceType:'Standard Clean',frequency:'One-Time',address:'',sqftRange:'',bedrooms:'',bathrooms:'',addonsList:'',keyAreas:'',additionalNotes:'',preferredDate1:'',preferredDate2:'',preferredTimes:''})
    const [items,setItems]=useState<{label:string;amount:string}[]>([{label:'Base Service',amount:'0'}])
    const [submitting,setSubmitting]=useState(false)

    const total = items.reduce((s,li)=>s+(parseFloat(li.amount)||0),0)

    async function handleSubmit(){
      if(!selClient&&!nc.email){showToast('Select or create a client','err');return}
      setSubmitting(true)
      const breakdown = items.map(li=>`${li.label}...$${parseFloat(li.amount||'0').toFixed(2)}`).join('\n')
      const data:any = {
        service_type:qf.serviceType, frequency:qf.frequency, address:qf.address,
        sqft_range:qf.sqftRange, bedrooms:qf.bedrooms, house_bathrooms:qf.bathrooms,
        addons_list:qf.addonsList, key_areas:qf.keyAreas, additional_notes:qf.additionalNotes,
        preferred_date_1:qf.preferredDate1||undefined, preferred_date_2:qf.preferredDate2||undefined,
        preferred_times:qf.preferredTimes, price_breakdown:breakdown,
        subtotal:`$${total.toFixed(2)}`, total_price:`$${total.toFixed(2)}`,
        discount:'$0', discount_label:'', submission_type:'quote',
      }
      if(selClient){
        const c=clients.find(cl=>cl.id===selClient)
        if(c){data.email=c.email;data.first_name=c.firstName;data.last_name=c.lastName;data.phone=c.phone}
      } else {
        data.email=nc.email;data.first_name=nc.firstName;data.last_name=nc.lastName;data.phone=nc.phone
        data.address=nc.address||qf.address;data.city=nc.city;data.state=nc.state;data.zip=nc.zip
      }
      await createQuote(data)
      setSubmitting(false)
    }

    return(
      <div style={{maxWidth:700,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <button onClick={()=>setPage('quotes')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Back</button>
          <h1 style={{fontFamily:'Inter,sans-serif',fontSize:22,fontWeight:900,color:T.text}}>Create Quote</h1>
        </div>

        {/* Client Selection */}
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Client','👤')}
          {!newClient ? (
            <div>
              <select value={selClient} onChange={e=>setSelClient(e.target.value)} style={{...inp,cursor:'pointer'}}>
                <option value="">Select existing client...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}
              </select>
              <button onClick={()=>setNewClient(true)} style={{marginTop:10,fontSize:12,color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif'}}>+ Create New Client</button>
            </div>
          ) : (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[{l:'First Name',k:'firstName'},{l:'Last Name',k:'lastName'},{l:'Email *',k:'email'},{l:'Phone',k:'phone'},{l:'City',k:'city'},{l:'State',k:'state'}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div>
                    <input value={(nc as any)[f.k]} onChange={e=>setNc({...nc,[f.k]:e.target.value})} style={inp}/>
                  </div>
                ))}
              </div>
              <button onClick={()=>setNewClient(false)} style={{marginTop:10,fontSize:12,color:T.muted,background:'none',border:'none',cursor:'pointer',fontWeight:600,fontFamily:'Inter,sans-serif'}}>← Select Existing Client</button>
            </div>
          )}
        </div>

        {/* Service Details */}
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Service Details','🏠')}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Service Type</div>
              <select value={qf.serviceType} onChange={e=>setQf({...qf,serviceType:e.target.value})} style={{...inp,cursor:'pointer'}}>
                {SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Frequency</div>
              <select value={qf.frequency} onChange={e=>setQf({...qf,frequency:e.target.value})} style={{...inp,cursor:'pointer'}}>
                {FREQUENCIES.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {[{l:'Address',k:'address'},{l:'Sq Ft Range',k:'sqftRange'},{l:'Bedrooms',k:'bedrooms'},{l:'Bathrooms',k:'bathrooms'}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div>
                <input value={(qf as any)[f.k]} onChange={e=>setQf({...qf,[f.k]:e.target.value})} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{marginTop:10}}>
            <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Preferred Date</div>
            <input type="date" value={qf.preferredDate1} onChange={e=>setQf({...qf,preferredDate1:e.target.value})} style={inp}/>
          </div>
        </div>

        {/* Line Items */}
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Line Items','💰')}
          {items.map((li,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${T.border}`}}>
              <input value={li.label} onChange={e=>{const u=[...items];u[i]={...u[i],label:e.target.value};setItems(u)}} style={{...inp,flex:1}} placeholder="Item description"/>
              <span style={{color:T.muted,fontWeight:700}}>$</span>
              <input value={li.amount} onChange={e=>{const u=[...items];u[i]={...u[i],amount:e.target.value};setItems(u)}} style={{...inp,width:90,textAlign:'right'}} type="number" step="0.01"/>
              {items.length>1&&<button onClick={()=>setItems(items.filter((_,j)=>j!==i))} style={{width:26,height:26,borderRadius:6,border:`1px solid rgba(239,68,68,0.3)`,background:D.redBg,color:D.red,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}
            </div>
          ))}
          <button onClick={()=>setItems([...items,{label:'',amount:'0'}])} style={{marginTop:10,padding:'8px',borderRadius:7,border:`1px dashed ${T.borderB}`,background:'transparent',color:T.cyan,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',width:'100%'}}>+ Add Item</button>
          <div style={{display:'flex',justifyContent:'space-between',padding:'14px 0',borderTop:`2px solid ${T.borderB}`,marginTop:12}}>
            <span style={{fontWeight:800,fontSize:15,color:T.text}}>Total</span>
            <span style={{fontWeight:900,fontSize:22,color:T.cyan}}>{fmtMoney(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Notes','📝')}
          <textarea value={qf.additionalNotes} onChange={e=>setQf({...qf,additionalNotes:e.target.value})} rows={3} placeholder="Any notes for this quote..." style={{...inp,resize:'vertical'}}/>
        </div>

        <button onClick={handleSubmit} disabled={submitting} style={{...btnPrimary,width:'100%',padding:'14px',fontSize:15,opacity:submitting?.6:1}}>{submitting?'Creating...':'Create Quote'}</button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // JOBS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function JobsPage(){
    const [filter,setFilter]=useState<'all'|'upcoming'|'today'|'past'>('upcoming')
    const [search,setSearch]=useState('')
    const now=new Date(), todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate())
    const todayEnd=new Date(todayStart.getTime()+86400000)
    const filtered=jobs.filter(j=>{
      const d=new Date(j.checkoutTime)
      if(filter==='upcoming')return d>=now
      if(filter==='today')return d>=todayStart&&d<todayEnd
      if(filter==='past')return d<now
      return true
    }).filter(j=>!search||`${j.displayName} ${j.propertyLabel} ${j.address} ${j.platform}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>filter==='past'?new Date(b.checkoutTime).getTime()-new Date(a.checkoutTime).getTime():new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())

    return(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Jobs</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:4}}>{jobs.length} total · {upcoming.length} upcoming</p>
          </div>
          <button onClick={()=>setPage('create-job')} style={btnPrimary}>+ Add Job</button>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <input style={{...inp,flex:1,minWidth:200}} placeholder="Search jobs..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{display:'flex',gap:3,background:T.surf,borderRadius:9,padding:3,border:`1px solid ${T.border}`}}>
            {(['upcoming','today','past','all'] as const).map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:'5px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:filter===s?T.cyanBg:'transparent',color:filter===s?T.cyan:T.dim,fontFamily:'Inter,sans-serif',textTransform:'capitalize' as const}}>{s}</button>
            ))}
          </div>
        </div>
        {filtered.length===0?<div style={{textAlign:'center',padding:'60px 0',color:T.dim,fontSize:14}}>No jobs match this filter.</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(j=>{
              const isPast=new Date(j.checkoutTime)<now
              return(
                <div key={j.id} onClick={()=>setSelectedJob(j)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,opacity:isPast?.7:1,transition:'border-color .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:isPast?T.dim:T.cyan,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{j.displayName}</div>
                    <div style={{fontSize:11,color:T.dim,marginTop:2}}>{j.propertyLabel} · {j.address}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.cyan}}>{fmtDate(j.checkoutTime)}</div>
                    <div style={{fontSize:10,color:T.dim}}>{fmtTime(j.checkoutTime)}</div>
                  </div>
                  {badge(j.platform,j.platform==='hostaway'?'#fb8500':j.platform==='jobber'?'#00c4ff':T.cyan,`${j.platform==='hostaway'?'#fb8500':j.platform==='jobber'?'#00c4ff':T.cyan}18`)}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE JOB PAGE (Manual Job Entry)
  // ══════════════════════════════════════════════════════════════════════════
  function CreateJobPage(){
    const [jf,setJf]=useState({displayName:'',propertyLabel:'',address:'',checkoutDate:'',checkoutTimeVal:'10:00',checkinDate:'',checkinTimeVal:'',notes:''})
    const [submitting,setSubmitting]=useState(false)

    async function handleSubmit(){
      if(!jf.displayName||!jf.checkoutDate){showToast('Name and date required','err');return}
      setSubmitting(true)
      const checkout = new Date(`${jf.checkoutDate}T${jf.checkoutTimeVal||'10:00'}`)
      const body:any={displayName:jf.displayName,propertyLabel:jf.propertyLabel||jf.displayName,address:jf.address,checkoutTime:checkout.toISOString(),platform:'manual',notes:jf.notes}
      if(jf.checkinDate) body.checkinTime=new Date(`${jf.checkinDate}T${jf.checkinTimeVal||'14:00'}`).toISOString()
      await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      await load(); showToast('Job created'); setPage('jobs')
      setSubmitting(false)
    }

    return(
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <button onClick={()=>setPage('jobs')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Back</button>
          <h1 style={{fontFamily:'Inter,sans-serif',fontSize:22,fontWeight:900,color:T.text}}>Add Job</h1>
        </div>
        <div style={{...card,padding:'22px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[{l:'Job Name *',k:'displayName',span:true},{l:'Property Label',k:'propertyLabel'},{l:'Address',k:'address'},
              {l:'Checkout Date *',k:'checkoutDate',type:'date'},{l:'Checkout Time',k:'checkoutTimeVal',type:'time'},
              {l:'Check-in Date',k:'checkinDate',type:'date'},{l:'Check-in Time',k:'checkinTimeVal',type:'time'},
            ].map(f=>(
              <div key={f.k} style={(f as any).span?{gridColumn:'1/-1'}:{}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div>
                <input value={(jf as any)[f.k]} onChange={e=>setJf({...jf,[f.k]:e.target.value})} type={(f as any).type||'text'} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Notes</div>
            <textarea value={jf.notes} onChange={e=>setJf({...jf,notes:e.target.value})} rows={3} style={{...inp,resize:'vertical'}}/>
          </div>
          <button onClick={handleSubmit} disabled={submitting} style={{...btnPrimary,width:'100%',marginTop:16,padding:'12px',opacity:submitting?.6:1}}>{submitting?'Creating...':'Create Job'}</button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENTS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function ClientsPage(){
    const [search,setSearch]=useState('')
    const filtered=clients.filter(c=>!search||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()))
    return(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Clients</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:4}}>{clients.length} client{clients.length!==1?'s':''}</p>
          </div>
          <button onClick={()=>setPage('create-client')} style={btnPrimary}>+ Add Client</button>
        </div>
        <input style={{...inp,marginBottom:16}} placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {filtered.length===0?<div style={{textAlign:'center',padding:'60px 0',color:T.dim,fontSize:14}}>No clients yet.</div>:(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12}}>
            {filtered.map(c=>{
              const cq=quotes.filter(q=>q.clientId===c.id)
              const spent=cq.filter(q=>q.status==='completed').reduce((s,q)=>s+q.totalPrice,0)
              return(
                <div key={c.id} onClick={()=>openClient(c)} style={{...card,padding:'16px',cursor:'pointer',transition:'border-color .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:T.cyan,flexShrink:0}}>
                      {`${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text}}>{c.firstName} {c.lastName}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{c.email}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:12,color:T.dim}}>{cq.length} quote{cq.length!==1?'s':''}</div>
                      {spent>0&&<div style={{fontSize:13,color:D.green,fontWeight:700}}>{fmtMoney(spent)}</div>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:10}}>
                    {cq.slice(0,3).map(q=>{
                      const sc=STATUS[q.status]||STATUS.pending
                      return <span key={q.id} style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,color:sc.color,background:sc.bg,border:`1px solid ${sc.color}25`}}>{sc.label}</span>
                    })}
                    {[c.city,c.state].filter(Boolean).length>0&&<span style={{fontSize:10,color:T.dim,marginLeft:'auto'}}>{[c.city,c.state].filter(Boolean).join(', ')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE CLIENT PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function CreateClientPage(){
    const [f,setF]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',city:'',state:'AK',zip:'',notes:''})
    const [submitting,setSubmitting]=useState(false)
    async function handleSubmit(){
      if(!f.email||!f.firstName){showToast('Name and email required','err');return}
      setSubmitting(true)
      const result=await createClient(f)
      if(result?.id){setActiveClientId(result.id);setPage('client-detail')}
      setSubmitting(false)
    }
    return(
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <button onClick={()=>setPage('clients')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Back</button>
          <h1 style={{fontFamily:'Inter,sans-serif',fontSize:22,fontWeight:900,color:T.text}}>Add Client</h1>
        </div>
        <div style={{...card,padding:'22px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[{l:'First Name *',k:'firstName'},{l:'Last Name',k:'lastName'},{l:'Email *',k:'email'},{l:'Phone',k:'phone'},
              {l:'Address',k:'address'},{l:'City',k:'city'},{l:'State',k:'state'},{l:'Zip',k:'zip'}].map(fi=>(
              <div key={fi.k}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{fi.l}</div>
                <input value={(f as any)[fi.k]} onChange={e=>setF({...f,[fi.k]:e.target.value})} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Notes</div>
            <textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={3} style={{...inp,resize:'vertical'}} placeholder="Private notes about this client..."/>
          </div>
          <button onClick={handleSubmit} disabled={submitting} style={{...btnPrimary,width:'100%',marginTop:16,padding:'12px',opacity:submitting?.6:1}}>{submitting?'Creating...':'Create Client'}</button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT DETAIL PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function ClientDetailPage(){
    const client = clients.find(c=>c.id===activeClientId)
    if(!client) return <div style={{padding:40,color:T.dim,textAlign:'center'}}>Client not found. <button onClick={()=>setPage('clients')} style={{color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Back</button></div>
    const c=client, cq=quotes.filter(q=>q.clientId===c.id), ci=invoices.filter(i=>i.toId===c.id||false)
    const totalSpent=cq.filter(q=>q.status==='completed').reduce((s,q)=>s+q.totalPrice,0)+ci.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0)

    return(
      <div style={{maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
          <button onClick={()=>setPage('clients')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Clients</button>
        </div>
        {/* Header */}
        <div style={{...card,padding:'24px',marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:60,height:60,borderRadius:'50%',background:T.cyanBg,border:`2px solid ${T.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:T.cyan,flexShrink:0}}>
            {`${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:900,color:T.text}}>{c.firstName} {c.lastName}</div>
            <div style={{fontSize:13,color:T.muted,marginTop:2}}>{c.email} · {c.phone||'No phone'}</div>
            <div style={{fontSize:11,color:T.dim,marginTop:1}}>{[c.address,c.city,c.state,c.zip].filter(Boolean).join(', ')||'No address'} · Client since {fmtDate(c.createdAt)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:T.dim}}>Total Spent</div>
            <div style={{fontSize:26,fontWeight:900,color:D.green}}>{fmtMoney(totalSpent)}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
          {[{l:'Quotes',v:cq.length,c:T.cyan},{l:'Booked',v:cq.filter(q=>q.status==='booked').length,c:D.green},{l:'Completed',v:cq.filter(q=>q.status==='completed').length,c:D.violet},{l:'Invoices',v:ci.length,c:D.amber}].map(s=>(
            <div key={s.l} style={{...card,padding:'14px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:T.dim,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Quote History */}
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Quote History','📋')}
          {cq.length===0?<div style={{color:T.dim,fontSize:13}}>No quotes for this client.</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {cq.map(q=>{
                const sc=STATUS[q.status]||STATUS.pending
                return(
                  <div key={q.id} onClick={()=>openQuote(q)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:T.surf,borderRadius:8,cursor:'pointer',border:`1px solid ${T.border}`}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:T.text}}>{q.serviceType} · {q.frequency}</div>
                      <div style={{fontSize:10,color:T.dim,marginTop:1}}>{fmtDate(q.createdAt)}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {badge(sc.label,sc.color,sc.bg)}
                      <span style={{fontSize:14,fontWeight:900,color:T.cyan}}>{fmtMoney(q.totalPrice)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setPage('create-quote')}} style={btnPrimary}>+ New Quote for {c.firstName}</button>
          <button onClick={()=>setPage('create-invoice')} style={{...btnPrimary,background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 4px 14px rgba(245,158,11,0.3)'}}>+ Invoice</button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INVOICES PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function InvoicesPage(){
    const [filter,setFilter]=useState('all')
    const filtered=invoices.filter(i=>filter==='all'||i.status===filter)
    return(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>Invoices</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:4}}>{invoices.length} total · {fmtMoney(invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0))} collected</p>
          </div>
          <button onClick={()=>setPage('create-invoice')} style={btnPrimary}>+ New Invoice</button>
        </div>

        {/* Status summary */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:16}}>
          {[{k:'all',l:'All',v:invoices.length,c:T.cyan},{k:'draft',l:'Draft',v:invoices.filter(i=>i.status==='draft').length,c:'#94a3b8'},{k:'sent',l:'Sent',v:invoices.filter(i=>i.status==='sent').length,c:D.amber},{k:'paid',l:'Paid',v:invoices.filter(i=>i.status==='paid').length,c:D.green},{k:'overdue',l:'Overdue',v:invoices.filter(i=>i.status==='overdue').length,c:D.red}].map(s=>(
            <div key={s.k} onClick={()=>setFilter(s.k)} style={{...card,padding:'12px',textAlign:'center',cursor:'pointer',borderColor:filter===s.k?s.c:T.border,transition:'all .12s'}}>
              <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:T.dim,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {filtered.length===0?<div style={{textAlign:'center',padding:'60px 0',color:T.dim,fontSize:14}}>No invoices yet. Create one from a quote or start fresh.</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(inv=>{
              const is=INV_STATUS[inv.status]||INV_STATUS.draft
              const li=(() => {try{return JSON.parse(inv.lineItems)}catch{return[]}})()
              return(
                <div key={inv.id} onClick={()=>openInvoice(inv.id)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'border-color .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                  <div style={{width:40,height:40,borderRadius:10,background:is.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>💰</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{inv.notes||`Invoice #${inv.id.slice(-6)}`}</div>
                    <div style={{fontSize:11,color:T.dim,marginTop:2}}>{li.length} item{li.length!==1?'s':''} · Created {fmtDate(inv.createdAt)}{inv.dueDate?` · Due ${fmtDate(inv.dueDate)}`:''}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                    {badge(is.label,is.color,is.bg)}
                    <span style={{fontSize:18,fontWeight:900,color:inv.status==='paid'?D.green:T.cyan}}>{fmtMoney(inv.amount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE INVOICE PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function CreateInvoicePage(){
    const [selClient,setSelClient]=useState('')
    const [items,setItems]=useState<{description:string;quantity:string;amount:string}[]>([{description:'Cleaning Service',quantity:'1',amount:'0'}])
    const [dueDate,setDueDate]=useState('')
    const [notes,setNotes]=useState('')
    const [tax,setTax]=useState('0')
    const [submitting,setSubmitting]=useState(false)

    const subtotal=items.reduce((s,li)=>(parseFloat(li.amount)||0)*(parseFloat(li.quantity)||1)+s,0)
    const total=subtotal+(parseFloat(tax)||0)

    async function handleSubmit(){
      if(!selClient){showToast('Select a client','err');return}
      setSubmitting(true)
      await createInvoice({
        toClientId:selClient,amount:total,tax:parseFloat(tax)||0,
        lineItems:JSON.stringify(items.map(li=>({description:li.description,quantity:parseFloat(li.quantity)||1,amount:parseFloat(li.amount)||0}))),
        dueDate:dueDate||undefined,notes,
      })
      setSubmitting(false)
    }

    return(
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <button onClick={()=>setPage('invoices')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Back</button>
          <h1 style={{fontFamily:'Inter,sans-serif',fontSize:22,fontWeight:900,color:T.text}}>Create Invoice</h1>
        </div>
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Bill To','👤')}
          <select value={selClient} onChange={e=>setSelClient(e.target.value)} style={{...inp,cursor:'pointer'}}>
            <option value="">Select client...</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}
          </select>
        </div>
        <div style={{...card,padding:'22px',marginBottom:16}}>
          {sectionHdr('Line Items','💰')}
          {items.map((li,i)=>(
            <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:`1px solid ${T.border}`,alignItems:'center'}}>
              <input value={li.description} onChange={e=>{const u=[...items];u[i]={...u[i],description:e.target.value};setItems(u)}} style={{...inp,flex:1}} placeholder="Description"/>
              <input value={li.quantity} onChange={e=>{const u=[...items];u[i]={...u[i],quantity:e.target.value};setItems(u)}} style={{...inp,width:50,textAlign:'center'}} placeholder="Qty" type="number"/>
              <span style={{color:T.muted,fontWeight:700}}>$</span>
              <input value={li.amount} onChange={e=>{const u=[...items];u[i]={...u[i],amount:e.target.value};setItems(u)}} style={{...inp,width:80,textAlign:'right'}} type="number" step="0.01"/>
              {items.length>1&&<button onClick={()=>setItems(items.filter((_,j)=>j!==i))} style={{width:26,height:26,borderRadius:6,border:`1px solid rgba(239,68,68,0.3)`,background:D.redBg,color:D.red,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}
            </div>
          ))}
          <button onClick={()=>setItems([...items,{description:'',quantity:'1',amount:'0'}])} style={{marginTop:10,padding:'8px',borderRadius:7,border:`1px dashed ${T.borderB}`,background:'transparent',color:T.cyan,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',width:'100%'}}>+ Add Item</button>
          <div style={{marginTop:12,padding:'10px 0',borderTop:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Tax</div>
              <div style={{display:'flex',alignItems:'center',gap:4}}><span style={{color:T.muted}}>$</span><input value={tax} onChange={e=>setTax(e.target.value)} style={{...inp,width:80}} type="number" step="0.01"/></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:T.dim}}>Total</div>
              <div style={{fontSize:24,fontWeight:900,color:T.cyan}}>{fmtMoney(total)}</div>
            </div>
          </div>
        </div>
        <div style={{...card,padding:'22px',marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Due Date</div>
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={inp}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Notes</div>
              <input value={notes} onChange={e=>setNotes(e.target.value)} style={inp} placeholder="Invoice notes..."/>
            </div>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting} style={{...btnPrimary,width:'100%',padding:'14px',fontSize:15,opacity:submitting?.6:1}}>{submitting?'Creating...':'Create Invoice'}</button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INVOICE DETAIL PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function InvoiceDetailPage(){
    const inv=invoices.find(i=>i.id===activeInvoiceId)
    if(!inv)return <div style={{padding:40,color:T.dim,textAlign:'center'}}>Invoice not found. <button onClick={()=>setPage('invoices')} style={{color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700}}>Back</button></div>
    const is=INV_STATUS[inv.status]||INV_STATUS.draft
    const li=(()=>{try{return JSON.parse(inv.lineItems)}catch{return[]}})() as {description:string;quantity:number;amount:number}[]
    const [confirmDelete,setConfirmDelete]=useState(false)

    return(
      <div style={{maxWidth:700,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
          <button onClick={()=>setPage('invoices')} style={{...btnSecondary,padding:'7px 12px',fontSize:12}}>← Invoices</button>
          <span style={{color:T.dim,fontSize:12}}>/</span>
          <span style={{fontSize:13,fontWeight:700,color:T.text}}>Invoice #{inv.id.slice(-6)}</span>
          {badge(is.label,is.color,is.bg)}
        </div>

        <div style={{...card,padding:'26px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:T.text}}>Invoice #{inv.id.slice(-6)}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:4}}>Created {fmtDate(inv.createdAt)}{inv.dueDate?` · Due ${fmtDate(inv.dueDate)}`:''}</div>
              {inv.paidAt&&<div style={{fontSize:12,color:D.green,fontWeight:700,marginTop:2}}>Paid {fmtDate(inv.paidAt)}</div>}
            </div>
            <div style={{fontSize:32,fontWeight:900,color:inv.status==='paid'?D.green:T.cyan}}>{fmtMoney(inv.amount)}</div>
          </div>

          {/* Line Items */}
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',padding:'8px 0',borderBottom:`2px solid ${T.borderB}`,fontSize:10,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:T.dim}}>
              <span style={{flex:1}}>Description</span><span style={{width:60,textAlign:'center'}}>Qty</span><span style={{width:80,textAlign:'right'}}>Amount</span>
            </div>
            {li.map((item:any,idx:number)=>(
              <div key={idx} style={{display:'flex',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{flex:1,fontSize:13,color:T.text,fontWeight:500}}>{item.description}</span>
                <span style={{width:60,textAlign:'center',fontSize:13,color:T.muted}}>{item.quantity||1}</span>
                <span style={{width:80,textAlign:'right',fontSize:13,color:T.text,fontWeight:700}}>{fmtMoney((item.amount||0)*(item.quantity||1))}</span>
              </div>
            ))}
            {inv.tax>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:12,color:T.muted}}>Tax</span><span style={{fontSize:13,color:T.text,fontWeight:700}}>{fmtMoney(inv.tax)}</span></div>}
            <div style={{display:'flex',justifyContent:'space-between',padding:'14px 0',borderTop:`2px solid ${T.borderB}`,marginTop:4}}>
              <span style={{fontSize:15,fontWeight:800,color:T.text}}>Total</span>
              <span style={{fontSize:22,fontWeight:900,color:inv.status==='paid'?D.green:T.cyan}}>{fmtMoney(inv.amount)}</span>
            </div>
          </div>

          {inv.notes&&<div style={{padding:'12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted,marginBottom:16}}>{inv.notes}</div>}

          {/* Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {inv.status==='draft'&&<button onClick={()=>updateInvoice(inv.id,{status:'sent'})} style={{...btnPrimary,width:'100%',textAlign:'center'}}>✉ Mark as Sent</button>}
            {inv.status==='sent'&&<button onClick={()=>updateInvoice(inv.id,{status:'paid',paidAt:new Date().toISOString()})} style={{width:'100%',padding:'12px',borderRadius:10,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 14px rgba(16,185,129,0.3)'}}>✓ Mark as Paid</button>}
            {inv.status==='sent'&&<button onClick={()=>updateInvoice(inv.id,{status:'overdue'})} style={{width:'100%',padding:'11px',borderRadius:10,background:D.redBg,border:'1px solid rgba(239,68,68,0.3)',color:D.red,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Mark Overdue</button>}
            {!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid rgba(239,68,68,0.2)`,background:'transparent',color:D.red,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:0.7,marginTop:8}}>🗑 Delete Invoice</button>:(
              <div style={{background:D.redBg,borderRadius:10,padding:'14px',border:'1px solid rgba(239,68,68,0.3)',marginTop:8}}>
                <div style={{fontSize:12,fontWeight:700,color:D.red,marginBottom:8}}>Delete permanently?</div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setConfirmDelete(false)} style={{...btnSecondary,flex:1}}>Cancel</button>
                  <button onClick={()=>deleteInvoice(inv.id)} style={{flex:1,padding:'8px',borderRadius:7,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}}>Yes, Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALENDAR PAGE
  // ══════════════════════════════════════════════════════════════════════════
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
    function invoicesOn(d:Date){return invoices.filter(i=>i.dueDate&&sameDay(new Date(i.dueDate),d))}
    const [selectedDate,setSelectedDate]=useState<Date|null>(null)
    const selJobs=selectedDate?jobsOn(selectedDate):[]
    const selQuotes=selectedDate?quotesOn(selectedDate):[]
    const selInvoices=selectedDate?invoicesOn(selectedDate):[]

    return(
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text}}>{calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h1>
            <p style={{fontSize:13,color:T.muted,marginTop:2}}>{upcoming.length} upcoming jobs · {quotes.filter(q=>q.preferredDate1).length} quote dates</p>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setCalDate(new Date(yr,mo-1,1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.muted,cursor:'pointer',fontSize:14}}>‹</button>
            <button onClick={()=>setCalDate(new Date())} style={{padding:'0 12px',height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.cyan,cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}}>Today</button>
            <button onClick={()=>setCalDate(new Date(yr,mo+1,1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.muted,cursor:'pointer',fontSize:14}}>›</button>
          </div>
        </div>
        <div style={{display:'flex',gap:14,marginBottom:10}}>
          {[{color:T.cyan,label:'Synced Job'},{color:D.green,label:'Quote/Booking'},{color:D.amber,label:'Invoice Due'}].map(l=>(
            <div key={l.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:T.muted}}>
              <div style={{width:10,height:10,borderRadius:3,background:l.color}}/>{l.label}
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:selectedDate?'1fr 300px':'1fr',gap:16}}>
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:1}}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
                <div key={d} style={{textAlign:'center' as const,padding:'8px 0',fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,background:T.cyanBg,borderRadius:4}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:'95px',gap:1,background:T.border,borderRadius:12,overflow:'hidden'}}>
              {cells.map((cell,idx)=>{
                if(cell.type==='pad') return <div key={`p${idx}`} style={{background:dark?'rgba(255,255,255,0.01)':L.surf,opacity:.4,padding:'5px'}}><span style={{fontSize:11,color:T.dim}}>{cell.n}</span></div>
                const{day,date}=cell,isT=sameDay(date,today)
                const dj=jobsOn(date),dq=quotesOn(date),di=invoicesOn(date)
                const hasEvents=dj.length>0||dq.length>0||di.length>0
                const isSelected=selectedDate&&sameDay(date,selectedDate)
                return(
                  <div key={day} onClick={()=>setSelectedDate(isSelected?null:date)} style={{
                    background:isSelected?(dark?'rgba(93,235,241,0.12)':'rgba(14,165,233,0.1)'):isT?T.cyanBg:dark?D.surf:L.surf,
                    padding:'4px',borderTop:isSelected?`2px solid ${T.cyan}`:isT?`2px solid ${T.cyan}`:'2px solid transparent',
                    display:'flex',flexDirection:'column',overflow:'hidden',cursor:hasEvents?'pointer':'default',transition:'background .12s',
                  }}>
                    <div style={{fontSize:11,fontWeight:700,color:isT?T.cyan:T.dim,marginBottom:2,width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',background:isT?T.cyanBg:'transparent'}}>{day}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:2,flex:1,overflow:'hidden'}}>
                      {dj.slice(0,2).map(j=>(
                        <div key={j.id} style={{padding:'1px 4px',borderRadius:3,background:T.cyanBg,borderLeft:`2px solid ${T.cyan}`,fontSize:9,fontWeight:700,color:T.cyan,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fmtTime(j.checkoutTime)} {j.displayName}</div>
                      ))}
                      {dq.slice(0,1).map(q=>(
                        <div key={q.id} style={{padding:'1px 4px',borderRadius:3,background:q.submissionType==='instant_book'?D.amberBg:D.greenBg,borderLeft:`2px solid ${q.submissionType==='instant_book'?D.amber:D.green}`,fontSize:9,fontWeight:700,color:q.submissionType==='instant_book'?D.amber:D.green,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.client.firstName} {q.client.lastName.charAt(0)}.</div>
                      ))}
                      {di.slice(0,1).map(i=>(
                        <div key={i.id} style={{padding:'1px 4px',borderRadius:3,background:D.amberBg,borderLeft:`2px solid ${D.amber}`,fontSize:9,fontWeight:700,color:D.amber,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💰 {fmtMoney(i.amount)}</div>
                      ))}
                      {dj.length+dq.length+di.length>3&&<div style={{fontSize:8,color:T.dim,fontWeight:700}}>+{dj.length+dq.length+di.length-3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Day detail */}
          {selectedDate&&(
            <div style={{...card,padding:'18px',position:'sticky',top:24,maxHeight:'calc(100vh - 120px)',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:T.text}}>{selectedDate.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{selJobs.length} job{selJobs.length!==1?'s':''} · {selQuotes.length} quote{selQuotes.length!==1?'s':''} · {selInvoices.length} invoice{selInvoices.length!==1?'s':''}</div>
                </div>
                <button onClick={()=>setSelectedDate(null)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:13}}>×</button>
              </div>
              {selJobs.length>0&&<div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',color:T.cyan,marginBottom:8}}>Jobs</div>
                {selJobs.map(j=>(
                  <div key={j.id} onClick={()=>setSelectedJob(j)} style={{padding:'10px 12px',background:T.cyanBg,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6,cursor:'pointer'}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{j.displayName}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>{j.propertyLabel} · {fmtTime(j.checkoutTime)}</div>
                  </div>
                ))}
              </div>}
              {selQuotes.length>0&&<div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',color:D.green,marginBottom:8}}>Quotes</div>
                {selQuotes.map(q=>{const sc=STATUS[q.status]||STATUS.pending;return(
                  <div key={q.id} onClick={()=>openQuote(q)} style={{padding:'10px 12px',background:D.greenBg,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6,cursor:'pointer'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</span><span style={{fontSize:14,fontWeight:900,color:T.cyan}}>{fmtMoney(q.totalPrice)}</span></div>
                    <div style={{display:'flex',gap:6,marginTop:4}}><span style={{fontSize:10,color:T.muted}}>{q.serviceType}</span>{badge(sc.label,sc.color,sc.bg)}</div>
                  </div>
                )})}
              </div>}
              {selInvoices.length>0&&<div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',color:D.amber,marginBottom:8}}>Invoices Due</div>
                {selInvoices.map(i=>(
                  <div key={i.id} onClick={()=>openInvoice(i.id)} style={{padding:'10px 12px',background:D.amberBg,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6,cursor:'pointer'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,fontWeight:700,color:T.text}}>Invoice #{i.id.slice(-6)}</span><span style={{fontSize:14,fontWeight:900,color:D.amber}}>{fmtMoney(i.amount)}</span></div>
                  </div>
                ))}
              </div>}
              {selJobs.length===0&&selQuotes.length===0&&selInvoices.length===0&&<div style={{textAlign:'center',padding:'24px 0',color:T.dim,fontSize:12}}>No events on this day.</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPORTS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function ReportsPage(){
    // Monthly revenue data (last 6 months)
    const months:string[]=[];const monthRevenue:number[]=[];const monthQuotes:number[]=[]
    for(let i=5;i>=0;i--){
      const d=new Date();d.setMonth(d.getMonth()-i)
      const mName=d.toLocaleDateString('en-US',{month:'short'})
      months.push(mName)
      const mQuotes=quotes.filter(q=>{const qd=new Date(q.createdAt);return qd.getMonth()===d.getMonth()&&qd.getFullYear()===d.getFullYear()})
      monthQuotes.push(mQuotes.length)
      monthRevenue.push(mQuotes.filter(q=>q.status==='completed'||q.status==='booked').reduce((s,q)=>s+q.totalPrice,0))
    }
    const maxRev=Math.max(...monthRevenue,1)

    // Top clients
    const clientRevenue=clients.map(c=>{
      const cq=quotes.filter(q=>q.clientId===c.id&&(q.status==='completed'||q.status==='booked'))
      return{client:c,revenue:cq.reduce((s,q)=>s+q.totalPrice,0),count:cq.length}
    }).sort((a,b)=>b.revenue-a.revenue).slice(0,5)

    // Service breakdown
    const services:Record<string,{count:number;revenue:number}>={}
    quotes.forEach(q=>{
      if(!services[q.serviceType]) services[q.serviceType]={count:0,revenue:0}
      services[q.serviceType].count++
      if(q.status==='completed'||q.status==='booked') services[q.serviceType].revenue+=q.totalPrice
    })
    const serviceArr=Object.entries(services).sort((a,b)=>b[1].revenue-a[1].revenue)

    return(
      <div>
        <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text,marginBottom:4}}>Reports</h1>
        <p style={{fontSize:13,color:T.muted,marginBottom:24}}>Business performance overview</p>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {l:'Total Revenue',v:fmtMoney(totalRevenue),c:D.green},
            {l:'Avg Quote Value',v:fmtMoney(avgQuote),c:T.cyan},
            {l:'Conversion Rate',v:`${conversionRate}%`,c:D.amber},
            {l:'Active Clients',v:String(clients.filter(c=>quotes.some(q=>q.clientId===c.id)).length),c:D.violet},
          ].map(s=>(
            <div key={s.l} style={{...card,padding:'18px'}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:T.dim,marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:26,fontWeight:900,color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16}}>
          {/* Revenue Chart (CSS bars) */}
          <div style={{...card,padding:'22px'}}>
            {sectionHdr('Monthly Revenue','📊')}
            <div style={{display:'flex',gap:8,alignItems:'flex-end',height:180,paddingTop:10}}>
              {months.map((m,i)=>(
                <div key={m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.cyan}}>{monthRevenue[i]>0?fmtMoney(monthRevenue[i]):''}</div>
                  <div style={{width:'100%',maxWidth:50,borderRadius:'6px 6px 0 0',background:`linear-gradient(180deg,${T.cyan},${T.cyanD})`,height:`${Math.max(4,(monthRevenue[i]/maxRev)*140)}px`,transition:'height .3s',boxShadow:dark?`0 0 12px ${T.cyan}30`:undefined}}/>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim}}>{m}</div>
                  <div style={{fontSize:9,color:T.dim}}>{monthQuotes[i]} quotes</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Top Clients */}
            <div style={{...card,padding:'22px'}}>
              {sectionHdr('Top Clients','👥')}
              {clientRevenue.length===0?<div style={{color:T.dim,fontSize:12}}>No data yet.</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {clientRevenue.map((cr,i)=>(
                    <div key={cr.client.id} onClick={()=>openClient(cr.client)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:T.surf,border:`1px solid ${T.border}`,cursor:'pointer'}}>
                      <span style={{fontSize:12,fontWeight:800,color:T.dim,width:20}}>{i+1}.</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.text}}>{cr.client.firstName} {cr.client.lastName}</div>
                        <div style={{fontSize:10,color:T.dim}}>{cr.count} booking{cr.count!==1?'s':''}</div>
                      </div>
                      <span style={{fontSize:14,fontWeight:900,color:D.green}}>{fmtMoney(cr.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Service Breakdown */}
            <div style={{...card,padding:'22px'}}>
              {sectionHdr('Service Types','🏠')}
              {serviceArr.length===0?<div style={{color:T.dim,fontSize:12}}>No data yet.</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {serviceArr.map(([name,data])=>(
                    <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:8,background:T.surf,border:`1px solid ${T.border}`}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:T.text}}>{name}</div>
                        <div style={{fontSize:10,color:T.dim}}>{data.count} quote{data.count!==1?'s':''}</div>
                      </div>
                      <span style={{fontSize:13,fontWeight:800,color:T.cyan}}>{fmtMoney(data.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVITY PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function ActivityPage(){
    const [filter,setFilter]=useState<'all'|'quote'|'invoice'>('all')
    type Event = {id:string;type:'quote'|'invoice';title:string;desc:string;time:string;color:string;status:string}
    const events:Event[] = [
      ...quotes.map(q=>({id:q.id,type:'quote' as const,title:`${q.client.firstName} ${q.client.lastName}`,desc:`${q.serviceType} · ${fmtMoney(q.totalPrice)}`,time:q.createdAt,color:(STATUS[q.status]||STATUS.pending).color,status:q.status})),
      ...invoices.map(i=>({id:i.id,type:'invoice' as const,title:`Invoice #${i.id.slice(-6)}`,desc:fmtMoney(i.amount),time:i.createdAt,color:(INV_STATUS[i.status]||INV_STATUS.draft).color,status:i.status})),
    ].filter(e=>filter==='all'||e.type===filter)
    .sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime())

    return(
      <div>
        <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text,marginBottom:4}}>Activity</h1>
        <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Timeline of all business activity</p>
        <div style={{display:'flex',gap:3,background:T.surf,borderRadius:9,padding:3,border:`1px solid ${T.border}`,marginBottom:20,width:'fit-content'}}>
          {([['all','All'],['quote','Quotes'],['invoice','Invoices']] as const).map(([f,label])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:filter===f?T.cyanBg:'transparent',color:filter===f?T.cyan:T.dim,fontFamily:'Inter,sans-serif'}}>{label}</button>
          ))}
        </div>
        {events.length===0?<div style={{textAlign:'center',padding:'60px 0',color:T.dim}}>No activity yet.</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:0,position:'relative',paddingLeft:24}}>
            <div style={{position:'absolute',left:7,top:8,bottom:8,width:2,background:T.border}}/>
            {events.map(ev=>(
              <div key={ev.id+ev.type} onClick={()=>ev.type==='quote'?openQuote(quotes.find(q=>q.id===ev.id)!):openInvoice(ev.id)} style={{display:'flex',gap:14,padding:'12px 0',cursor:'pointer',position:'relative'}}>
                <div style={{width:16,height:16,borderRadius:'50%',background:ev.color,border:`3px solid ${dark?D.bg:L.bg}`,flexShrink:0,position:'absolute',left:-24,top:16,zIndex:1}}/>
                <div style={{flex:1,paddingLeft:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{fontSize:13,fontWeight:700,color:T.text}}>{ev.title}</span>
                    {badge(ev.type==='quote'?'Quote':'Invoice',ev.type==='quote'?T.cyan:D.amber,ev.type==='quote'?T.cyanBg:D.amberBg)}
                    {badge(ev.status,ev.color,`${ev.color}18`)}
                  </div>
                  <div style={{fontSize:12,color:T.muted}}>{ev.desc}</div>
                  <div style={{fontSize:10,color:T.dim,marginTop:2}}>{fmtRel(ev.time)} · {fmtDate(ev.time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATIONS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function IntegrationsPage(){
    const [jobberAccts,setJobberAccts]=useState<any[]>([])
    const [hostawayAccts,setHostawayAccts]=useState<any[]>([])
    const [gmailAccts,setGmailAccts]=useState<any[]>([])
    const [syncing,setSyncing]=useState<string|null>(null)
    const [msg,setMsg]=useState<string|null>(null)
    useEffect(()=>{
      fetch('/api/jobber/accounts').then(r=>r.json()).then(d=>setJobberAccts(Array.isArray(d)?d:[])).catch(()=>{})
      fetch('/api/hostaway/accounts').then(r=>r.json()).then(d=>setHostawayAccts(Array.isArray(d)?d:[])).catch(()=>{})
      fetch('/api/gmail/accounts').then(r=>r.json()).then(d=>setGmailAccts(Array.isArray(d)?d:[])).catch(()=>{})
    },[])
    async function syncJobber(){setSyncing('jobber');setMsg(null);const r=await fetch('/api/jobber/sync',{method:'POST'});const d=await r.json();if(d.error?.includes('NEEDS_RECONNECT'))setMsg('⚠ Jobber token expired — reconnect');else{setMsg(`✓ Synced — ${d.imported??0} new jobs`);load()};setSyncing(null)}
    async function syncHostaway(){setSyncing('hostaway');setMsg(null);const r=await fetch('/api/hostaway/sync',{method:'POST'});const d=await r.json();const t=Array.isArray(d)?d.reduce((s:number,x:any)=>s+(x.imported||0),0):0;setMsg(`✓ Synced — ${t} new jobs`);load();setSyncing(null)}
    async function connectJobber(){const r=await fetch('/api/jobber/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    async function connectGmail(){const r=await fetch('/api/gmail/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    const icard:React.CSSProperties={...card,padding:'20px'}
    const intList = [
      {name:'Booking Form',icon:'🧹',desc:'Quotes sync automatically when clients submit',status:'live',color:T.cyan,type:'booking'},
      {name:'Hostaway',icon:'🔑',desc:'iCal calendar sync',status:hostawayAccts.length>0?'connected':'available',color:'#fb8500',type:'hostaway'},
      {name:'Jobber',icon:'💼',desc:'Sync scheduled visits & events',status:jobberAccts.length>0?'connected':'available',color:'#00c4ff',type:'jobber'},
      {name:'Gmail',icon:'✉️',desc:'Email integration',status:gmailAccts.length>0?'connected':'available',color:'#ea4335',type:'gmail'},
      {name:'Stripe',icon:'💳',desc:'Payment processing (Test Mode)',status:'connected',color:'#635bff',type:'stripe'},
      {name:'QuickBooks',icon:'📊',desc:'Accounting sync',status:'coming',color:'#2ca01c',type:'qb'},
      {name:'Google Calendar',icon:'📅',desc:'Two-way calendar sync',status:'coming',color:'#4285f4',type:'gcal'},
      {name:'Zapier',icon:'⚡',desc:'Automate workflows',status:'coming',color:'#ff4a00',type:'zapier'},
    ]
    return(
      <div>
        <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text,marginBottom:4}}>Integrations</h1>
        <p style={{fontSize:13,color:T.muted,marginBottom:20}}>Connect your platforms and tools</p>
        {msg&&<div style={{marginBottom:16,padding:'10px 14px',borderRadius:8,fontSize:12,background:msg.startsWith('✓')?D.greenBg:D.amberBg,color:msg.startsWith('✓')?D.green:D.amber,border:`1px solid ${msg.startsWith('✓')?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}`}}>{msg}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {intList.map(intg=>(
            <div key={intg.name} style={icard}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${intg.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,border:`1px solid ${intg.color}25`,flexShrink:0}}>{intg.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text}}>{intg.name}</div>
                  <div style={{fontSize:11,color:T.muted}}>{intg.desc}</div>
                </div>
                {badge(
                  intg.status==='connected'?'Connected':intg.status==='live'?'Live':intg.status==='coming'?'Coming Soon':'Available',
                  intg.status==='connected'||intg.status==='live'?D.green:intg.status==='coming'?T.dim:T.cyan,
                  intg.status==='connected'||intg.status==='live'?D.greenBg:intg.status==='coming'?T.cyanBg:T.cyanBg
                )}
              </div>
              {/* Connected accounts */}
              {intg.type==='hostaway'&&hostawayAccts.length>0&&<div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>{hostawayAccts.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.surf,borderRadius:7,border:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.text,fontWeight:600}}>{a.name}</span><span style={{color:T.dim}}>#{a.listingId}</span></div>)}</div>}
              {intg.type==='jobber'&&jobberAccts.length>0&&<div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>{jobberAccts.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.surf,borderRadius:7,border:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.text,fontWeight:600}}>{a.companyName||a.email}</span><span style={{color:T.dim}}>{fmtRel(a.lastSynced)}</span></div>)}</div>}
              {intg.type==='gmail'&&gmailAccts.length>0&&<div style={{marginBottom:10,display:'flex',flexDirection:'column',gap:4}}>{gmailAccts.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:T.surf,borderRadius:7,border:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.text,fontWeight:600}}>{a.email}</span></div>)}</div>}
              {intg.type==='booking'&&<div style={{fontSize:12,color:T.muted,padding:'10px 12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>{quotes.length} quotes received · {pending.length} pending</div>}
              {/* Action buttons */}
              {intg.type==='hostaway'&&<button onClick={syncHostaway} disabled={syncing==='hostaway'} style={{width:'100%',padding:'9px',borderRadius:9,border:`1px solid ${intg.color}40`,background:`${intg.color}12`,color:intg.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{syncing==='hostaway'?'Syncing...':'⟳ Sync Hostaway'}</button>}
              {intg.type==='jobber'&&<div style={{display:'flex',gap:6}}>
                {jobberAccts.length>0&&<button onClick={syncJobber} disabled={!!syncing} style={{flex:1,padding:'9px',borderRadius:9,border:`1px solid ${intg.color}40`,background:`${intg.color}12`,color:intg.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{syncing==='jobber'?'Syncing...':'⟳ Sync'}</button>}
                <button onClick={connectJobber} style={{flex:1,padding:'9px',borderRadius:9,border:`1px solid ${intg.color}40`,background:`${intg.color}12`,color:intg.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{jobberAccts.length>0?'+ Another':'Connect'}</button>
              </div>}
              {intg.type==='gmail'&&<button onClick={connectGmail} style={{width:'100%',padding:'9px',borderRadius:9,border:`1px solid ${intg.color}40`,background:`${intg.color}12`,color:intg.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{gmailAccts.length>0?'+ Another':'Connect Gmail'}</button>}
              {intg.status==='coming'&&<div style={{padding:'8px',textAlign:'center',fontSize:11,color:T.dim,fontWeight:600}}>Coming Soon</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  function SettingsPage(){
    return(
      <div style={{maxWidth:700}}>
        <h1 style={{fontFamily:'Inter,sans-serif',fontSize:24,fontWeight:900,color:T.text,marginBottom:24}}>Settings</h1>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Account */}
          <div style={{...card,padding:'22px'}}>
            {sectionHdr('Account','👤')}
            {[{l:'Name',v:user!.name},{l:'Email',v:user!.email},{l:'Role',v:'Cleaner'},{l:'Phone',v:user!.phone||'Not set'},{l:'Company',v:user!.company||'Not set'}].map(f=>(
              <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:12,color:T.dim,fontWeight:600}}>{f.l}</span>
                <span style={{fontSize:12,color:T.text,fontWeight:700}}>{f.v}</span>
              </div>
            ))}
          </div>
          {/* Business */}
          <div style={{...card,padding:'22px'}}>
            {sectionHdr('Business Profile','🏢')}
            <div style={{padding:'14px',background:T.cyanBg,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted}}>
              Business profile editing, custom branding, notification preferences, and more settings coming soon.
            </div>
          </div>
          {/* Notifications */}
          <div style={{...card,padding:'22px'}}>
            {sectionHdr('Notifications','🔔')}
            {['New quote received','Quote status changes','Invoice payment received','Daily summary email'].map(item=>(
              <div key={item} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:13,color:T.muted}}>{item}</span>
                <div style={{width:36,height:20,borderRadius:10,background:T.cyanBg,border:`1px solid ${T.borderB}`,position:'relative',cursor:'pointer'}}>
                  <div style={{width:14,height:14,borderRadius:'50%',background:T.cyan,position:'absolute',right:3,top:2}}/>
                </div>
              </div>
            ))}
          </div>
          {/* Danger */}
          <div style={{...card,padding:'22px'}}>
            {sectionHdr('Account','🔒')}
            <button onClick={logout} style={{padding:'10px 20px',borderRadius:8,background:D.redBg,color:D.red,border:'1px solid rgba(239,68,68,0.3)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Sign Out</button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // JOB DETAIL MODAL
  // ══════════════════════════════════════════════════════════════════════════
  function JobModal(){
    if(!selectedJob) return null
    const j=selectedJob
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelectedJob(null)}>
        <div style={{background:dark?'rgba(2,8,30,0.98)':'#ffffff',border:dark?`1px solid ${D.borderB}`:`1px solid ${L.borderB}`,borderRadius:18,width:'100%',maxWidth:440,boxShadow:dark?'0 30px 80px rgba(0,0,0,0.7)':'0 20px 60px rgba(0,0,0,0.15)',padding:'24px'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:T.text}}>{j.displayName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:3}}>{j.propertyLabel}</div>
            </div>
            <button onClick={()=>setSelectedJob(null)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>
          {[
            {l:'Platform',v:j.platform,icon:'🔌'},{l:'Address',v:j.address||'—',icon:'📍'},
            {l:'Checkout',v:`${fmtDate(j.checkoutTime)} at ${fmtTime(j.checkoutTime)}`,icon:'📅'},
            {l:'Check-in',v:j.checkinTime?`${fmtDate(j.checkinTime)} at ${fmtTime(j.checkinTime)}`:'—',icon:'🏠'},
            {l:'Guest',v:j.customerName||'—',icon:'👤'},
          ].map(f=>(
            <div key={f.l} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14}}>{f.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1}}>{f.l}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:1}}>{f.v}</div>
              </div>
            </div>
          ))}
          {j.notes&&<div style={{marginTop:12,padding:'10px 12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted}}>{j.notes}</div>}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NAVIGATION & LAYOUT
  // ══════════════════════════════════════════════════════════════════════════
  const NAV_ITEMS:[Page,string,string,number?][]=[
    ['dashboard','◉','Dashboard'],
    ['quotes','📋','Quotes',pending.length||undefined],
    ['jobs','🗓','Jobs',upcoming.length||undefined],
    ['clients','👤','Clients'],
    ['invoices','💰','Invoices',invoices.filter(i=>i.status==='sent').length||undefined],
    ['calendar','📅','Calendar'],
    ['reports','📊','Reports'],
    ['activity','⏱','Activity'],
    ['integrations','🔗','Integrations'],
    ['settings','⚙️','Settings'],
  ]

  // Determine which nav item is active
  const activeNav = (['quote-detail','create-quote'].includes(page)?'quotes'
    :(['create-job'].includes(page)?'jobs'
    :(['create-client','client-detail'].includes(page)?'clients'
    :(['create-invoice','invoice-detail'].includes(page)?'invoices'
    :page)))) as Page

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:T.bg,fontFamily:'Inter,-apple-system,sans-serif',backgroundImage:dark?'radial-gradient(circle at 20% 30%,rgba(5,53,116,0.45) 0%,transparent 50%),radial-gradient(circle at 80% 70%,rgba(10,79,168,0.35) 0%,transparent 40%)':'none'}}>

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

        {/* Nav Items */}
        <div style={{flex:1,padding:'10px 7px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
          {NAV_ITEMS.map(([id,icon,label,badgeNum])=>{
            const active = activeNav===id
            return(
              <button key={id} onClick={()=>setPage(id)} style={{display:'flex',alignItems:'center',gap:10,padding:collapsed?'10px':'9px 11px',borderRadius:9,border:'none',cursor:'pointer',background:active?'rgba(93,235,241,0.12)':'transparent',color:active?'#5debf1':'rgba(255,255,255,0.5)',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:active?700:500,transition:'all .14s',textAlign:'left',width:'100%',justifyContent:collapsed?'center':'flex-start',position:'relative'}}>
                <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
                {!collapsed&&<span style={{flex:1,whiteSpace:'nowrap'}}>{label}</span>}
                {!collapsed&&badgeNum!=null&&badgeNum>0&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:'#f59e0b',color:'#000',fontWeight:800,minWidth:16,textAlign:'center'}}>{badgeNum}</span>}
                {active&&<div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:20,borderRadius:'0 2px 2px 0',background:'#5debf1'}}/>}
              </button>
            )
          })}
        </div>

        {/* Bottom controls */}
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

      {/* MAIN CONTENT */}
      <main style={{flex:1,overflowY:'auto',padding:24}}>
        {page==='dashboard'       &&<DashboardPage/>}
        {page==='quotes'          &&<QuotesPage/>}
        {page==='quote-detail'    &&<QuoteDetailPage/>}
        {page==='create-quote'    &&<CreateQuotePage/>}
        {page==='jobs'            &&<JobsPage/>}
        {page==='create-job'      &&<CreateJobPage/>}
        {page==='clients'         &&<ClientsPage/>}
        {page==='create-client'   &&<CreateClientPage/>}
        {page==='client-detail'   &&<ClientDetailPage/>}
        {page==='invoices'        &&<InvoicesPage/>}
        {page==='create-invoice'  &&<CreateInvoicePage/>}
        {page==='invoice-detail'  &&<InvoiceDetailPage/>}
        {page==='calendar'        &&<CalendarPage/>}
        {page==='reports'         &&<ReportsPage/>}
        {page==='activity'        &&<ActivityPage/>}
        {page==='integrations'    &&<IntegrationsPage/>}
        {page==='settings'        &&<SettingsPage/>}
      </main>

      {/* MODALS */}
      {selectedJob&&<JobModal/>}

      {/* TOAST */}
      {toast&&(
        <div style={{position:'fixed',bottom:24,right:24,padding:'12px 20px',borderRadius:12,background:toast.type==='ok'?'rgba(16,185,129,0.95)':'rgba(239,68,68,0.95)',color:'#fff',fontSize:13,fontWeight:700,fontFamily:'Inter,sans-serif',boxShadow:'0 8px 30px rgba(0,0,0,0.3)',zIndex:300,animation:'slideUp .2s ease-out'}}>
          {toast.type==='ok'?'✓ ':'✗ '}{toast.msg}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(93,235,241,0.2);border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(93,235,241,0.4);}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  )
}
