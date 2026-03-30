'use client'
// CleanSync Pro · Cleaner Portal v6 — Refined Slate Design
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── TYPES ─────────────────────────────────────────────────────────────
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
  duties: string; cleanerIds: string; propertyId?: string | null
}
interface Invoice {
  id: string; jobId: string | null; fromId: string; toId: string
  amount: number; tax: number; status: string; dueDate: string | null
  paidAt: string | null; notes: string | null; lineItems: string
  createdAt: string; updatedAt: string; from?: User; to?: User
}
type Page = 'dashboard'|'quotes'|'quote-detail'|'create-quote'|'jobs'|'create-job'|'convert-to-job'
  |'clients'|'create-client'|'client-detail'|'invoices'|'create-invoice'|'invoice-detail'
  |'calendar'|'reports'|'activity'|'integrations'|'settings'

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────
// Dark: Warm slate with blue accent. Light: Clean white with deep blue.
const D = {
  bg:'#0f1117', nav:'#0b0e14', card:'#161a22', cardHover:'#1c2028',
  surf:'#1a1e26', surfHover:'#22262e',
  border:'rgba(255,255,255,0.06)', borderB:'rgba(255,255,255,0.1)', borderHover:'rgba(255,255,255,0.14)',
  text:'#eceef2', sub:'#b4b9c4', muted:'#7c8294', dim:'#4a4f5e',
  accent:'#38bdf8', accentSoft:'#0ea5e9', accentBg:'rgba(56,189,248,0.08)', accentBorder:'rgba(56,189,248,0.18)',
  green:'#34d399', greenBg:'rgba(52,211,153,0.1)',
  amber:'#fbbf24', amberBg:'rgba(251,191,36,0.1)',
  red:'#f87171', redBg:'rgba(248,113,113,0.08)',
  violet:'#a78bfa', violetBg:'rgba(167,139,250,0.08)',
  rose:'#fb7185', roseBg:'rgba(251,113,133,0.08)',
  shadow:'0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',
  shadowLg:'0 4px 24px rgba(0,0,0,0.4)',
}
const L = {
  bg:'#f5f7fa', nav:'#0f2b42', card:'#ffffff', cardHover:'#f7f9fc',
  surf:'#f0f2f5', surfHover:'#e6e9ee',
  border:'rgba(0,0,0,0.07)', borderB:'rgba(0,0,0,0.12)', borderHover:'rgba(2,132,199,0.3)',
  text:'#111827', sub:'#1e3a5f', muted:'#5b7083', dim:'#94a3b8',
  accent:'#0284c7', accentSoft:'#0369a1', accentBg:'rgba(2,132,199,0.07)', accentBorder:'rgba(2,132,199,0.2)',
  green:'#059669', greenBg:'rgba(5,150,105,0.08)',
  amber:'#d97706', amberBg:'rgba(217,119,6,0.08)',
  red:'#dc2626', redBg:'rgba(220,38,38,0.07)',
  violet:'#7c3aed', violetBg:'rgba(124,58,237,0.07)',
  rose:'#e11d48', roseBg:'rgba(225,29,72,0.07)',
  shadow:'0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
  shadowLg:'0 4px 20px rgba(0,0,0,0.1)',
}

const STATUS: Record<string,{label:string;color:string;bg:string}> = {
  pending:{label:'Pending',color:'#fbbf24',bg:'rgba(251,191,36,0.12)'},
  reviewed:{label:'Reviewed',color:'#38bdf8',bg:'rgba(56,189,248,0.12)'},
  booked:{label:'Booked',color:'#34d399',bg:'rgba(52,211,153,0.12)'},
  completed:{label:'Completed',color:'#a78bfa',bg:'rgba(167,139,250,0.12)'},
  cancelled:{label:'Cancelled',color:'#f87171',bg:'rgba(248,113,113,0.12)'},
}
const INV_STATUS: Record<string,{label:string;color:string;bg:string}> = {
  draft:{label:'Draft',color:'#94a3b8',bg:'rgba(148,163,184,0.1)'},
  sent:{label:'Sent',color:'#fbbf24',bg:'rgba(251,191,36,0.12)'},
  paid:{label:'Paid',color:'#34d399',bg:'rgba(52,211,153,0.12)'},
  overdue:{label:'Overdue',color:'#f87171',bg:'rgba(248,113,113,0.12)'},
  cancelled:{label:'Cancelled',color:'#6b7280',bg:'rgba(107,114,128,0.1)'},
}

function fmtDate(d:string|null){if(!d)return'—';return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtTime(d:string){return new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function fmtRel(d:string|null){if(!d)return'Never';const m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return'Just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`}
function fmtMoney(n:number){return`$${n.toFixed(2)}`}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
const SERVICE_TYPES=['Standard Clean','Deep Clean','Move-In/Move-Out','Airbnb Turnover','Office Clean','Post-Construction','Custom']
const FREQUENCIES=['One-Time','Weekly','Bi-Weekly','Every 3 Weeks','Monthly','As Needed']

export default function CleanerDashboard() {
  const router = useRouter()
  const [user,setUser]=useState<User|null>(null)
  const [dark,setDark]=useState(true)
  const [page,setPage]=useState<Page>('dashboard')
  const [quotes,setQuotes]=useState<Quote[]>([])
  const [clients,setClients]=useState<QuoteClient[]>([])
  const [jobs,setJobs]=useState<Job[]>([])
  const [invoices,setInvoices]=useState<Invoice[]>([])
  const [loading,setLoading]=useState(true)
  const [collapsed,setCollapsed]=useState(false)
  const [activeQuoteId,setActiveQuoteId]=useState<string|null>(null)
  const [activeInvoiceId,setActiveInvoiceId]=useState<string|null>(null)
  const [activeClientId,setActiveClientId]=useState<string|null>(null)
  const [selectedJob,setSelectedJob]=useState<Job|null>(null)
  const [toast,setToast]=useState<{msg:string;type:'ok'|'err'}|null>(null)
  const T=dark?D:L
  const showToast=(msg:string,type:'ok'|'err'='ok')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)}

  // Auth + data
  useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(!d.user){router.push('/login');return};if(d.user.role==='provider'){router.replace('/dashboard/provider');return};setUser(d.user)})},[router])
  const load=useCallback(async()=>{const [qr,cr,jr,ir]=await Promise.all([fetch('/api/quotes'),fetch('/api/quote-clients'),fetch('/api/jobs'),fetch('/api/invoices')]);const [q,c,j,i]=await Promise.all([qr.json(),cr.json(),jr.json(),ir.json().catch(()=>[])]);setQuotes(Array.isArray(q)?q:[]);setClients(Array.isArray(c)?c:[]);setJobs(Array.isArray(j)?j:[]);setInvoices(Array.isArray(i)?i:[]);setLoading(false)},[])
  useEffect(()=>{if(user)load()},[user,load])
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}

  // Operations
  async function updateQuoteStatus(id:string,status:string){await fetch(`/api/quotes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});await load();showToast(`Quote ${status}`)}
  async function deleteQuote(id:string){await fetch(`/api/quotes/${id}`,{method:'DELETE'});await load();if(activeQuoteId===id){setActiveQuoteId(null);setPage('quotes')};showToast('Deleted')}
  async function saveQuote(id:string,data:Record<string,any>){await fetch(`/api/quotes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});await load();showToast('Saved')}
  async function createQuote(data:Record<string,any>){const r=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();await load();if(d.quoteId){setActiveQuoteId(d.quoteId);setPage('quote-detail');showToast('Quote created')};return d}
  async function sendQuoteEmail(id:string){const r=await fetch(`/api/quotes/${id}/email`,{method:'POST'});const d=await r.json();if(r.ok){await load();showToast('Email sent')}else showToast(d.error||'Failed','err');return r.ok}
  async function createClient(data:Record<string,any>){const r=await fetch('/api/quote-clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();await load();if(d.id){showToast('Client created');return d};showToast(d.error||'Failed','err');return null}
  async function createInvoice(data:Record<string,any>){const r=await fetch('/api/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();await load();if(d.id){setActiveInvoiceId(d.id);setPage('invoice-detail');showToast('Invoice created')};return d}
  async function updateInvoice(id:string,data:Record<string,any>){await fetch(`/api/invoices/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});await load();showToast('Updated')}
  async function deleteInvoice(id:string){await fetch(`/api/invoices/${id}`,{method:'DELETE'});await load();if(activeInvoiceId===id){setActiveInvoiceId(null);setPage('invoices')};showToast('Deleted')}
  function convertToJob(qid:string){setActiveQuoteId(qid);setPage('convert-to-job')}
  async function createPaymentLink(iid:string){const r=await fetch(`/api/invoices/${iid}/payment-link`,{method:'POST'});const d=await r.json();if(r.ok&&d.url){window.open(d.url,'_blank');await load();showToast('Payment link opened')}else showToast(d.error||'Failed','err')}
  function openQuote(q:Quote){setActiveQuoteId(q.id);setPage('quote-detail')}
  function openClient(c:QuoteClient){setActiveClientId(c.id);setPage('client-detail')}
  function openInvoice(id:string){setActiveInvoiceId(id);setPage('invoice-detail')}

  // Loading
  if(!user||loading) return(
    <div style={{minHeight:'100vh',background:D.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:36,height:36,border:'2px solid rgba(255,255,255,0.08)',borderTopColor:D.accent,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <div style={{color:D.muted,fontFamily:'"Inter",sans-serif',fontSize:11,fontWeight:500,letterSpacing:2,textTransform:'uppercase'}}>CleanSync</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Computed
  const pending=quotes.filter(q=>q.status==='pending')
  const booked=quotes.filter(q=>q.status==='booked')
  const completed=quotes.filter(q=>q.status==='completed')
  const upcoming=jobs.filter(j=>new Date(j.checkoutTime)>=new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
  const totalRevenue=completed.reduce((s,q)=>s+q.totalPrice,0)+invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0)
  const conversionRate=quotes.length>0?Math.round((booked.length+completed.length)/quotes.length*100):0
  const avgQuote=quotes.length>0?quotes.reduce((s,q)=>s+q.totalPrice,0)/quotes.length:0

  // ── Design Primitives ───────────────────────────────────────────────
  const card:React.CSSProperties={background:T.card,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:T.shadow,transition:'all .15s'}
  const inp:React.CSSProperties={width:'100%',background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 13px',color:T.text,fontFamily:'"Inter",sans-serif',fontSize:13,fontWeight:400,outline:'none',transition:'border-color .15s'}
  const btnP:React.CSSProperties={padding:'9px 20px',borderRadius:8,border:'none',background:T.accent,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'"Inter",sans-serif',transition:'opacity .12s'}
  const btnS:React.CSSProperties={padding:'9px 16px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.sub,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'"Inter",sans-serif',transition:'all .12s'}
  const label=(t:string)=>(<div style={{fontSize:11,fontWeight:500,color:T.muted,marginBottom:6,letterSpacing:0.2}}>{t}</div>)
  const badge=(l:string,c:string,bg:string)=>(<span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,color:c,background:bg,letterSpacing:0.1}}>{l}</span>)
  const hdr=(t:string)=>(<div style={{fontSize:11,fontWeight:600,letterSpacing:0.5,textTransform:'uppercase' as const,color:T.dim,marginBottom:14}}>{t}</div>)
  const avatar=(init:string,sz=38)=>(<div style={{width:sz,height:sz,borderRadius:sz*.26,background:T.accentBg,border:`1px solid ${T.accentBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:sz*.36,fontWeight:600,color:T.accent,flexShrink:0}}>{init}</div>)
  const pageWrap=(mw:number,ch:React.ReactNode)=>(<div style={{maxWidth:mw,margin:'0 auto'}}>{ch}</div>)
  const pageTitle=(t:string,s?:string,r?:React.ReactNode)=>(<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,gap:16,flexWrap:'wrap'}}><div><h1 style={{fontSize:21,fontWeight:700,color:T.text,letterSpacing:-0.3}}>{t}</h1>{s&&<p style={{fontSize:13,color:T.muted,marginTop:4}}>{s}</p>}</div>{r&&<div style={{display:'flex',gap:8,alignItems:'center'}}>{r}</div>}</div>)
  const hover=(e:React.MouseEvent<HTMLDivElement>,on:boolean)=>{const d=e.currentTarget;d.style.borderColor=on?T.borderHover:T.border;d.style.background=on?T.cardHover:T.card}

  // ══════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  function DashboardPage(){
    const PLAT:Record<string,string>={hostaway:'#f59e0b',jobber:'#3b82f6',manual:'#6366f1',airbnb:'#ef4444'}
    return(<div style={{maxWidth:1060,margin:'0 auto'}}>
      {/* Welcome */}
      <div style={{...card,padding:'24px 28px',marginBottom:24,background:dark?'linear-gradient(135deg,#161a24,#1a1e28)':'linear-gradient(135deg,#e8f4fd,#dbeafe)',borderColor:dark?T.border:'rgba(2,132,199,0.15)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:dark?T.text:'#0c4a6e'}}>Welcome back, {user!.name.split(' ')[0]}</div>
            <div style={{fontSize:13,color:T.muted,marginTop:4}}>{pending.length>0?`${pending.length} pending quote${pending.length>1?'s':''} · `:''}Today is {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
          </div>
          <div style={{display:'flex',gap:8}}><button onClick={()=>setPage('create-quote')} style={btnP}>New Quote</button><button onClick={()=>setPage('create-invoice')} style={{...btnP,background:T.green}}>New Invoice</button></div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:24}}>
        {[{l:'Pending',v:String(pending.length),c:T.amber,p:'quotes' as Page},{l:'Booked',v:String(booked.length),c:T.green,p:'quotes' as Page},{l:'Clients',v:String(clients.length),c:T.accent,p:'clients' as Page},{l:'Jobs',v:String(upcoming.length),c:T.violet,p:'jobs' as Page},{l:'Revenue',v:fmtMoney(totalRevenue),c:T.rose,p:'reports' as Page}].map(s=>(
          <div key={s.l} onClick={()=>setPage(s.p)} style={{...card,padding:'16px',cursor:'pointer'}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
            <div style={{fontSize:11,fontWeight:500,color:T.muted,marginBottom:6}}>{s.l}</div>
            <div style={{fontSize:s.l==='Revenue'?18:24,fontWeight:700,color:s.c,letterSpacing:-0.5}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {pending.length>0&&<div onClick={()=>setPage('quotes')} style={{...card,padding:'14px 18px',marginBottom:20,cursor:'pointer',borderLeft:`3px solid ${T.amber}`,display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
        <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{pending.length} quote{pending.length>1?'s':''} awaiting review</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{pending.filter(q=>q.submissionType==='instant_book').length>0?`Including ${pending.filter(q=>q.submissionType==='instant_book').length} instant book`:''} Tap to review</div></div>
        <span style={{color:T.muted,fontSize:16}}>→</span>
      </div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
        {/* Upcoming Jobs */}
        <div>{hdr('Upcoming Jobs')}
          {upcoming.length===0?<div style={{color:T.dim,fontSize:13,padding:'28px 0',textAlign:'center'}}>No upcoming jobs.</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {upcoming.slice(0,8).map(j=>{const pc=PLAT[j.platform]||T.accent;return(
                <div key={j.id} onClick={()=>setSelectedJob(j)} style={{...card,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
                  <div style={{width:3,height:30,borderRadius:2,background:pc,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.displayName}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{j.propertyLabel}</div></div>
                  <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:12,fontWeight:600,color:T.accent}}>{fmtDate(j.checkoutTime)}</div><div style={{fontSize:10,color:T.dim}}>{fmtTime(j.checkoutTime)}</div></div>
                </div>
              )})}
              {upcoming.length>8&&<button onClick={()=>setPage('jobs')} style={{fontSize:12,color:T.accent,background:'none',border:'none',cursor:'pointer',fontWeight:600,textAlign:'center',padding:'8px'}}>View all {upcoming.length} jobs →</button>}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{...card,padding:'16px'}}>{hdr('Pending Quotes')}
            {pending.length===0?<div style={{color:T.dim,fontSize:12}}>No pending.</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {pending.slice(0,5).map(q=>(
                  <div key={q.id} onClick={()=>openQuote(q)} style={{padding:'9px 10px',borderRadius:8,background:T.surf,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8,cursor:'pointer',transition:'all .12s'}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=T.surfHover}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=T.surf}}>
                    {avatar(q.client.firstName.charAt(0),30)}
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>{q.client.firstName} {q.client.lastName}</div><div style={{fontSize:10,color:T.dim}}>{q.serviceType}</div></div>
                    <span style={{fontSize:13,fontWeight:700,color:T.accent,flexShrink:0}}>{fmtMoney(q.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{...card,padding:'16px'}}>{hdr('Quick Actions')}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[{l:'New Quote',p:'create-quote' as Page},{l:'Add Client',p:'create-client' as Page},{l:'Invoice',p:'create-invoice' as Page},{l:'Add Job',p:'create-job' as Page}].map(a=>(
                <button key={a.l} onClick={()=>setPage(a.p)} style={{padding:'10px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,fontWeight:500,color:T.sub,fontFamily:'"Inter",sans-serif',transition:'all .1s',textAlign:'center'}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.surf;(e.currentTarget as HTMLButtonElement).style.borderColor=T.borderHover}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent';(e.currentTarget as HTMLButtonElement).style.borderColor=T.border}}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>
          <div style={{...card,padding:'16px'}}>{hdr('Snapshot')}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[{l:'Conversion',v:`${conversionRate}%`,c:T.green},{l:'Avg Quote',v:fmtMoney(avgQuote),c:T.accent},{l:'Due',v:String(invoices.filter(i=>i.status==='sent').length),c:T.amber},{l:'This Mo.',v:fmtMoney(quotes.filter(q=>new Date(q.createdAt).getMonth()===new Date().getMonth()&&q.status==='completed').reduce((s,q)=>s+q.totalPrice,0)),c:T.rose}].map(s=>(
                <div key={s.l} style={{background:T.surf,borderRadius:8,padding:'10px'}}><div style={{fontSize:10,fontWeight:500,color:T.dim}}>{s.l}</div><div style={{fontSize:15,fontWeight:700,color:s.c,marginTop:2}}>{s.v}</div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // QUOTES — master-detail
  // ══════════════════════════════════════════════════════════════════════
  function QuotesPage(){
    const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[prevId,setPrevId]=useState<string|null>(null)
    const filtered=quotes.filter(q=>filter==='all'||q.status===filter).filter(q=>!search||`${q.client.firstName} ${q.client.lastName} ${q.client.email} ${q.serviceType}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())
    const preview=prevId?quotes.find(q=>q.id===prevId):filtered[0]||null
    return(<div>
      {pageTitle('Quotes',`${quotes.length} total · ${pending.length} pending`,<button onClick={()=>setPage('create-quote')} style={btnP}>New Quote</button>)}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:2,background:T.surf,borderRadius:8,padding:2,border:`1px solid ${T.border}`}}>
          {['all','pending','reviewed','booked','completed','cancelled'].map(s=><button key={s} onClick={()=>{setFilter(s);setPrevId(null)}} style={{padding:'6px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:filter===s?600:400,background:filter===s?T.card:'transparent',color:filter===s?T.text:T.muted,fontFamily:'"Inter",sans-serif',textTransform:'capitalize' as const,boxShadow:filter===s?T.shadow:'none'}}>{s}</button>)}
        </div>
        <input style={{...inp,flex:1,minWidth:160,maxWidth:260}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      {filtered.length===0?<div style={{textAlign:'center',padding:'48px 0',color:T.dim}}>No quotes match.</div>:(
        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:14,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:'calc(100vh - 200px)',overflowY:'auto',paddingRight:4}}>
            {filtered.map(q=>{const sc=STATUS[q.status]||STATUS.pending,isIB=q.submissionType==='instant_book',sel=preview?.id===q.id;return(
              <div key={q.id} onClick={()=>setPrevId(q.id)} style={{...card,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,borderColor:sel?T.borderHover:T.border,background:sel?T.cardHover:T.card}} onMouseEnter={e=>{if(!sel)hover(e,true)}} onMouseLeave={e=>{if(!sel)hover(e,false)}}>
                {avatar(q.client.firstName.charAt(0),34)}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,display:'flex',alignItems:'center',gap:6}}>{q.client.firstName} {q.client.lastName}{isIB&&<span style={{fontSize:9,color:T.green}}>⚡</span>}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{q.serviceType} · {fmtRel(q.createdAt)}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:14,fontWeight:700,color:isIB?T.green:T.accent}}>{fmtMoney(q.totalPrice)}</div><span style={{fontSize:10,fontWeight:500,color:sc.color}}>{sc.label}</span></div>
              </div>
            )})}
          </div>
          {preview&&(()=>{const q=preview,sc=STATUS[q.status]||STATUS.pending,isIB=q.submissionType==='instant_book';return(
            <div style={{...card,padding:'20px',position:'sticky',top:16,maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                {avatar(q.client.firstName.charAt(0),44)}
                <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{q.client.email}</div></div>
              </div>
              <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>{badge(sc.label,sc.color,sc.bg)}{isIB&&badge('⚡ Instant',T.green,T.greenBg)}<span style={{fontSize:11,color:T.dim}}>{fmtDate(q.createdAt)}</span></div>
              <div style={{padding:'14px',background:T.surf,borderRadius:10,marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:T.muted}}>Total per visit</span>
                <span style={{fontSize:20,fontWeight:700,color:isIB?T.green:T.accent}}>{fmtMoney(q.totalPrice)}</span>
              </div>
              {[{l:'Service',v:q.serviceType},{l:'Frequency',v:q.frequency},{l:'Address',v:q.address||'—'},{l:'Date',v:fmtDate(q.preferredDate1)}].map(f=><div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:12,color:T.muted}}>{f.l}</span><span style={{fontSize:12,fontWeight:500,color:T.text,textAlign:'right',maxWidth:180}}>{f.v}</span></div>)}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:14}}>
                <button onClick={()=>openQuote(q)} style={{...btnP,width:'100%',textAlign:'center'}}>Open Full View</button>
                {q.status==='pending'&&<button onClick={()=>updateQuoteStatus(q.id,'reviewed')} style={{...btnS,width:'100%',textAlign:'center'}}>Mark Reviewed</button>}
                {['pending','reviewed'].includes(q.status)&&<button onClick={()=>updateQuoteStatus(q.id,'booked')} style={{width:'100%',padding:'9px',borderRadius:8,background:T.green,color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'"Inter",sans-serif'}}>Confirm Booking</button>}
              </div>
            </div>
          )})()}
        </div>
      )}
    </div>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // QUOTE DETAIL (editable)
  // ══════════════════════════════════════════════════════════════════════
  function QuoteDetailPage(){
    const quote=quotes.find(q=>q.id===activeQuoteId);if(!quote) return <div style={{padding:48,color:T.dim,textAlign:'center'}}>Not found. <button onClick={()=>setPage('quotes')} style={{color:T.accent,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Back</button></div>
    const q=quote,sc=STATUS[q.status]||STATUS.pending,isIB=q.submissionType==='instant_book'
    const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[sending,setSending]=useState(false),[confirmDel,setConfirmDel]=useState(false),[deleting,setDeleting]=useState(false)
    const [eTotal,setETotal]=useState(q.totalPrice.toString()),[eSub,setESub]=useState(q.subtotal.toString()),[eDisc,setEDisc]=useState(q.discount.toString()),[eDiscL,setEDiscL]=useState(q.discountLabel)
    const [eService,setEService]=useState(q.serviceType),[eFreq,setEFreq]=useState(q.frequency),[eAddr,setEAddr]=useState(q.address),[eSqft,setESqft]=useState(q.sqftRange||''),[eBeds,setEBeds]=useState(q.bedrooms?.toString()||''),[eBaths,setEBaths]=useState(q.bathrooms?.toString()||'')
    const [eAddons,setEAddons]=useState(q.addonsList),[eNotes,setENotes]=useState(q.additionalNotes),[eKey,setEKey]=useState(q.keyAreas)
    const [li,setLi]=useState<{label:string;detail:string;amount:string}[]>(()=>{const ls=q.priceBreakdown.split('\n').filter(Boolean);return ls.length>0?ls.map(l=>{const m=l.match(/\$[\d,.]+/);const parts=l.split('...')[0]?.trim()||l;const [lbl,det]=(parts.includes('||')?parts.split('||'):[parts,'']);return{label:lbl.trim(),detail:det.trim(),amount:m?m[0].replace('$',''):'0'}}):[{label:'Base Service',detail:'',amount:q.totalPrice.toString()}]})
    function updLi(i:number,f:'label'|'amount'|'detail',v:string){const u=[...li];u[i]={...u[i],[f]:v};setLi(u);if(f!=='detail'){const s=u.reduce((a,x)=>a+(parseFloat(x.amount)||0),0);setESub(s.toFixed(2));setETotal(Math.max(0,s-(parseFloat(eDisc)||0)).toFixed(2))}}
    async function handleSave(){setSaving(true);const bd=li.map(x=>`${x.label}${x.detail?'||'+x.detail:''}...$${parseFloat(x.amount||'0').toFixed(2)}`).join('\n');await saveQuote(q.id,{totalPrice:parseFloat(eTotal),subtotal:parseFloat(eSub),discount:parseFloat(eDisc),discountLabel:eDiscL,priceBreakdown:bd,serviceType:eService,frequency:eFreq,address:eAddr,sqftRange:eSqft||null,bedrooms:eBeds?parseInt(eBeds):null,bathrooms:eBaths?parseFloat(eBaths):null,addonsList:eAddons,additionalNotes:eNotes,keyAreas:eKey});setSaving(false);setEditing(false)}
    async function handleEmail(){setSending(true);await sendQuoteEmail(q.id);setSending(false)}
    async function handleDel(){setDeleting(true);await deleteQuote(q.id);setDeleting(false)}
    async function toInvoice(){const items=li.map(x=>({description:x.label+(x.detail?' — '+x.detail:''),amount:parseFloat(x.amount)||0,quantity:1}));await createInvoice({toClientId:q.clientId,amount:parseFloat(eTotal),lineItems:JSON.stringify(items),notes:`Quote → ${q.client.firstName} ${q.client.lastName}`})}
    const ef=editing?{...inp,background:T.surf,border:`1px solid ${T.borderB}`} as React.CSSProperties:{...inp,background:'transparent',border:'1px solid transparent',cursor:'default',padding:'10px 0'} as React.CSSProperties

    return pageWrap(900,<>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setPage('quotes')} style={{...btnS,padding:'7px 12px'}}>← Quotes</button>
          <span style={{fontSize:13,fontWeight:600,color:T.text}}>{q.client.firstName} {q.client.lastName}</span>
          {badge(sc.label,sc.color,sc.bg)}{isIB&&badge('⚡ Instant',T.green,T.greenBg)}
        </div>
        <div style={{display:'flex',gap:6}}>
          {!editing?<button onClick={()=>setEditing(true)} style={{...btnS,color:T.accent,borderColor:T.accentBorder}}>Edit</button>:<><button onClick={()=>setEditing(false)} style={btnS}>Cancel</button><button onClick={handleSave} disabled={saving} style={{...btnP,opacity:saving?.6:1}}>{saving?'Saving…':'Save'}</button></>}
        </div>
      </div>
      <div style={{...card,padding:'22px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          {avatar(q.client.firstName.charAt(0),48)}
          <div><div style={{fontSize:18,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{q.client.email} · {q.client.phone||'—'}</div><div style={{fontSize:11,color:T.dim,marginTop:1}}>Submitted {fmtDate(q.createdAt)}</div></div>
        </div>
        <div style={{textAlign:'right'}}><div style={{fontSize:28,fontWeight:700,color:isIB?T.green:T.accent}}>{fmtMoney(parseFloat(eTotal)||q.totalPrice)}</div></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:14,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{...card,padding:'20px'}}>{hdr('Line Items')}
            {li.map((x,i)=><div key={i} style={{padding:'8px 0',borderBottom:`1px solid ${T.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {editing?<><input value={x.label} onChange={e=>updLi(i,'label',e.target.value)} style={{...ef,flex:1}} placeholder="Item"/><span style={{color:T.muted}}>$</span><input value={x.amount} onChange={e=>updLi(i,'amount',e.target.value)} style={{...ef,width:80,textAlign:'right'}} type="number" step="0.01"/><button onClick={()=>setLi(li.filter((_,j)=>j!==i))} style={{width:24,height:24,borderRadius:6,border:`1px solid ${T.red}30`,background:T.redBg,color:T.red,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></>:<><span style={{flex:1,fontSize:13,color:T.sub}}>{x.label}</span><span style={{fontSize:13,fontWeight:600,color:T.text}}>${parseFloat(x.amount||'0').toFixed(2)}</span></>}
              </div>
              {editing?<input value={x.detail} onChange={e=>updLi(i,'detail',e.target.value)} style={{...ef,marginTop:4,fontSize:12,color:T.muted}} placeholder="Description…"/>:x.detail&&<div style={{fontSize:12,color:T.dim,marginTop:3,lineHeight:1.5}}>{x.detail}</div>}
            </div>)}
            {editing&&<button onClick={()=>setLi([...li,{label:'',detail:'',amount:'0'}])} style={{marginTop:10,padding:'8px',borderRadius:8,border:`1px dashed ${T.border}`,background:'transparent',color:T.accent,cursor:'pointer',fontSize:12,fontWeight:500,width:'100%'}}>+ Add Item</button>}
            {(q.discount>0||editing)&&<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:`1px solid ${T.border}`,marginTop:6}}>
              {editing?<><input value={eDiscL} onChange={e=>setEDiscL(e.target.value)} placeholder="Discount" style={{...ef,flex:1,color:T.green}}/><span style={{color:T.green}}>-$</span><input value={eDisc} onChange={e=>setEDisc(e.target.value)} onBlur={()=>setETotal(Math.max(0,(parseFloat(eSub)||0)-(parseFloat(eDisc)||0)).toFixed(2))} style={{...ef,width:80,textAlign:'right',color:T.green}} type="number" step="0.01"/></>:<><span style={{fontSize:12,color:T.green}}>✓ {q.discountLabel}</span><span style={{fontSize:12,color:T.green,fontWeight:600}}>-{fmtMoney(q.discount)}</span></>}
            </div>}
            <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:`2px solid ${T.borderB}`,marginTop:4}}><span style={{fontWeight:700,color:T.text}}>Total</span><span style={{fontWeight:700,fontSize:18,color:isIB?T.green:T.accent}}>{fmtMoney(parseFloat(eTotal)||q.totalPrice)}</span></div>
          </div>
          <div style={{...card,padding:'20px'}}>{hdr('Service')}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{l:'Service',v:eService,s:setEService},{l:'Frequency',v:eFreq,s:setEFreq},{l:'Sq Ft',v:eSqft,s:setESqft},{l:'Beds',v:eBeds,s:setEBeds},{l:'Baths',v:eBaths,s:setEBaths}].map(f=><div key={f.l}>{label(f.l)}{editing?<input value={f.v} onChange={e=>f.s(e.target.value)} style={ef}/>:<div style={{fontSize:13,color:T.text,padding:'10px 0'}}>{f.v||'—'}</div>}</div>)}
            </div>
            <div style={{marginTop:10}}>{label('Address')}{editing?<input value={eAddr} onChange={e=>setEAddr(e.target.value)} style={ef}/>:<div style={{fontSize:13,color:T.text,padding:'10px 0'}}>{q.address||'—'}</div>}</div>
          </div>
          <div style={{...card,padding:'20px'}}>{hdr('Notes')}
            {[{l:'Add-ons',v:eAddons,s:setEAddons},{l:'Key Areas',v:eKey,s:setEKey},{l:'Notes',v:eNotes,s:setENotes}].map(f=><div key={f.l} style={{marginBottom:12}}>{label(f.l)}{editing?<textarea value={f.v} onChange={e=>f.s(e.target.value)} rows={2} style={{...ef,resize:'vertical'}}/>:<div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>{f.v&&f.v!=='None selected'?f.v:'—'}</div>}</div>)}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{...card,padding:'18px'}}>{hdr('Client')}
            {[{l:'Name',v:`${q.client.firstName} ${q.client.lastName}`},{l:'Email',v:q.client.email},{l:'Phone',v:q.client.phone||'—'},{l:'Since',v:fmtDate(q.client.createdAt)}].map(f=><div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:11,color:T.muted}}>{f.l}</span><span style={{fontSize:12,fontWeight:500,color:T.text}}>{f.v}</span></div>)}
          </div>
          <div style={{...card,padding:'18px'}}>{hdr('Actions')}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {!isIB&&<button onClick={handleEmail} disabled={sending} style={{...btnP,width:'100%',textAlign:'center',opacity:sending?.6:1}}>{sending?'Sending…':'Send Quote Email'}</button>}
              {q.status==='pending'&&<button onClick={()=>updateQuoteStatus(q.id,'reviewed')} style={{...btnS,width:'100%'}}>Mark Reviewed</button>}
              {['pending','reviewed'].includes(q.status)&&<button onClick={()=>updateQuoteStatus(q.id,'booked')} style={{width:'100%',padding:'9px',borderRadius:8,background:T.green,color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'"Inter",sans-serif'}}>Confirm Booking</button>}
              {q.status==='booked'&&<button onClick={()=>updateQuoteStatus(q.id,'completed')} style={{width:'100%',padding:'9px',borderRadius:8,background:T.violet,color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}>Completed</button>}
              {q.status!=='cancelled'&&<button onClick={()=>updateQuoteStatus(q.id,'cancelled')} style={{width:'100%',padding:'8px',borderRadius:8,background:T.redBg,color:T.red,border:'none',fontSize:12,fontWeight:500,cursor:'pointer'}}>Cancel</button>}
              <button onClick={toInvoice} style={{width:'100%',padding:'8px',borderRadius:8,background:T.amberBg,color:T.amber,border:'none',fontSize:12,fontWeight:500,cursor:'pointer'}}>Convert to Invoice</button>
              {['booked','completed'].includes(q.status)&&<button onClick={()=>convertToJob(q.id)} style={{width:'100%',padding:'8px',borderRadius:8,background:T.violetBg,color:T.violet,border:'none',fontSize:12,fontWeight:500,cursor:'pointer'}}>Convert to Job</button>}
              <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4}}>
                {!confirmDel?<button onClick={()=>setConfirmDel(true)} style={{width:'100%',padding:'7px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.red,fontSize:11,fontWeight:500,cursor:'pointer',opacity:.6}}>Delete</button>:(
                  <div style={{background:T.redBg,borderRadius:8,padding:'12px'}}><div style={{fontSize:12,fontWeight:600,color:T.red,marginBottom:6}}>Confirm delete?</div><div style={{display:'flex',gap:6}}><button onClick={()=>setConfirmDel(false)} style={{...btnS,flex:1,fontSize:11}}>No</button><button onClick={handleDel} disabled={deleting} style={{flex:1,padding:'7px',borderRadius:6,border:'none',background:T.red,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600,opacity:deleting?.5:1}}>Delete</button></div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // CREATE QUOTE
  // ══════════════════════════════════════════════════════════════════════
  function CreateQuotePage(){
    const [selC,setSelC]=useState(''),[newC,setNewC]=useState(false)
    const [nc,setNc]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',city:'',state:'AK',zip:''})
    const [qf,setQf]=useState({serviceType:'Standard Clean',frequency:'One-Time',address:'',sqftRange:'',bedrooms:'',bathrooms:'',addonsList:'',keyAreas:'',additionalNotes:'',preferredDate1:'',preferredDate2:'',preferredTimes:''})
    const [items,setItems]=useState<{label:string;detail:string;amount:string}[]>([{label:'Base Service',detail:'',amount:'0'}])
    const [sub,setSub]=useState(false);const total=items.reduce((s,x)=>s+(parseFloat(x.amount)||0),0)
    async function go(){if(!selC&&!nc.email){showToast('Select a client','err');return};setSub(true);const bd=items.map(x=>`${x.label}${x.detail?'||'+x.detail:''}...$${parseFloat(x.amount||'0').toFixed(2)}`).join('\n');const d:any={service_type:qf.serviceType,frequency:qf.frequency,address:qf.address,sqft_range:qf.sqftRange,bedrooms:qf.bedrooms,house_bathrooms:qf.bathrooms,addons_list:qf.addonsList,key_areas:qf.keyAreas,additional_notes:qf.additionalNotes,preferred_date_1:qf.preferredDate1||undefined,preferred_times:qf.preferredTimes,price_breakdown:bd,subtotal:`$${total.toFixed(2)}`,total_price:`$${total.toFixed(2)}`,discount:'$0',discount_label:'',submission_type:'quote'};if(selC){const c=clients.find(x=>x.id===selC);if(c){d.email=c.email;d.first_name=c.firstName;d.last_name=c.lastName;d.phone=c.phone}}else{d.email=nc.email;d.first_name=nc.firstName;d.last_name=nc.lastName;d.phone=nc.phone;d.city=nc.city;d.state=nc.state;d.zip=nc.zip};await createQuote(d);setSub(false)}
    return pageWrap(600,<>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><button onClick={()=>setPage('quotes')} style={{...btnS,padding:'7px 12px'}}>← Back</button><h1 style={{fontSize:20,fontWeight:700,color:T.text}}>New Quote</h1></div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Client')}
        {!newC?<div><select value={selC} onChange={e=>setSelC(e.target.value)} style={{...inp,cursor:'pointer'}}><option value="">Select client…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}</select><button onClick={()=>setNewC(true)} style={{marginTop:8,fontSize:12,color:T.accent,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>+ New Client</button></div>:(
          <div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{[{l:'First Name',k:'firstName'},{l:'Last Name',k:'lastName'},{l:'Email *',k:'email'},{l:'Phone',k:'phone'}].map(f=><div key={f.k}>{label(f.l)}<input value={(nc as any)[f.k]} onChange={e=>setNc({...nc,[f.k]:e.target.value})} style={inp}/></div>)}</div><button onClick={()=>setNewC(false)} style={{marginTop:8,fontSize:12,color:T.muted,background:'none',border:'none',cursor:'pointer'}}>← Existing Client</button></div>
        )}
      </div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Service')}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div>{label('Type')}<select value={qf.serviceType} onChange={e=>setQf({...qf,serviceType:e.target.value})} style={{...inp,cursor:'pointer'}}>{SERVICE_TYPES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div>{label('Frequency')}<select value={qf.frequency} onChange={e=>setQf({...qf,frequency:e.target.value})} style={{...inp,cursor:'pointer'}}>{FREQUENCIES.map(f=><option key={f}>{f}</option>)}</select></div>
          {[{l:'Address',k:'address'},{l:'Sq Ft',k:'sqftRange'},{l:'Beds',k:'bedrooms'},{l:'Baths',k:'bathrooms'}].map(f=><div key={f.k}>{label(f.l)}<input value={(qf as any)[f.k]} onChange={e=>setQf({...qf,[f.k]:e.target.value})} style={inp}/></div>)}
        </div>
        <div style={{marginTop:8}}>{label('Preferred Date')}<input type="date" value={qf.preferredDate1} onChange={e=>setQf({...qf,preferredDate1:e.target.value})} style={inp}/></div>
      </div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Line Items')}
        {items.map((x,i)=><div key={i} style={{padding:'6px 0',borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:'flex',gap:6,alignItems:'center'}}><input value={x.label} onChange={e=>{const u=[...items];u[i]={...u[i],label:e.target.value};setItems(u)}} style={{...inp,flex:1}} placeholder="Item"/><span style={{color:T.muted}}>$</span><input value={x.amount} onChange={e=>{const u=[...items];u[i]={...u[i],amount:e.target.value};setItems(u)}} style={{...inp,width:80,textAlign:'right'}} type="number" step="0.01"/>{items.length>1&&<button onClick={()=>setItems(items.filter((_,j)=>j!==i))} style={{width:22,height:22,borderRadius:5,border:`1px solid ${T.red}30`,background:T.redBg,color:T.red,cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}</div>
          <input value={x.detail} onChange={e=>{const u=[...items];u[i]={...u[i],detail:e.target.value};setItems(u)}} style={{...inp,marginTop:4,fontSize:12}} placeholder="Description…"/>
        </div>)}
        <button onClick={()=>setItems([...items,{label:'',detail:'',amount:'0'}])} style={{marginTop:8,padding:'7px',borderRadius:8,border:`1px dashed ${T.border}`,background:'transparent',color:T.accent,cursor:'pointer',fontSize:12,fontWeight:500,width:'100%'}}>+ Add</button>
        <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:`2px solid ${T.borderB}`,marginTop:10}}><span style={{fontWeight:700,color:T.text}}>Total</span><span style={{fontWeight:700,fontSize:18,color:T.accent}}>{fmtMoney(total)}</span></div>
      </div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Notes')}<textarea value={qf.additionalNotes} onChange={e=>setQf({...qf,additionalNotes:e.target.value})} rows={3} placeholder="Notes…" style={{...inp,resize:'vertical'}}/></div>
      <button onClick={go} disabled={sub} style={{...btnP,width:'100%',padding:'12px',fontSize:14,opacity:sub?.6:1}}>{sub?'Creating…':'Create Quote'}</button>
    </>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // JOBS — date-grouped with editable preview
  // ══════════════════════════════════════════════════════════════════════
  function JobsPage(){
    const [filter,setFilter]=useState<'all'|'upcoming'|'today'|'past'>('upcoming'),[search,setSearch]=useState(''),[selJId,setSelJId]=useState<string|null>(null)
    const now=new Date(),td=new Date(now.getFullYear(),now.getMonth(),now.getDate()),te=new Date(td.getTime()+86400000)
    const fj=jobs.filter(j=>{const d=new Date(j.checkoutTime);return filter==='upcoming'?d>=now:filter==='today'?d>=td&&d<te:filter==='past'?d<now:true}).filter(j=>!search||`${j.displayName} ${j.propertyLabel} ${j.platform}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>filter==='past'?new Date(b.checkoutTime).getTime()-new Date(a.checkoutTime).getTime():new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
    const PLAT:Record<string,string>={hostaway:'#f59e0b',jobber:'#3b82f6',manual:'#6366f1',airbnb:'#ef4444'}
    const groups:Map<string,Job[]>=new Map()
    if(fj.length>0&&filter!=='past'){const f0=new Date(fj[0].checkoutTime),fN=fj.length>1?new Date(fj[fj.length-1].checkoutTime):f0;const days=Math.min(14,Math.max(3,Math.ceil((fN.getTime()-f0.getTime())/86400000)+1));for(let i=0;i<days;i++){const d=new Date(f0.getFullYear(),f0.getMonth(),f0.getDate()+i);const k=d.toISOString().split('T')[0];groups.set(k,fj.filter(j=>sameDay(new Date(j.checkoutTime),d)))}}else{fj.forEach(j=>{const k=new Date(j.checkoutTime).toISOString().split('T')[0];if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(j)})}
    const selJob=selJId?fj.find(j=>j.id===selJId)||fj[0]||null:fj[0]||null
    return(<div>
      {pageTitle('Jobs',`${jobs.length} total · ${upcoming.length} upcoming`,<button onClick={()=>setPage('create-job')} style={btnP}>Add Job</button>)}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:2,background:T.surf,borderRadius:8,padding:2,border:`1px solid ${T.border}`}}>
          {(['upcoming','today','past','all'] as const).map(x=><button key={x} onClick={()=>{setFilter(x);setSelJId(null)}} style={{padding:'6px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:filter===x?600:400,background:filter===x?T.card:'transparent',color:filter===x?T.text:T.muted,fontFamily:'"Inter",sans-serif',textTransform:'capitalize',boxShadow:filter===x?T.shadow:'none'}}>{x}</button>)}
        </div>
        <input style={{...inp,flex:1,minWidth:140,maxWidth:240}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      {fj.length===0?<div style={{textAlign:'center',padding:'48px 0',color:T.dim}}>No jobs.</div>:(
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:14,alignItems:'start'}}>
          <div style={{maxHeight:'calc(100vh - 200px)',overflowY:'auto',paddingRight:4}}>
            {Array.from(groups.entries()).map(([dk,dj])=>{const d=new Date(dk+'T12:00:00'),isToday=sameDay(d,now);return(
              <div key={dk} style={{marginBottom:6}}>
                <div style={{padding:'7px 0',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,fontWeight:600,color:isToday?T.accent:T.sub}}>{isToday?'Today':d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span><div style={{flex:1,height:1,background:T.border}}/>{dj.length>0&&<span style={{fontSize:10,color:T.dim}}>{dj.length}</span>}</div>
                {dj.length===0?<div style={{padding:'8px 12px',fontSize:11,color:T.dim,fontStyle:'italic'}}>No jobs</div>:(
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {dj.map(j=>{const pc=PLAT[j.platform]||T.accent,sel=selJob?.id===j.id;return(
                      <div key={j.id} onClick={()=>setSelJId(j.id)} style={{...card,padding:'11px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderColor:sel?T.borderHover:T.border,background:sel?T.cardHover:T.card}} onMouseEnter={e=>{if(!sel)hover(e,true)}} onMouseLeave={e=>{if(!sel)hover(e,false)}}>
                        <div style={{width:3,height:26,borderRadius:2,background:pc,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.displayName}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{j.propertyLabel}</div></div>
                        <span style={{fontSize:11,fontWeight:600,color:T.accent,flexShrink:0}}>{fmtTime(j.checkoutTime)}</span>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )})}
          </div>
          {selJob&&(()=>{
            const [eJ,setEJ]=useState(false),[em,setEm]=useState({displayName:selJob.displayName,propertyLabel:selJob.propertyLabel,address:selJob.address,notes:selJob.notes||'',customerName:selJob.customerName||'',worth:selJob.worth?.toString()||'',sqft:selJob.sqft?.toString()||'',beds:selJob.beds?.toString()||'',baths:selJob.baths?.toString()||''}),[savJ,setSavJ]=useState(false)
            async function sav(){setSavJ(true);await fetch(`/api/jobs/${selJob.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:em.displayName,propertyLabel:em.propertyLabel,address:em.address||null,notes:em.notes||null,customerName:em.customerName||null,worth:em.worth?parseFloat(em.worth):null,sqft:em.sqft?parseInt(em.sqft):null,beds:em.beds?parseInt(em.beds):null,baths:em.baths?parseFloat(em.baths):null})});await load();setSavJ(false);setEJ(false);showToast('Updated')}
            async function del(){await fetch(`/api/jobs/${selJob.id}`,{method:'DELETE'});await load();setSelJId(null);showToast('Deleted')}
            let duties:{title?:string;description?:string}[]=[];try{duties=JSON.parse(selJob.duties||'[]')}catch{}
            const jI=eJ?{...inp,padding:'8px 10px',fontSize:12} as React.CSSProperties:{} as React.CSSProperties
            return(<div style={{...card,padding:'22px',position:'sticky',top:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div style={{flex:1}}>{eJ?<input value={em.displayName} onChange={e=>setEm({...em,displayName:e.target.value})} style={{...jI,fontSize:16,fontWeight:700}}/>:<div style={{fontSize:17,fontWeight:700,color:T.text}}>{selJob.displayName}</div>}{eJ?<input value={em.propertyLabel} onChange={e=>setEm({...em,propertyLabel:e.target.value})} style={{...jI,marginTop:4,color:T.muted}}/>:<div style={{fontSize:12,color:T.muted,marginTop:4}}>{selJob.propertyLabel}</div>}</div>
                <button onClick={()=>{if(eJ){sav()}else{setEJ(true);setEm({displayName:selJob.displayName,propertyLabel:selJob.propertyLabel,address:selJob.address,notes:selJob.notes||'',customerName:selJob.customerName||'',worth:selJob.worth?.toString()||'',sqft:selJob.sqft?.toString()||'',beds:selJob.beds?.toString()||'',baths:selJob.baths?.toString()||''})}}} style={{...btnS,padding:'6px 12px',fontSize:11}}>{savJ?'…':eJ?'Save':'Edit'}</button>
              </div>
              <div style={{display:'flex',gap:6,marginBottom:14}}>{badge(selJob.platform,PLAT[selJob.platform]||T.accent,`${(PLAT[selJob.platform]||T.accent)}18`)}{sameDay(new Date(selJob.checkoutTime),now)&&badge('Today',T.accent,T.accentBg)}</div>
              {[{l:'Checkout',v:`${fmtDate(selJob.checkoutTime)} · ${fmtTime(selJob.checkoutTime)}`},{l:'Check-in',v:selJob.checkinTime?`${fmtDate(selJob.checkinTime)} · ${fmtTime(selJob.checkinTime)}`:'—'},{l:'Address',v:selJob.address||'—',k:'address'},{l:'Guest',v:selJob.customerName||'—',k:'customerName'},{l:'Worth',v:selJob.worth?fmtMoney(selJob.worth):'—',k:'worth'}].map(f=><div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:11,color:T.muted}}>{f.l}</span>{eJ&&(f as any).k?<input value={(em as any)[(f as any).k]||''} onChange={e=>setEm({...em,[(f as any).k]:e.target.value})} style={{...jI,width:160,textAlign:'right'}}/>:<span style={{fontSize:12,fontWeight:500,color:T.text,textAlign:'right',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.v}</span>}</div>)}
              {duties.length>0&&<div style={{marginTop:14}}>{hdr('Duties')}{duties.map((d,i)=><div key={i} style={{padding:'8px 10px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>{d.title||`Task ${i+1}`}</div>{d.description&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{d.description}</div>}</div>)}</div>}
              {eJ?<div style={{marginTop:12}}>{label('Notes')}<textarea value={em.notes} onChange={e=>setEm({...em,notes:e.target.value})} rows={3} style={{...jI,width:'100%',resize:'vertical'}}/></div>:selJob.notes&&<div style={{marginTop:12,padding:'10px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted,lineHeight:1.5}}>{selJob.notes}</div>}
              {eJ&&<div style={{display:'flex',gap:6,marginTop:12}}><button onClick={()=>setEJ(false)} style={{...btnS,flex:1}}>Cancel</button><button onClick={del} style={{padding:'8px 12px',borderRadius:8,background:T.redBg,color:T.red,border:'none',fontSize:11,fontWeight:500,cursor:'pointer'}}>Delete</button></div>}
            </div>)
          })()}
        </div>
      )}
    </div>)
  }

  // CREATE JOB
  function CreateJobPage(){
    const [jf,setJf]=useState({displayName:'',propertyLabel:'',address:'',checkoutDate:'',checkoutTimeVal:'10:00',checkinDate:'',checkinTimeVal:'',notes:''});const [sub,setSub]=useState(false)
    async function go(){if(!jf.displayName||!jf.checkoutDate){showToast('Name and date required','err');return};setSub(true);const co=new Date(`${jf.checkoutDate}T${jf.checkoutTimeVal||'10:00'}`);const b:any={displayName:jf.displayName,propertyLabel:jf.propertyLabel||jf.displayName,address:jf.address,checkoutTime:co.toISOString(),platform:'manual',notes:jf.notes};if(jf.checkinDate)b.checkinTime=new Date(`${jf.checkinDate}T${jf.checkinTimeVal||'14:00'}`).toISOString();await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});await load();showToast('Job created');setPage('jobs');setSub(false)}
    return pageWrap(560,<>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><button onClick={()=>setPage('jobs')} style={{...btnS,padding:'7px 12px'}}>← Back</button><h1 style={{fontSize:20,fontWeight:700,color:T.text}}>Add Job</h1></div>
      <div style={{...card,padding:'20px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[{l:'Job Name *',k:'displayName',span:true},{l:'Property',k:'propertyLabel'},{l:'Address',k:'address'},{l:'Checkout Date *',k:'checkoutDate',t:'date'},{l:'Time',k:'checkoutTimeVal',t:'time'},{l:'Check-in Date',k:'checkinDate',t:'date'},{l:'Check-in Time',k:'checkinTimeVal',t:'time'}].map(f=><div key={f.k} style={(f as any).span?{gridColumn:'1/-1'}:{}}>{label(f.l)}<input value={(jf as any)[f.k]} onChange={e=>setJf({...jf,[f.k]:e.target.value})} type={(f as any).t||'text'} style={inp}/></div>)}
      </div><div style={{marginTop:10}}>{label('Notes')}<textarea value={jf.notes} onChange={e=>setJf({...jf,notes:e.target.value})} rows={3} style={{...inp,resize:'vertical'}}/></div>
      <button onClick={go} disabled={sub} style={{...btnP,width:'100%',marginTop:14,padding:'11px',opacity:sub?.6:1}}>{sub?'Creating…':'Create Job'}</button></div>
    </>)
  }

  // CONVERT QUOTE → JOB (with calendar preview)
  function ConvertToJobPage(){
    const quote=quotes.find(q=>q.id===activeQuoteId);if(!quote) return <div style={{padding:48,color:T.dim,textAlign:'center'}}>Not found. <button onClick={()=>setPage('quotes')} style={{color:T.accent,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Back</button></div>
    const q=quote,cn=`${q.client.firstName} ${q.client.lastName}`
    const defaultDate=q.preferredDate1?new Date(q.preferredDate1).toISOString().split('T')[0]:''
    const [jDate,setJDate]=useState(defaultDate),[jTime,setJTime]=useState('10:00'),[jName,setJName]=useState(`${q.serviceType} — ${cn}`),[jAddr,setJAddr]=useState(q.address||[q.client.address,q.client.city,q.client.state].filter(Boolean).join(', ')),[jNotes,setJNotes]=useState(q.additionalNotes||'')
    const [recurring,setRecurring]=useState(q.frequency!=='One-Time')
    const [freq,setFreq]=useState<'weekly'|'bi-weekly'|'every-3-weeks'|'monthly'>(q.frequency.toLowerCase().includes('bi')?'bi-weekly':q.frequency.toLowerCase().includes('week')?'weekly':q.frequency.toLowerCase().includes('3')?'every-3-weeks':'monthly')
    const [endDate,setEndDate]=useState(''),[submitting,setSubmitting]=useState(false)
    const calM=jDate?new Date(jDate+'T12:00:00'):new Date();const cy=calM.getFullYear(),cm=calM.getMonth()
    const cFirst=new Date(cy,cm,1),cDow=cFirst.getDay(),cLast=new Date(cy,cm+1,0),cToday=new Date()
    const cCells:({t:'p';n:number}|{t:'d';day:number;date:Date})[]=[];for(let i=0;i<cDow;i++)cCells.push({t:'p',n:new Date(cy,cm,-cDow+i+1).getDate()});for(let d=1;d<=cLast.getDate();d++)cCells.push({t:'d',day:d,date:new Date(cy,cm,d)});const tr=(cDow+cLast.getDate())%7;if(tr)for(let i=1;i<=7-tr;i++)cCells.push({t:'p',n:i})
    const newDates:Date[]=[];if(jDate){const start=new Date(jDate+'T12:00:00');if(!recurring)newDates.push(start);else{const end=endDate?new Date(endDate+'T23:59:59'):new Date(cy,cm+3,0);const step=freq==='weekly'?7:freq==='bi-weekly'?14:freq==='every-3-weeks'?21:30;let cur=new Date(start);while(cur<=end&&newDates.length<52){newDates.push(new Date(cur));if(freq==='monthly')cur=new Date(cur.getFullYear(),cur.getMonth()+1,cur.getDate());else cur=new Date(cur.getTime()+step*86400000)}}}
    function exOn(d:Date){return jobs.filter(j=>sameDay(new Date(j.checkoutTime),d))}
    function nwOn(d:Date){return newDates.filter(nd=>sameDay(nd,d))}
    async function go(){if(!jDate){showToast('Select a date','err');return};setSubmitting(true);for(const d of newDates){const co=new Date(d);const [h,m]=jTime.split(':');co.setHours(parseInt(h)||10,parseInt(m)||0,0,0);await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'manual',displayName:jName,propertyLabel:jAddr.split(',')[0]||cn,address:jAddr,customerName:cn,checkoutTime:co.toISOString(),checkinTime:null,sqft:q.sqftRange?parseInt(q.sqftRange.replace(/[^\d]/g,''))||null:null,beds:q.bedrooms,baths:q.bathrooms,worth:q.totalPrice,notes:[`From quote #${q.id.slice(-6)}`,recurring?`Recurring: ${freq}`:'One-off',jNotes].filter(Boolean).join('\n'),cleanerIds:'[]',duties:'[]'})})};if(q.status==='booked')await fetch(`/api/quotes/${q.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});await load();showToast(`${newDates.length} job${newDates.length>1?'s':''} created`);setPage('jobs');setSubmitting(false)}
    return(<div style={{maxWidth:960,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><button onClick={()=>{setActiveQuoteId(q.id);setPage('quote-detail')}} style={{...btnS,padding:'7px 12px'}}>← Quote</button><h1 style={{fontSize:20,fontWeight:700,color:T.text}}>Schedule Job</h1></div>
      <div style={{...card,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>{avatar(q.client.firstName.charAt(0),36)}<div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{cn}</div><div style={{fontSize:11,color:T.muted}}>{q.serviceType} · {q.frequency}</div></div><span style={{fontSize:16,fontWeight:700,color:T.accent}}>{fmtMoney(q.totalPrice)}</span></div>
      <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:14,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{...card,padding:'18px'}}>{hdr('Schedule')}
            <div style={{display:'flex',gap:6,marginBottom:14}}><button onClick={()=>setRecurring(false)} style={{flex:1,padding:'9px',borderRadius:8,border:`1px solid ${!recurring?T.accentBorder:T.border}`,background:!recurring?T.accentBg:'transparent',color:!recurring?T.accent:T.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>One-Off</button><button onClick={()=>setRecurring(true)} style={{flex:1,padding:'9px',borderRadius:8,border:`1px solid ${recurring?T.accentBorder:T.border}`,background:recurring?T.accentBg:'transparent',color:recurring?T.accent:T.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>Recurring</button></div>
            {recurring&&<div style={{marginBottom:12}}>{label('Frequency')}<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>{([['weekly','Weekly'],['bi-weekly','Bi-Weekly'],['every-3-weeks','3 Weeks'],['monthly','Monthly']] as const).map(([k,l])=><button key={k} onClick={()=>setFreq(k)} style={{padding:'7px',borderRadius:6,border:`1px solid ${freq===k?T.accentBorder:T.border}`,background:freq===k?T.accentBg:'transparent',color:freq===k?T.accent:T.muted,fontSize:11,fontWeight:freq===k?600:400,cursor:'pointer'}}>{l}</button>)}</div></div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><div>{label('Start Date *')}<input type="date" value={jDate} onChange={e=>setJDate(e.target.value)} style={inp}/></div><div>{label('Time')}<input type="time" value={jTime} onChange={e=>setJTime(e.target.value)} style={inp}/></div></div>
            {recurring&&<div style={{marginTop:8}}>{label('End Date')}<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={inp}/></div>}
            {newDates.length>0&&<div style={{marginTop:10,padding:'10px',background:T.accentBg,borderRadius:8,fontSize:12,fontWeight:500,color:T.accent}}>{recurring?`${newDates.length} jobs (${freq})`:`1 job on ${fmtDate(jDate)}`}</div>}
          </div>
          <div style={{...card,padding:'18px'}}>{hdr('Details')}{label('Name')}<input value={jName} onChange={e=>setJName(e.target.value)} style={{...inp,marginBottom:8}}/>{label('Address')}<input value={jAddr} onChange={e=>setJAddr(e.target.value)} style={{...inp,marginBottom:8}}/>{label('Notes')}<textarea value={jNotes} onChange={e=>setJNotes(e.target.value)} rows={3} style={{...inp,resize:'vertical'}}/></div>
          <button onClick={go} disabled={submitting} style={{...btnP,width:'100%',padding:'12px',fontSize:14,opacity:submitting?.6:1}}>{submitting?'Creating…':`Create ${newDates.length>1?newDates.length+' Jobs':'Job'}`}</button>
        </div>
        <div style={{...card,padding:'18px',position:'sticky',top:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><span style={{fontSize:14,fontWeight:700,color:T.text}}>{calM.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:1}}>{['S','M','T','W','T','F','S'].map((d,i)=><div key={i} style={{textAlign:'center',padding:'4px',fontSize:10,fontWeight:600,color:T.muted}}>{d}</div>)}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:T.border,borderRadius:8,overflow:'hidden'}}>
            {cCells.map((c,i)=>{if(c.t==='p')return <div key={`p${i}`} style={{background:T.card,padding:'5px',minHeight:48}}><span style={{fontSize:10,color:T.dim,opacity:.35}}>{c.n}</span></div>;const{day,date}=c,isT=sameDay(date,cToday),ex=exOn(date),nw=nwOn(date);return(
              <div key={day} style={{background:nw.length>0?T.greenBg:isT?T.accentBg:T.card,padding:'4px',minHeight:48,borderTop:nw.length>0?`2px solid ${T.green}`:isT?`2px solid ${T.accent}`:'2px solid transparent'}}>
                <div style={{fontSize:11,fontWeight:isT?700:500,color:nw.length>0?T.green:isT?T.accent:T.sub}}>{day}</div>
                {ex.slice(0,2).map(j=><div key={j.id} style={{fontSize:8,color:T.accent,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>{j.displayName}</div>)}
                {nw.length>0&&<div style={{fontSize:8,fontWeight:700,color:T.green,marginTop:1}}>★ New</div>}
              </div>
            )})}
          </div>
          {recurring&&newDates.length>0&&(()=>{const byM:Record<string,number>={};newDates.forEach(d=>{const k=d.toLocaleDateString('en-US',{month:'short',year:'numeric'});byM[k]=(byM[k]||0)+1});return <div style={{marginTop:12}}>{hdr('Summary')}{Object.entries(byM).map(([m,c])=><div key={m} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.sub}}>{m}</span><span style={{color:T.green,fontWeight:600}}>{c} job{c>1?'s':''}</span></div>)}</div>})()}
        </div>
      </div>
    </div>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ══════════════════════════════════════════════════════════════════════
  function ClientsPage(){
    const [s,setS]=useState('');const fil=clients.filter(c=>!s||`${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(s.toLowerCase()))
    return(<div>{pageTitle('Clients',`${clients.length} client${clients.length!==1?'s':''}`,<button onClick={()=>setPage('create-client')} style={btnP}>Add Client</button>)}
      <input style={{...inp,marginBottom:16,maxWidth:360}} placeholder="Search…" value={s} onChange={e=>setS(e.target.value)}/>
      {fil.length===0?<div style={{textAlign:'center',padding:'48px 0',color:T.dim}}>No clients.</div>:(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:10}}>
          {fil.map(c=>{const cq=quotes.filter(q=>q.clientId===c.id),spent=cq.filter(q=>q.status==='completed').reduce((a,q)=>a+q.totalPrice,0);return(
            <div key={c.id} onClick={()=>openClient(c)} style={{...card,padding:'16px',cursor:'pointer'}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>{avatar(`${c.firstName.charAt(0)}${c.lastName.charAt(0)}`,40)}<div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{c.firstName} {c.lastName}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{c.email}</div></div><div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:12,color:T.dim}}>{cq.length} quote{cq.length!==1?'s':''}</div>{spent>0&&<div style={{fontSize:13,fontWeight:700,color:T.green}}>{fmtMoney(spent)}</div>}</div></div>
              {cq.length>0&&<div style={{display:'flex',gap:4,marginTop:10,flexWrap:'wrap'}}>{cq.slice(0,3).map(q=>{const sc=STATUS[q.status]||STATUS.pending;return badge(sc.label,sc.color,sc.bg)})}</div>}
            </div>
          )})}
        </div>
      )}
    </div>)
  }
  function CreateClientPage(){
    const [f,setF]=useState({firstName:'',lastName:'',email:'',phone:'',address:'',city:'',state:'AK',zip:'',notes:''});const [sub,setSub]=useState(false)
    async function go(){if(!f.email||!f.firstName){showToast('Name and email required','err');return};setSub(true);const r=await createClient(f);if(r?.id){setActiveClientId(r.id);setPage('client-detail')};setSub(false)}
    return pageWrap(560,<><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><button onClick={()=>setPage('clients')} style={{...btnS,padding:'7px 12px'}}>← Back</button><h1 style={{fontSize:20,fontWeight:700,color:T.text}}>Add Client</h1></div>
      <div style={{...card,padding:'20px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{[{l:'First Name *',k:'firstName'},{l:'Last Name',k:'lastName'},{l:'Email *',k:'email'},{l:'Phone',k:'phone'},{l:'Address',k:'address'},{l:'City',k:'city'},{l:'State',k:'state'},{l:'Zip',k:'zip'}].map(fi=><div key={fi.k}>{label(fi.l)}<input value={(f as any)[fi.k]} onChange={e=>setF({...f,[fi.k]:e.target.value})} style={inp}/></div>)}</div><div style={{marginTop:10}}>{label('Notes')}<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={3} style={{...inp,resize:'vertical'}}/></div><button onClick={go} disabled={sub} style={{...btnP,width:'100%',marginTop:14,padding:'11px',opacity:sub?.6:1}}>{sub?'Creating…':'Create Client'}</button></div>
    </>)
  }
  function ClientDetailPage(){
    const client=clients.find(c=>c.id===activeClientId);if(!client)return <div style={{padding:48,color:T.dim,textAlign:'center'}}>Not found. <button onClick={()=>setPage('clients')} style={{color:T.accent,background:'none',border:'none',cursor:'pointer'}}>Back</button></div>
    const c=client,cq=quotes.filter(q=>q.clientId===c.id),spent=cq.filter(q=>q.status==='completed').reduce((a,q)=>a+q.totalPrice,0)
    return pageWrap(760,<><button onClick={()=>setPage('clients')} style={{...btnS,padding:'7px 12px',marginBottom:16}}>← Clients</button>
      <div style={{...card,padding:'22px',marginBottom:14,display:'flex',alignItems:'center',gap:14}}>{avatar(`${c.firstName.charAt(0)}${c.lastName.charAt(0)}`,52)}<div style={{flex:1}}><div style={{fontSize:20,fontWeight:700,color:T.text}}>{c.firstName} {c.lastName}</div><div style={{fontSize:13,color:T.muted,marginTop:3}}>{c.email} · {c.phone||'—'}</div><div style={{fontSize:12,color:T.dim,marginTop:1}}>Since {fmtDate(c.createdAt)}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:11,fontWeight:500,color:T.dim}}>Total</div><div style={{fontSize:24,fontWeight:700,color:T.green}}>{fmtMoney(spent)}</div></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>{[{l:'Quotes',v:cq.length,c:T.accent},{l:'Booked',v:cq.filter(q=>q.status==='booked').length,c:T.green},{l:'Done',v:cq.filter(q=>q.status==='completed').length,c:T.violet},{l:'Invoices',v:0,c:T.amber}].map(s=><div key={s.l} style={{...card,padding:'12px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:10,fontWeight:500,color:T.dim,marginTop:2}}>{s.l}</div></div>)}</div>
      <div style={{...card,padding:'20px',marginBottom:14}}>{hdr('Quote History')}
        {cq.length===0?<div style={{color:T.dim,fontSize:12}}>No quotes.</div>:cq.map(q=>{const sc=STATUS[q.status]||STATUS.pending;return <div key={q.id} onClick={()=>openQuote(q)} style={{display:'flex',justifyContent:'space-between',padding:'10px 12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:4,cursor:'pointer',transition:'border-color .12s'}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderHover}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}><div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{q.serviceType} · {q.frequency}</div><div style={{fontSize:10,color:T.dim,marginTop:1}}>{fmtDate(q.createdAt)}</div></div><div style={{display:'flex',alignItems:'center',gap:6}}>{badge(sc.label,sc.color,sc.bg)}<span style={{fontSize:14,fontWeight:700,color:T.accent}}>{fmtMoney(q.totalPrice)}</span></div></div>})}
      </div>
      <div style={{display:'flex',gap:8}}><button onClick={()=>setPage('create-quote')} style={btnP}>New Quote</button><button onClick={()=>setPage('create-invoice')} style={{...btnP,background:T.amber}}>Invoice</button></div>
    </>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // INVOICES
  // ══════════════════════════════════════════════════════════════════════
  function InvoicesPage(){
    const [f,setF]=useState('all');const fi=invoices.filter(i=>f==='all'||i.status===f)
    return(<div>{pageTitle('Invoices',`${invoices.length} total · ${fmtMoney(invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0))} collected`,<button onClick={()=>setPage('create-invoice')} style={btnP}>New Invoice</button>)}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
        {[{k:'all',l:'All',v:invoices.length,c:T.accent},{k:'draft',l:'Draft',v:invoices.filter(i=>i.status==='draft').length,c:'#94a3b8'},{k:'sent',l:'Sent',v:invoices.filter(i=>i.status==='sent').length,c:T.amber},{k:'paid',l:'Paid',v:invoices.filter(i=>i.status==='paid').length,c:T.green},{k:'overdue',l:'Overdue',v:invoices.filter(i=>i.status==='overdue').length,c:T.red}].map(s=><div key={s.k} onClick={()=>setF(s.k)} style={{...card,padding:'12px',textAlign:'center',cursor:'pointer',borderColor:f===s.k?`${s.c}40`:T.border}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}><div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:10,fontWeight:500,color:T.dim,marginTop:2}}>{s.l}</div></div>)}
      </div>
      {fi.length===0?<div style={{textAlign:'center',padding:'48px 0',color:T.dim}}>No invoices.</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:6,maxWidth:860}}>
          {fi.map(inv=>{const is=INV_STATUS[inv.status]||INV_STATUS.draft;const li=(()=>{try{return JSON.parse(inv.lineItems)}catch{return[]}})();return(
            <div key={inv.id} onClick={()=>openInvoice(inv.id)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14}} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
              <div style={{width:36,height:36,borderRadius:10,background:is.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>💰</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{inv.notes||`Invoice #${inv.id.slice(-6)}`}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{li.length} item{li.length!==1?'s':''} · {fmtDate(inv.createdAt)}{inv.dueDate?` · Due ${fmtDate(inv.dueDate)}`:''}</div></div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>{badge(is.label,is.color,is.bg)}<span style={{fontSize:16,fontWeight:700,color:inv.status==='paid'?T.green:T.accent}}>{fmtMoney(inv.amount)}</span></div>
            </div>
          )})}
        </div>
      )}
    </div>)
  }
  function CreateInvoicePage(){
    const [sc,setSc]=useState('');const [items,setItems]=useState<{description:string;quantity:string;amount:string}[]>([{description:'Cleaning Service',quantity:'1',amount:'0'}]);const [dd,setDd]=useState('');const [notes,setNotes]=useState('');const [tax,setTax]=useState('0');const [sub,setSub]=useState(false)
    const st=items.reduce((s,x)=>(parseFloat(x.amount)||0)*(parseFloat(x.quantity)||1)+s,0),total=st+(parseFloat(tax)||0)
    async function go(){if(!sc){showToast('Select client','err');return};setSub(true);await createInvoice({toClientId:sc,amount:total,tax:parseFloat(tax)||0,lineItems:JSON.stringify(items.map(x=>({description:x.description,quantity:parseFloat(x.quantity)||1,amount:parseFloat(x.amount)||0}))),dueDate:dd||undefined,notes});setSub(false)}
    return pageWrap(560,<><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><button onClick={()=>setPage('invoices')} style={{...btnS,padding:'7px 12px'}}>← Back</button><h1 style={{fontSize:20,fontWeight:700,color:T.text}}>New Invoice</h1></div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Bill To')}<select value={sc} onChange={e=>setSc(e.target.value)} style={{...inp,cursor:'pointer'}}><option value="">Select client…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}</select></div>
      <div style={{...card,padding:'20px',marginBottom:12}}>{hdr('Items')}
        {items.map((x,i)=><div key={i} style={{display:'flex',gap:6,padding:'6px 0',borderBottom:`1px solid ${T.border}`,alignItems:'center'}}><input value={x.description} onChange={e=>{const u=[...items];u[i]={...u[i],description:e.target.value};setItems(u)}} style={{...inp,flex:1}} placeholder="Description"/><input value={x.quantity} onChange={e=>{const u=[...items];u[i]={...u[i],quantity:e.target.value};setItems(u)}} style={{...inp,width:44,textAlign:'center'}} placeholder="Qty" type="number"/><span style={{color:T.muted}}>$</span><input value={x.amount} onChange={e=>{const u=[...items];u[i]={...u[i],amount:e.target.value};setItems(u)}} style={{...inp,width:76,textAlign:'right'}} type="number" step="0.01"/>{items.length>1&&<button onClick={()=>setItems(items.filter((_,j)=>j!==i))} style={{width:22,height:22,borderRadius:5,border:`1px solid ${T.red}30`,background:T.redBg,color:T.red,cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}</div>)}
        <button onClick={()=>setItems([...items,{description:'',quantity:'1',amount:'0'}])} style={{marginTop:8,padding:'7px',borderRadius:8,border:`1px dashed ${T.border}`,background:'transparent',color:T.accent,cursor:'pointer',fontSize:12,fontWeight:500,width:'100%'}}>+ Add</button>
        <div style={{marginTop:10,padding:'10px 0',borderTop:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div>{label('Tax')}<div style={{display:'flex',alignItems:'center',gap:4}}><span style={{color:T.muted}}>$</span><input value={tax} onChange={e=>setTax(e.target.value)} style={{...inp,width:72}} type="number" step="0.01"/></div></div><div style={{textAlign:'right'}}><div style={{fontSize:10,color:T.dim}}>Total</div><div style={{fontSize:22,fontWeight:700,color:T.accent}}>{fmtMoney(total)}</div></div></div>
      </div>
      <div style={{...card,padding:'20px',marginBottom:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div>{label('Due Date')}<input type="date" value={dd} onChange={e=>setDd(e.target.value)} style={inp}/></div><div>{label('Notes')}<input value={notes} onChange={e=>setNotes(e.target.value)} style={inp} placeholder="Notes…"/></div></div></div>
      <button onClick={go} disabled={sub} style={{...btnP,width:'100%',padding:'12px',fontSize:14,opacity:sub?.6:1}}>{sub?'Creating…':'Create Invoice'}</button>
    </>)
  }
  function InvoiceDetailPage(){
    const inv=invoices.find(i=>i.id===activeInvoiceId);if(!inv)return <div style={{padding:48,color:T.dim,textAlign:'center'}}>Not found. <button onClick={()=>setPage('invoices')} style={{color:T.accent,background:'none',border:'none',cursor:'pointer'}}>Back</button></div>
    const is=INV_STATUS[inv.status]||INV_STATUS.draft;const li=(()=>{try{return JSON.parse(inv.lineItems)}catch{return[]}})() as {description:string;quantity:number;amount:number}[];const [cd,setCd]=useState(false)
    return pageWrap(620,<>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}><button onClick={()=>setPage('invoices')} style={{...btnS,padding:'7px 12px'}}>← Invoices</button><span style={{fontSize:13,fontWeight:600,color:T.text}}>#{inv.id.slice(-6)}</span>{badge(is.label,is.color,is.bg)}</div>
      <div style={{...card,padding:'26px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}><div><div style={{fontSize:20,fontWeight:700,color:T.text}}>Invoice #{inv.id.slice(-6)}</div><div style={{fontSize:12,color:T.muted,marginTop:4}}>Created {fmtDate(inv.createdAt)}{inv.dueDate?` · Due ${fmtDate(inv.dueDate)}`:''}</div>{inv.paidAt&&<div style={{fontSize:12,color:T.green,marginTop:2}}>Paid {fmtDate(inv.paidAt)}</div>}</div><div style={{fontSize:28,fontWeight:700,color:inv.status==='paid'?T.green:T.accent}}>{fmtMoney(inv.amount)}</div></div>
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',padding:'8px 0',borderBottom:`1.5px solid ${T.borderB}`,fontSize:11,fontWeight:600,color:T.dim}}><span style={{flex:1}}>Description</span><span style={{width:44,textAlign:'center'}}>Qty</span><span style={{width:72,textAlign:'right'}}>Amount</span></div>
          {li.map((x:any,i:number)=><div key={i} style={{display:'flex',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}><span style={{flex:1,fontSize:13,color:T.sub}}>{x.description}</span><span style={{width:44,textAlign:'center',fontSize:13,color:T.muted}}>{x.quantity||1}</span><span style={{width:72,textAlign:'right',fontSize:13,fontWeight:600,color:T.text}}>{fmtMoney((x.amount||0)*(x.quantity||1))}</span></div>)}
          {inv.tax>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span style={{fontSize:12,color:T.muted}}>Tax</span><span style={{fontSize:13,fontWeight:600,color:T.text}}>{fmtMoney(inv.tax)}</span></div>}
          <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:`2px solid ${T.borderB}`,marginTop:2}}><span style={{fontWeight:700,color:T.text}}>Total</span><span style={{fontWeight:700,fontSize:18,color:inv.status==='paid'?T.green:T.accent}}>{fmtMoney(inv.amount)}</span></div>
        </div>
        {inv.notes&&<div style={{padding:'10px 14px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted,marginBottom:14}}>{inv.notes}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <div style={{display:'flex',gap:6}}><button onClick={()=>window.open(`/api/invoices/${inv.id}/pdf`,'_blank')} style={{flex:1,padding:'9px',borderRadius:8,background:T.surf,border:`1px solid ${T.border}`,color:T.sub,fontSize:12,fontWeight:600,cursor:'pointer'}}>📄 PDF</button>{inv.status!=='paid'&&<button onClick={()=>createPaymentLink(inv.id)} style={{flex:1,padding:'9px',borderRadius:8,background:'#635bff',color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer'}}>💳 Payment Link</button>}</div>
          {inv.status==='draft'&&<button onClick={()=>updateInvoice(inv.id,{status:'sent'})} style={{...btnP,width:'100%',textAlign:'center'}}>Mark Sent</button>}
          {inv.status==='sent'&&<button onClick={()=>updateInvoice(inv.id,{status:'paid',paidAt:new Date().toISOString()})} style={{width:'100%',padding:'9px',borderRadius:8,background:T.green,color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}>✓ Mark Paid</button>}
          {inv.status==='sent'&&<button onClick={()=>updateInvoice(inv.id,{status:'overdue'})} style={{width:'100%',padding:'8px',borderRadius:8,background:T.redBg,color:T.red,border:'none',fontSize:12,fontWeight:500,cursor:'pointer'}}>Mark Overdue</button>}
          {!cd?<button onClick={()=>setCd(true)} style={{width:'100%',padding:'7px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.red,fontSize:11,cursor:'pointer',opacity:.5,marginTop:6}}>Delete</button>:(
            <div style={{background:T.redBg,borderRadius:8,padding:'12px',marginTop:6}}><div style={{fontSize:12,fontWeight:600,color:T.red,marginBottom:6}}>Confirm?</div><div style={{display:'flex',gap:6}}><button onClick={()=>setCd(false)} style={{...btnS,flex:1,fontSize:11}}>No</button><button onClick={()=>deleteInvoice(inv.id)} style={{flex:1,padding:'7px',borderRadius:6,border:'none',background:T.red,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600}}>Delete</button></div></div>
          )}
        </div>
      </div>
    </>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // CALENDAR — scrollable fixed grid, property colors, job popups
  // ══════════════════════════════════════════════════════════════════════
  function CalendarPage(){
    const [calDate,setCalDate]=useState(new Date())
    const yr=calDate.getFullYear(),mo=calDate.getMonth(),today=new Date()
    const first=new Date(yr,mo,1),dow=first.getDay(),last=new Date(yr,mo+1,0)
    // Build cells INCLUDING actual dates for pad days
    type Cell={day:number;date:Date;isPad:boolean}
    const cells:Cell[]=[]
    for(let i=0;i<dow;i++){const d=new Date(yr,mo,-dow+i+1);cells.push({day:d.getDate(),date:d,isPad:true})}
    for(let d=1;d<=last.getDate();d++) cells.push({day:d,date:new Date(yr,mo,d),isPad:false})
    const trail=(dow+last.getDate())%7;if(trail) for(let i=1;i<=7-trail;i++){const d=new Date(yr,mo+1,i);cells.push({day:d.getDate(),date:d,isPad:true})}
    const rows=cells.length/7
    const allJobs=jobs.sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime())
    function jobsOn(d:Date){return allJobs.filter(j=>sameDay(new Date(j.checkoutTime),d))}
    function quotesOn(d:Date){return quotes.filter(q=>(q.preferredDate1&&sameDay(new Date(q.preferredDate1),d))||(q.preferredDate2&&sameDay(new Date(q.preferredDate2),d)))}

    // Property state
    const [propColors,setPropColors]=useState<Record<string,string>>(()=>{if(typeof window==='undefined')return{};try{return JSON.parse(localStorage.getItem('cs_propColors')||'{}')}catch{return{}}})
    const [propNames,setPropNames]=useState<Record<string,string>>(()=>{if(typeof window==='undefined')return{};try{return JSON.parse(localStorage.getItem('cs_propNames')||'{}')}catch{return{}}})
    const [colorRules,setColorRules]=useState<{keyword:string;color:string}[]>(()=>{if(typeof window==='undefined')return[];try{return JSON.parse(localStorage.getItem('cs_colorRules')||'[]')}catch{return[]}})
    function sPC(c:Record<string,string>){setPropColors(c);localStorage.setItem('cs_propColors',JSON.stringify(c))}
    function sPN(n:Record<string,string>){setPropNames(n);localStorage.setItem('cs_propNames',JSON.stringify(n))}
    function sCR(r:{keyword:string;color:string}[]){setColorRules(r);localStorage.setItem('cs_colorRules',JSON.stringify(r))}
    const PAL=['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#e11d48']
    function jColor(j:Job):string{const lb=j.propertyLabel||j.displayName,lw=lb.toLowerCase();for(const r of colorRules){if(r.keyword&&lw.includes(r.keyword.toLowerCase()))return r.color};if(propColors[lb])return propColors[lb];if(j.platform==='hostaway')return'#f59e0b';if(j.platform==='jobber')return'#3b82f6';if(j.platform==='airbnb')return'#ef4444';return'#6366f1'}
    function jName(j:Job):string{return propNames[j.propertyLabel||j.displayName]||j.displayName}
    const allProps=[...new Set(allJobs.map(j=>j.propertyLabel||j.displayName))].sort()

    const [expandDay,setExpandDay]=useState<string|null>(null)
    const [showCfg,setShowCfg]=useState(false)
    const [newRule,setNewRule]=useState({keyword:'',color:'#f59e0b'})
    const [renKey,setRenKey]=useState<string|null>(null),[renVal,setRenVal]=useState('')

    // Job popup
    const [cj,setCj]=useState<Job|null>(null),[ejMode,setEjMode]=useState(false)
    const [ej,setEj]=useState({address:'',sqft:'',beds:'',baths:'',notes:'',customerName:'',worth:''}),[sjSav,setSjSav]=useState(false)
    function openCJ(j:Job,e:React.MouseEvent){e.stopPropagation();setCj(j);setEjMode(false);setEj({address:j.address||'',sqft:j.sqft?.toString()||'',beds:j.beds?.toString()||'',baths:j.baths?.toString()||'',notes:j.notes||'',customerName:j.customerName||'',worth:j.worth?.toString()||''})}
    async function saveCJ(){if(!cj)return;setSjSav(true);await fetch(`/api/jobs/${cj.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:ej.address||null,sqft:ej.sqft?parseInt(ej.sqft):null,beds:ej.beds?parseInt(ej.beds):null,baths:ej.baths?parseFloat(ej.baths):null,notes:ej.notes||null,customerName:ej.customerName||null,worth:ej.worth?parseFloat(ej.worth):null})});await load();setSjSav(false);setEjMode(false);showToast('Updated')}

    return(<div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:'calc(100vh - 72px)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexShrink:0}}>
        <div><h1 style={{fontSize:24,fontWeight:700,color:T.text,letterSpacing:-0.4}}>{calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h1><div style={{fontSize:12,color:T.muted,marginTop:3}}>{upcoming.length} upcoming · {allProps.length} properties</div></div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={()=>setShowCfg(!showCfg)} style={{height:34,padding:'0 14px',borderRadius:8,border:`1px solid ${showCfg?T.accentBorder:T.border}`,background:showCfg?T.accentBg:'transparent',color:showCfg?T.accent:T.muted,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'"Inter",sans-serif'}}>⚙ Colors</button>
          <div style={{width:1,height:18,background:T.border}}/>
          <button onClick={()=>setCalDate(new Date(yr,mo-1,1))} style={{width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.sub,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <button onClick={()=>setCalDate(new Date())} style={{padding:'0 16px',height:34,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.accent,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'"Inter",sans-serif'}}>Today</button>
          <button onClick={()=>setCalDate(new Date(yr,mo+1,1))} style={{width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.sub,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
        </div>
      </div>

      {/* Config Panel */}
      {showCfg&&<div style={{...card,padding:'20px',marginBottom:14,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><span style={{fontSize:15,fontWeight:700,color:T.text}}>Property Colors</span><button onClick={()=>setShowCfg(false)} style={{width:24,height:24,borderRadius:6,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:11}}>×</button></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:6,marginBottom:14,maxHeight:180,overflowY:'auto'}}>
          {allProps.map(p=>{const cc=propColors[p]||(colorRules.find(r=>p.toLowerCase().includes(r.keyword.toLowerCase()))?.color)||'#6366f1';const isR=renKey===p;return(
            <div key={p} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>
              <div style={{width:20,height:20,borderRadius:5,background:cc,cursor:'pointer',border:'2px solid rgba(255,255,255,0.1)',flexShrink:0}} onClick={()=>{const i=PAL.indexOf(cc);sPC({...propColors,[p]:PAL[(i+1)%PAL.length]})}} title="Change color"/>
              {isR?<div style={{flex:1,display:'flex',gap:3}}><input value={renVal} onChange={e=>setRenVal(e.target.value)} style={{...inp,padding:'4px 8px',fontSize:12,flex:1}} autoFocus onKeyDown={e=>{if(e.key==='Enter'){sPN({...propNames,[p]:renVal});setRenKey(null)}if(e.key==='Escape')setRenKey(null)}}/><button onClick={()=>{sPN({...propNames,[p]:renVal});setRenKey(null)}} style={{padding:'4px 8px',borderRadius:5,border:'none',background:T.accent,color:'#fff',cursor:'pointer',fontSize:10,fontWeight:600}}>✓</button></div>:(
                <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>{setRenKey(p);setRenVal(propNames[p]||p)}}><div style={{fontSize:12,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{propNames[p]||p}</div>{propNames[p]&&propNames[p]!==p&&<div style={{fontSize:9,color:T.dim,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p}</div>}</div>
              )}
            </div>
          )})}
        </div>
        <div style={{fontSize:11,fontWeight:600,color:T.dim,marginBottom:8}}>Rules</div>
        {colorRules.map((r,i)=><div key={i} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',background:T.surf,borderRadius:6,border:`1px solid ${T.border}`,marginRight:4,marginBottom:4}}><div style={{width:12,height:12,borderRadius:3,background:r.color}}/><span style={{fontSize:11,color:T.text}}>"{r.keyword}"</span><button onClick={()=>sCR(colorRules.filter((_,j)=>j!==i))} style={{fontSize:10,color:T.dim,background:'none',border:'none',cursor:'pointer',marginLeft:2}}>×</button></div>)}
        <div style={{display:'flex',gap:6,marginTop:8}}><input value={newRule.keyword} onChange={e=>setNewRule({...newRule,keyword:e.target.value})} placeholder='e.g. "Mike"' style={{...inp,flex:1,padding:'7px 10px',fontSize:12}}/><div style={{display:'flex',gap:2,alignItems:'center'}}>{PAL.slice(0,6).map(c=><div key={c} onClick={()=>setNewRule({...newRule,color:c})} style={{width:18,height:18,borderRadius:4,background:c,cursor:'pointer',border:newRule.color===c?'2px solid #fff':'2px solid transparent'}}/>)}</div><button onClick={()=>{if(newRule.keyword.trim()){sCR([...colorRules,{keyword:newRule.keyword.trim(),color:newRule.color}]);setNewRule({keyword:'',color:'#f59e0b'})}}} style={{padding:'7px 14px',borderRadius:6,border:'none',background:T.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>Add</button></div>
      </div>}

      {/* Calendar grid — table-based for equal columns */}
      <div style={{flex:1,border:`1px solid ${T.border}`,borderRadius:12,overflow:'hidden',boxShadow:T.shadow,minHeight:0,display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
            <thead>
              <tr>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><th key={d} style={{padding:'10px 0',textAlign:'center',fontSize:12,fontWeight:600,color:T.muted,background:dark?'rgba(255,255,255,0.015)':'rgba(0,0,0,0.02)',borderBottom:`1px solid ${T.border}`,position:'sticky',top:0,zIndex:2}}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({length:rows},(_,rowIdx)=>{
                const rowCells=cells.slice(rowIdx*7,(rowIdx+1)*7)
                const rowKey=rowCells.map(c=>c.date.toISOString().split('T')[0]).join(',')
                // Check if any cell in this row is expanded
                const rowExpanded=rowCells.some(c=>expandDay===c.date.toISOString().split('T')[0])
                return(
                  <tr key={rowIdx}>
                    {rowCells.map((cell,ci)=>{
                      const isT=sameDay(cell.date,today)
                      const dj=jobsOn(cell.date),dq=quotesOn(cell.date)
                      const allEv=[...dj.map(j=>({t:'j' as const,j})),...dq.map(q=>({t:'q' as const,q}))]
                      const dk=cell.date.toISOString().split('T')[0]
                      const isExp=expandDay===dk
                      const vis=isExp?allEv:allEv.slice(0,5)
                      const over=allEv.length-5
                      const padOp=cell.isPad?0.4:1

                      return(
                        <td key={ci} style={{borderRight:ci<6?`1px solid ${T.border}`:'none',borderBottom:rowIdx<rows-1?`1px solid ${T.border}`:'none',padding:'5px 6px',verticalAlign:'top',background:isT&&!cell.isPad?(dark?'rgba(56,189,248,0.04)':'rgba(2,132,199,0.04)'):'transparent',opacity:padOp,height:rowExpanded?'auto':'100px',overflow:'hidden',position:'relative'}}>
                          {/* Day number */}
                          <div style={{marginBottom:3}}>
                            <span style={{fontSize:13,fontWeight:isT?700:cell.isPad?400:500,color:isT?T.accent:cell.isPad?T.dim:T.sub,width:26,height:26,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',background:isT&&!cell.isPad?(dark?'rgba(56,189,248,0.1)':'rgba(2,132,199,0.08)'):'transparent'}}>{cell.day}</span>
                          </div>
                          {/* Events */}
                          <div style={{display:'flex',flexDirection:'column',gap:2}}>
                            {vis.map(ev=>{
                              if(ev.t==='j'){const j=ev.j,c=jColor(j);return(
                                <div key={j.id} onClick={e=>openCJ(j,e)} style={{padding:'2px 5px',borderRadius:4,background:`${c}18`,borderLeft:`3px solid ${c}`,cursor:'pointer',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',transition:'background .1s'}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=`${c}28`}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=`${c}18`}}>
                                  <span style={{fontSize:10,fontWeight:600,color:c,opacity:.7}}>{fmtTime(j.checkoutTime)} </span>
                                  <span style={{fontSize:11,fontWeight:600,color:cell.isPad?T.dim:T.text}}>{jName(j)}</span>
                                </div>
                              )}
                              if(ev.t==='q'){const q=ev.q;return(
                                <div key={q.id} onClick={e=>{e.stopPropagation();openQuote(q)}} style={{padding:'2px 5px',borderRadius:4,background:T.greenBg,borderLeft:`3px solid ${T.green}`,cursor:'pointer',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                                  <span style={{fontSize:11,fontWeight:600,color:T.green}}>{q.client.firstName} {q.client.lastName.charAt(0)}.</span>
                                </div>
                              )}
                              return null
                            })}
                            {!isExp&&over>0&&<button onClick={e=>{e.stopPropagation();setExpandDay(dk)}} style={{fontSize:10,color:T.accent,fontWeight:600,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:'2px 4px'}}>+{over} more</button>}
                            {isExp&&allEv.length>5&&<button onClick={e=>{e.stopPropagation();setExpandDay(null)}} style={{fontSize:10,color:T.dim,fontWeight:500,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:'2px 4px'}}>less</button>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Detail Popup */}
      {cj&&(()=>{const j=cj,c=jColor(j);let duties:{title?:string;description?:string}[]=[];try{duties=JSON.parse(j.duties||'[]')}catch{};const jI=ejMode?{...inp,padding:'8px 10px',fontSize:12} as React.CSSProperties:{} as React.CSSProperties;return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(10px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setCj(null)}>
          <div style={{background:dark?'rgba(15,17,23,0.98)':'#fff',border:`1px solid ${T.borderB}`,borderRadius:16,width:'100%',maxWidth:520,boxShadow:T.shadowLg,maxHeight:'88vh',overflowY:'auto',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{height:4,background:c,borderRadius:'16px 16px 0 0',flexShrink:0}}/>
            <div style={{padding:'22px 26px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
                <div style={{flex:1}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>{jName(j)}</div><div style={{fontSize:12,color:T.muted,marginTop:3}}>{j.propertyLabel}</div><div style={{display:'flex',gap:6,marginTop:8}}>{badge(j.platform,c,`${c}18`)}{sameDay(new Date(j.checkoutTime),today)&&badge('Today',T.accent,T.accentBg)}</div></div>
                <div style={{display:'flex',gap:6}}><button onClick={()=>{if(ejMode){saveCJ()}else setEjMode(true)}} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${ejMode?T.accentBorder:T.border}`,background:ejMode?T.accentBg:'transparent',color:ejMode?T.accent:T.muted,cursor:'pointer',fontSize:11,fontWeight:600}}>{sjSav?'…':ejMode?'Save':'Edit'}</button><button onClick={()=>setCj(null)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'14px',background:T.surf,borderRadius:10,marginBottom:16}}>
                <div><div style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>Checkout</div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{fmtDate(j.checkoutTime)}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{fmtTime(j.checkoutTime)}</div></div>
                <div><div style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>Check-in</div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{j.checkinTime?fmtDate(j.checkinTime):'—'}</div>{j.checkinTime&&<div style={{fontSize:12,color:T.muted,marginTop:1}}>{fmtTime(j.checkinTime)}</div>}</div>
              </div>
              <div style={{fontSize:11,fontWeight:600,color:T.dim,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>Property</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                {[{l:'Address',k:'address',span:true},{l:'Guest',k:'customerName'},{l:'Worth',k:'worth'},{l:'Sq Ft',k:'sqft'},{l:'Beds',k:'beds'},{l:'Baths',k:'baths'}].map(f=><div key={f.k} style={(f as any).span?{gridColumn:'1/-1'}:{}}><div style={{fontSize:10,fontWeight:500,color:T.dim,marginBottom:3}}>{f.l}</div>{ejMode?<input value={(ej as any)[f.k]||''} onChange={e=>setEj({...ej,[f.k]:e.target.value})} style={jI}/>:<div style={{fontSize:13,fontWeight:500,color:T.text}}>{f.k==='worth'&&j.worth?fmtMoney(j.worth):(j as any)[f.k]||'—'}</div>}</div>)}
              </div>
              {duties.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:600,color:T.dim,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>Duties</div>{duties.map((d,i)=><div key={i} style={{padding:'8px 12px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:4}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>{d.title||`Task ${i+1}`}</div>{d.description&&<div style={{fontSize:11,color:T.muted,marginTop:2,lineHeight:1.5}}>{d.description}</div>}</div>)}</div>}
              {ejMode?<div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:500,color:T.dim,marginBottom:3}}>Notes</div><textarea value={ej.notes} onChange={e=>setEj({...ej,notes:e.target.value})} rows={3} style={{...jI,width:'100%',resize:'vertical'}}/></div>:j.notes&&<div style={{padding:'10px 14px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.muted,lineHeight:1.5,marginBottom:14}}>{j.notes}</div>}
              {ejMode&&<div style={{display:'flex',gap:6}}><button onClick={()=>setEjMode(false)} style={{...btnS,flex:1}}>Cancel</button><button onClick={saveCJ} disabled={sjSav} style={{...btnP,flex:1,textAlign:'center'}}>{sjSav?'…':'Save'}</button></div>}
            </div>
          </div>
        </div>
      )})()}
    </div>)
  }

  // ══════════════════════════════════════════════════════════════════════
  // REPORTS
  // ══════════════════════════════════════════════════════════════════════
  function ReportsPage(){
    const months:string[]=[],mR:number[]=[],mQ:number[]=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(d.toLocaleDateString('en-US',{month:'short'}));const mq=quotes.filter(q=>{const qd=new Date(q.createdAt);return qd.getMonth()===d.getMonth()&&qd.getFullYear()===d.getFullYear()});mQ.push(mq.length);mR.push(mq.filter(q=>['completed','booked'].includes(q.status)).reduce((s,q)=>s+q.totalPrice,0))};const mx=Math.max(...mR,1)
    const topC=clients.map(c=>{const cq=quotes.filter(q=>q.clientId===c.id&&['completed','booked'].includes(q.status));return{c,r:cq.reduce((s,q)=>s+q.totalPrice,0),n:cq.length}}).sort((a,b)=>b.r-a.r).slice(0,5)
    const svcs:Record<string,{n:number;r:number}>={};quotes.forEach(q=>{if(!svcs[q.serviceType])svcs[q.serviceType]={n:0,r:0};svcs[q.serviceType].n++;if(['completed','booked'].includes(q.status))svcs[q.serviceType].r+=q.totalPrice});const sArr=Object.entries(svcs).sort((a,b)=>b[1].r-a[1].r)
    return(<div style={{maxWidth:960,margin:'0 auto'}}>{pageTitle('Reports','Business overview')}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>{[{l:'Revenue',v:fmtMoney(totalRevenue),c:T.green},{l:'Avg Quote',v:fmtMoney(avgQuote),c:T.accent},{l:'Conversion',v:`${conversionRate}%`,c:T.amber},{l:'Clients',v:String(clients.filter(c=>quotes.some(q=>q.clientId===c.id)).length),c:T.violet}].map(s=><div key={s.l} style={{...card,padding:'16px'}}><div style={{fontSize:11,fontWeight:500,color:T.muted,marginBottom:5}}>{s.l}</div><div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div></div>)}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:14}}>
        <div style={{...card,padding:'22px'}}>{hdr('Monthly Revenue')}<div style={{display:'flex',gap:10,alignItems:'flex-end',height:180,paddingTop:10}}>{months.map((m,i)=><div key={m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{fontSize:10,fontWeight:600,color:T.accent,opacity:mR[i]>0?1:0}}>{mR[i]>0?fmtMoney(mR[i]):''}</div><div style={{width:'100%',maxWidth:44,borderRadius:'6px 6px 0 0',background:T.accent,height:`${Math.max(4,(mR[i]/mx)*140)}px`,transition:'height .3s',opacity:.85}}/><div style={{fontSize:10,fontWeight:600,color:T.muted}}>{m}</div><div style={{fontSize:9,color:T.dim}}>{mQ[i]}q</div></div>)}</div></div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{...card,padding:'20px'}}>{hdr('Top Clients')}{topC.length===0?<div style={{color:T.dim,fontSize:12}}>No data.</div>:topC.map((x,i)=><div key={x.c.id} onClick={()=>openClient(x.c)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px',borderRadius:8,cursor:'pointer',transition:'background .1s'}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=T.surf}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background='transparent'}}><span style={{fontSize:12,fontWeight:700,color:T.dim,width:16}}>{i+1}</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.text}}>{x.c.firstName} {x.c.lastName}</div><div style={{fontSize:10,color:T.dim}}>{x.n} job{x.n!==1?'s':''}</div></div><span style={{fontSize:13,fontWeight:700,color:T.green}}>{fmtMoney(x.r)}</span></div>)}</div>
          <div style={{...card,padding:'20px'}}>{hdr('Services')}{sArr.length===0?<div style={{color:T.dim,fontSize:12}}>No data.</div>:sArr.map(([n,d])=><div key={n} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`}}><div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{n}</div><div style={{fontSize:10,color:T.dim}}>{d.n}q</div></div><span style={{fontSize:13,fontWeight:600,color:T.accent}}>{fmtMoney(d.r)}</span></div>)}</div>
        </div>
      </div>
    </div>)
  }

  // ACTIVITY
  function ActivityPage(){
    const [f,setF]=useState<'all'|'quote'|'invoice'>('all')
    type Ev={id:string;type:'quote'|'invoice';title:string;desc:string;time:string;color:string;status:string}
    const evs:Ev[]=[...quotes.map(q=>({id:q.id,type:'quote' as const,title:`${q.client.firstName} ${q.client.lastName}`,desc:`${q.serviceType} · ${fmtMoney(q.totalPrice)}`,time:q.createdAt,color:(STATUS[q.status]||STATUS.pending).color,status:q.status})),...invoices.map(i=>({id:i.id,type:'invoice' as const,title:`Invoice #${i.id.slice(-6)}`,desc:fmtMoney(i.amount),time:i.createdAt,color:(INV_STATUS[i.status]||INV_STATUS.draft).color,status:i.status}))].filter(e=>f==='all'||e.type===f).sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime())
    return(<div style={{maxWidth:660,margin:'0 auto'}}>{pageTitle('Activity','Timeline')}
      <div style={{display:'flex',gap:2,background:T.surf,borderRadius:8,padding:2,border:`1px solid ${T.border}`,marginBottom:20,width:'fit-content'}}>{([['all','All'],['quote','Quotes'],['invoice','Invoices']] as const).map(([k,l])=><button key={k} onClick={()=>setF(k)} style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:f===k?600:400,background:f===k?T.card:'transparent',color:f===k?T.text:T.muted,boxShadow:f===k?T.shadow:'none'}}>{l}</button>)}</div>
      {evs.length===0?<div style={{textAlign:'center',padding:'48px 0',color:T.dim}}>No activity.</div>:(
        <div style={{position:'relative',paddingLeft:24}}><div style={{position:'absolute',left:7,top:8,bottom:8,width:1.5,background:T.border}}/>
          {evs.map(ev=><div key={ev.id+ev.type} onClick={()=>ev.type==='quote'?openQuote(quotes.find(q=>q.id===ev.id)!):openInvoice(ev.id)} style={{display:'flex',gap:12,padding:'12px 0',cursor:'pointer',position:'relative'}}>
            <div style={{width:12,height:12,borderRadius:'50%',background:ev.color,border:`3px solid ${T.bg}`,position:'absolute',left:-24,top:16,zIndex:1}}/>
            <div style={{flex:1,paddingLeft:4}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}><span style={{fontSize:13,fontWeight:600,color:T.text}}>{ev.title}</span>{badge(ev.type==='quote'?'Quote':'Invoice',ev.type==='quote'?T.accent:T.amber,ev.type==='quote'?T.accentBg:T.amberBg)}{badge(ev.status,ev.color,`${ev.color}18`)}</div><div style={{fontSize:12,color:T.muted}}>{ev.desc}</div><div style={{fontSize:10,color:T.dim,marginTop:2}}>{fmtRel(ev.time)} · {fmtDate(ev.time)}</div></div>
          </div>)}
        </div>
      )}
    </div>)
  }

  // INTEGRATIONS
  function IntegrationsPage(){
    const [ja,setJa]=useState<any[]>([]),[ha,setHa]=useState<any[]>([]),[ga,setGa]=useState<any[]>([]),[syncing,setSyncing]=useState<string|null>(null),[msg,setMsg]=useState<string|null>(null)
    useEffect(()=>{fetch('/api/jobber/accounts').then(r=>r.json()).then(d=>setJa(Array.isArray(d)?d:[])).catch(()=>{});fetch('/api/hostaway/accounts').then(r=>r.json()).then(d=>setHa(Array.isArray(d)?d:[])).catch(()=>{});fetch('/api/gmail/accounts').then(r=>r.json()).then(d=>setGa(Array.isArray(d)?d:[])).catch(()=>{})},[])
    async function sJ(){setSyncing('j');setMsg(null);const r=await fetch('/api/jobber/sync',{method:'POST'});const d=await r.json();if(d.error?.includes('NEEDS_RECONNECT'))setMsg('⚠ Reconnect Jobber');else{setMsg(`✓ ${d.imported??0} new`);load()};setSyncing(null)}
    async function sH(){setSyncing('h');setMsg(null);const r=await fetch('/api/hostaway/sync',{method:'POST'});const d=await r.json();const t=Array.isArray(d)?d.reduce((s:number,x:any)=>s+(x.imported||0),0):0;setMsg(`✓ ${t} new`);load();setSyncing(null)}
    async function cJ(){const r=await fetch('/api/jobber/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    async function cG(){const r=await fetch('/api/gmail/accounts',{method:'POST'});const d=await r.json();window.location.href=d.url}
    const intgs=[{n:'Booking Form',i:'🧹',d:'Auto-sync submissions',s:'live',c:T.accent,t:'bk'},{n:'Hostaway',i:'🔑',d:'iCal sync',s:ha.length>0?'on':'off',c:'#f59e0b',t:'ha'},{n:'Jobber',i:'💼',d:'Visits & events',s:ja.length>0?'on':'off',c:'#3b82f6',t:'jo'},{n:'Gmail',i:'✉️',d:'Email',s:ga.length>0?'on':'off',c:'#ef4444',t:'gm'},{n:'Stripe',i:'💳',d:'Payments (Test)',s:'on',c:'#6366f1',t:'st'},{n:'QuickBooks',i:'📊',d:'Accounting',s:'soon',c:'#10b981',t:'qb'},{n:'Google Cal',i:'📅',d:'Two-way sync',s:'soon',c:'#3b82f6',t:'gc'},{n:'Zapier',i:'⚡',d:'Automations',s:'soon',c:'#f97316',t:'za'}]
    return(<div>{pageTitle('Integrations','Connect your platforms')}
      {msg&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:8,fontSize:12,background:msg.startsWith('✓')?T.greenBg:T.amberBg,color:msg.startsWith('✓')?T.green:T.amber,border:`1px solid ${msg.startsWith('✓')?`${T.green}20`:`${T.amber}20`}`}}>{msg}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
        {intgs.map(ig=><div key={ig.n} style={{...card,padding:'18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:38,height:38,borderRadius:10,background:`${ig.c}12`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,border:`1px solid ${ig.c}20`,flexShrink:0}}>{ig.i}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{ig.n}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{ig.d}</div></div>{badge(ig.s==='on'||ig.s==='live'?ig.s==='live'?'Live':'Connected':ig.s==='soon'?'Soon':'—',ig.s==='on'||ig.s==='live'?T.green:ig.s==='soon'?T.dim:T.muted,ig.s==='on'||ig.s==='live'?T.greenBg:T.accentBg)}</div>
          {ig.t==='ha'&&ha.length>0&&<div style={{marginBottom:8}}>{ha.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',background:T.surf,borderRadius:6,border:`1px solid ${T.border}`,fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{a.name}</span><span style={{color:T.dim}}>#{a.listingId}</span></div>)}</div>}
          {ig.t==='jo'&&ja.length>0&&<div style={{marginBottom:8}}>{ja.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',background:T.surf,borderRadius:6,border:`1px solid ${T.border}`,fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{a.companyName||a.email}</span><span style={{color:T.dim}}>{fmtRel(a.lastSynced)}</span></div>)}</div>}
          {ig.t==='gm'&&ga.length>0&&<div style={{marginBottom:8}}>{ga.map((a:any)=><div key={a.id} style={{padding:'6px 8px',background:T.surf,borderRadius:6,border:`1px solid ${T.border}`,fontSize:12,color:T.text,marginBottom:3}}>{a.email}</div>)}</div>}
          {ig.t==='bk'&&<div style={{fontSize:12,color:T.muted,padding:'8px 10px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>{quotes.length} received · {pending.length} pending</div>}
          {ig.t==='ha'&&<button onClick={sH} disabled={syncing==='h'} style={{width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${ig.c}30`,background:`${ig.c}08`,color:ig.c,fontSize:12,fontWeight:600,cursor:'pointer'}}>{syncing==='h'?'Syncing…':'Sync'}</button>}
          {ig.t==='jo'&&<div style={{display:'flex',gap:4}}>{ja.length>0&&<button onClick={sJ} disabled={!!syncing} style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${ig.c}30`,background:`${ig.c}08`,color:ig.c,fontSize:12,fontWeight:600,cursor:'pointer'}}>{syncing==='j'?'…':'Sync'}</button>}<button onClick={cJ} style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${ig.c}30`,background:`${ig.c}08`,color:ig.c,fontSize:12,fontWeight:600,cursor:'pointer'}}>{ja.length>0?'+ Add':'Connect'}</button></div>}
          {ig.t==='gm'&&<button onClick={cG} style={{width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${ig.c}30`,background:`${ig.c}08`,color:ig.c,fontSize:12,fontWeight:600,cursor:'pointer'}}>{ga.length>0?'+ Add':'Connect'}</button>}
          {ig.s==='soon'&&<div style={{padding:'6px',textAlign:'center',fontSize:11,color:T.dim}}>Coming Soon</div>}
        </div>)}
      </div>
    </div>)
  }

  // SETTINGS
  function SettingsPage(){return pageWrap(620,<>{pageTitle('Settings')}
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{...card,padding:'20px'}}>{hdr('Account')}{[{l:'Name',v:user!.name},{l:'Email',v:user!.email},{l:'Role',v:'Cleaner'},{l:'Phone',v:user!.phone||'—'},{l:'Company',v:user!.company||'—'}].map(f=><div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:12,color:T.muted}}>{f.l}</span><span style={{fontSize:12,fontWeight:600,color:T.text}}>{f.v}</span></div>)}</div>
      <div style={{...card,padding:'20px'}}>{hdr('Notifications')}{['New quote received','Status changes','Payment received','Daily summary'].map(it=><div key={it} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.sub}}>{it}</span><div style={{width:34,height:18,borderRadius:9,background:T.accentBg,border:`1px solid ${T.accentBorder}`,position:'relative',cursor:'pointer'}}><div style={{width:12,height:12,borderRadius:'50%',background:T.accent,position:'absolute',right:2,top:2}}/></div></div>)}</div>
      <div style={{...card,padding:'20px'}}><button onClick={logout} style={{padding:'10px 20px',borderRadius:8,background:T.redBg,color:T.red,border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}>Sign Out</button></div>
    </div>
  </>)}

  // JOB MODAL (from Jobs page / Dashboard)
  function JobModal(){
    if(!selectedJob)return null;const j=selectedJob
    const [eM,setEM]=useState(false),[em,setEm]=useState({address:j.address||'',sqft:j.sqft?.toString()||'',beds:j.beds?.toString()||'',baths:j.baths?.toString()||'',notes:j.notes||'',customerName:j.customerName||'',worth:j.worth?.toString()||''}),[sv,setSv]=useState(false)
    async function sav(){setSv(true);await fetch(`/api/jobs/${j.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:em.address||null,sqft:em.sqft?parseInt(em.sqft):null,beds:em.beds?parseInt(em.beds):null,baths:em.baths?parseFloat(em.baths):null,notes:em.notes||null,customerName:em.customerName||null,worth:em.worth?parseFloat(em.worth):null})});await load();setSv(false);setEM(false);showToast('Updated')}
    let duties:{title?:string;description?:string}[]=[];try{duties=JSON.parse(j.duties||'[]')}catch{}
    const mI=eM?{...inp,padding:'7px 10px',fontSize:12} as React.CSSProperties:{} as React.CSSProperties
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(10px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setSelectedJob(null)}>
        <div style={{background:dark?'rgba(15,17,23,0.98)':'#fff',border:`1px solid ${T.borderB}`,borderRadius:16,width:'100%',maxWidth:480,boxShadow:T.shadowLg,padding:'24px',maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div><div style={{fontSize:17,fontWeight:700,color:T.text}}>{j.displayName}</div><div style={{fontSize:12,color:T.muted,marginTop:3}}>{j.propertyLabel}</div></div>
            <div style={{display:'flex',gap:4}}><button onClick={()=>{if(eM){sav()}else{setEM(true);setEm({address:j.address||'',sqft:j.sqft?.toString()||'',beds:j.beds?.toString()||'',baths:j.baths?.toString()||'',notes:j.notes||'',customerName:j.customerName||'',worth:j.worth?.toString()||''})}}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${eM?T.accentBorder:T.border}`,background:eM?T.accentBg:'transparent',color:eM?T.accent:T.muted,cursor:'pointer',fontSize:10,fontWeight:600}}>{sv?'…':eM?'Save':'Edit'}</button><button onClick={()=>setSelectedJob(null)} style={{width:28,height:28,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>
          </div>
          {[{l:'Platform',v:j.platform},{l:'Checkout',v:`${fmtDate(j.checkoutTime)} · ${fmtTime(j.checkoutTime)}`},{l:'Check-in',v:j.checkinTime?`${fmtDate(j.checkinTime)} · ${fmtTime(j.checkinTime)}`:'—'}].map(f=><div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:11,color:T.muted}}>{f.l}</span><span style={{fontSize:12,fontWeight:500,color:T.text}}>{f.v}</span></div>)}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12,marginBottom:12}}>
            {[{l:'Address',k:'address',span:true},{l:'Guest',k:'customerName'},{l:'Worth',k:'worth'},{l:'Sq Ft',k:'sqft'},{l:'Beds',k:'beds'},{l:'Baths',k:'baths'}].map(f=><div key={f.k} style={(f as any).span?{gridColumn:'1/-1'}:{}}><div style={{fontSize:10,fontWeight:500,color:T.dim,marginBottom:2}}>{f.l}</div>{eM?<input value={(em as any)[f.k]||''} onChange={e=>setEm({...em,[f.k]:e.target.value})} style={mI}/>:<div style={{fontSize:12,color:T.text}}>{f.k==='worth'&&j.worth?fmtMoney(j.worth):(j as any)[f.k]||'—'}</div>}</div>)}
          </div>
          {duties.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:10,fontWeight:500,color:T.dim,marginBottom:6}}>Duties</div>{duties.map((d,i)=><div key={i} style={{padding:'6px 8px',background:T.surf,borderRadius:6,border:`1px solid ${T.border}`,marginBottom:3}}><div style={{fontSize:11,fontWeight:600,color:T.text}}>{d.title||`Task ${i+1}`}</div>{d.description&&<div style={{fontSize:10,color:T.muted,marginTop:1}}>{d.description}</div>}</div>)}</div>}
          {eM?<div><div style={{fontSize:10,fontWeight:500,color:T.dim,marginBottom:2}}>Notes</div><textarea value={em.notes} onChange={e=>setEm({...em,notes:e.target.value})} rows={3} style={{...mI,width:'100%',resize:'vertical'}}/></div>:j.notes&&<div style={{padding:'8px 10px',background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,fontSize:11,color:T.muted}}>{j.notes}</div>}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // LAYOUT & NAV
  // ══════════════════════════════════════════════════════════════════════
  const NAV:[Page,string,string,number?][]=[['dashboard','◉','Dashboard'],['calendar','📅','Calendar'],['quotes','📋','Quotes',pending.length||undefined],['jobs','🗓','Jobs',upcoming.length||undefined],['clients','👤','Clients'],['invoices','💰','Invoices',invoices.filter(i=>i.status==='sent').length||undefined],['reports','📊','Reports'],['activity','⏱','Activity'],['integrations','🔗','Integrations'],['settings','⚙️','Settings']]
  const activeNav=(['quote-detail','create-quote','convert-to-job'].includes(page)?'quotes':['create-job'].includes(page)?'jobs':['create-client','client-detail'].includes(page)?'clients':['create-invoice','invoice-detail'].includes(page)?'invoices':page) as Page

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:T.bg,fontFamily:'"Inter",-apple-system,BlinkMacSystemFont,sans-serif'}}>
      {/* Sidebar — always dark */}
      <nav style={{width:collapsed?56:200,minWidth:collapsed?56:200,background:dark?'#0b0e14':'#0f2b42',borderRight:`1px solid rgba(255,255,255,0.06)`,display:'flex',flexDirection:'column',transition:'width .15s,min-width .15s',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'14px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:9,minWidth:200}}>
          <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#38bdf8,#0ea5e9)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="white" opacity=".9"/><rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity=".5"/><rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity=".5"/><rect x="13" y="13" width="8" height="8" rx="2" fill="white" opacity=".2"/></svg>
          </div>
          {!collapsed&&<div><div style={{fontSize:14,fontWeight:700,color:'#eceef2'}}>CleanSync</div><div style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontWeight:500,letterSpacing:1.5,textTransform:'uppercase' as const}}>Cleaner</div></div>}
        </div>
        <div style={{flex:1,padding:'8px 6px',display:'flex',flexDirection:'column',gap:1,overflowY:'auto'}}>
          {NAV.map(([id,icon,lbl,bdg])=>{const act=activeNav===id;return(
            <button key={id} onClick={()=>setPage(id)} style={{display:'flex',alignItems:'center',gap:9,padding:collapsed?'8px':'8px 10px',borderRadius:8,border:'none',cursor:'pointer',background:act?'rgba(56,189,248,0.1)':'transparent',color:act?'#38bdf8':'rgba(255,255,255,0.45)',fontFamily:'"Inter",sans-serif',fontSize:13,fontWeight:act?600:450,transition:'all .1s',textAlign:'left',width:'100%',justifyContent:collapsed?'center':'flex-start',position:'relative'}}>
              <span style={{fontSize:14,flexShrink:0,opacity:act?1:.65}}>{icon}</span>
              {!collapsed&&<span style={{flex:1,whiteSpace:'nowrap'}}>{lbl}</span>}
              {!collapsed&&bdg!=null&&bdg>0&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:5,background:'rgba(251,191,36,0.15)',color:'#fbbf24',fontWeight:700,minWidth:14,textAlign:'center'}}>{bdg}</span>}
              {act&&<div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:16,borderRadius:'0 2px 2px 0',background:'#38bdf8'}}/>}
            </button>
          )})}
        </div>
        <div style={{padding:'8px 6px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',gap:3}}>
          <button onClick={()=>setDark(d=>!d)} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)',background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.45)',fontSize:11,fontFamily:'"Inter",sans-serif',fontWeight:500,justifyContent:collapsed?'center':'flex-start'}}>
            <span style={{fontSize:12}}>{dark?'☀️':'🌙'}</span>{!collapsed&&<span>{dark?'Light':'Dark'}</span>}
          </button>
          {!collapsed&&<div style={{padding:'6px 10px',borderRadius:7,background:'rgba(255,255,255,0.04)'}}><div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user!.name}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user!.email}</div></div>}
          <button onClick={logout} style={{width:'100%',padding:'6px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)',background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:10,fontFamily:'"Inter",sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>{collapsed?'↩':'Sign out'}</button>
          <button onClick={()=>setCollapsed(p=>!p)} style={{width:'100%',padding:'6px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)',background:'transparent',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>{collapsed?'→':'←'}</button>
        </div>
      </nav>

      {/* Main */}
      <main style={{flex:1,overflowY:'auto',padding:'18px 24px'}}>
        {page==='dashboard'&&<DashboardPage/>}{page==='quotes'&&<QuotesPage/>}{page==='quote-detail'&&<QuoteDetailPage/>}{page==='create-quote'&&<CreateQuotePage/>}{page==='convert-to-job'&&<ConvertToJobPage/>}
        {page==='jobs'&&<JobsPage/>}{page==='create-job'&&<CreateJobPage/>}
        {page==='clients'&&<ClientsPage/>}{page==='create-client'&&<CreateClientPage/>}{page==='client-detail'&&<ClientDetailPage/>}
        {page==='invoices'&&<InvoicesPage/>}{page==='create-invoice'&&<CreateInvoicePage/>}{page==='invoice-detail'&&<InvoiceDetailPage/>}
        {page==='calendar'&&<CalendarPage/>}{page==='reports'&&<ReportsPage/>}{page==='activity'&&<ActivityPage/>}
        {page==='integrations'&&<IntegrationsPage/>}{page==='settings'&&<SettingsPage/>}
      </main>

      {selectedJob&&<JobModal/>}

      {toast&&<div style={{position:'fixed',bottom:24,right:24,padding:'10px 20px',borderRadius:10,background:toast.type==='ok'?'rgba(52,211,153,0.9)':'rgba(248,113,113,0.9)',color:'#fff',fontSize:13,fontWeight:600,boxShadow:T.shadowLg,zIndex:300,backdropFilter:'blur(8px)',animation:'slideUp .2s ease-out'}}>{toast.type==='ok'?'✓ ':'✗ '}{toast.msg}</div>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        input:focus,textarea:focus,select:focus{border-color:rgba(56,189,248,0.3)!important;outline:none}
        button:active{transform:scale(0.98)}
      `}</style>
    </div>
  )
}
