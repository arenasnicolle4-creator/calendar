'use client'
// app/dashboard/provider/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string; company?: string; serviceCategory?: string }
interface Connection { id: string; status: string; type: string; manager: { id: string; name: string; email: string; company?: string } }
interface Notification { id: string; title: string; body: string; readAt: string | null; createdAt: string }
interface MyBid { id: string; amount: number; notes?: string; estimatedDays?: number; status: string }
interface ServiceJob {
  id: string; title: string; description: string; category: string
  status: string; urgency: string; scheduledDate?: string; budget?: number; createdAt: string
  property: { id: string; name: string; address: string }
  postedBy?: { id: string; name: string; company?: string }
  bids: MyBid[]
}

type Page = 'overview' | 'marketplace' | 'schedule' | 'connections' | 'profile'

const CAT_LABELS: Record<string,string> = { plumbing:'Plumber',electrical:'Electrician',lawn:'Lawn Care',snow:'Snow Removal',handyman:'Handyman',pest:'Pest Control',hvac:'HVAC',painting:'Painting',roofing:'Roofing',cleaning:'Cleaning',other:'Other',cleaner:'Cleaner' }
const CAT_COLORS: Record<string,string> = { plumbing:'#2196f3',electrical:'#ffb86c',lawn:'#00e5a0',snow:'#a78bfa',handyman:'#ff8fa3',pest:'#ff5370',hvac:'#5bb8ff',painting:'#f9b3e8',roofing:'#ffb86c',cleaning:'#00e6d2',other:'#7fb3cc',cleaner:'#00e6d2' }
const STATUS_BADGE: Record<string,{bg:string;color:string;label:string}> = {
  open:        {bg:'rgba(0,230,210,0.1)',   color:'#00e6d2',label:'Open'},
  bidding:     {bg:'rgba(255,184,108,0.12)',color:'#ffb86c',label:'Bidding'},
  awarded:     {bg:'rgba(167,139,250,0.12)',color:'#a78bfa',label:'Awarded'},
  in_progress: {bg:'rgba(33,150,243,0.12)', color:'#5bb8ff',label:'In Progress'},
  completed:   {bg:'rgba(0,229,160,0.12)',  color:'#00e5a0',label:'Completed'},
}

const cc=(c:string)=>CAT_COLORS[c]||'#7fb3cc'
const cl=(c:string)=>CAT_LABELS[c]||c
function fmtDate(d:string){return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtRel(d:string){const m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return'Just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`}

const NAV_ITEMS: {id:Page;icon:string;label:string}[] = [
  {id:'overview',   icon:'◉', label:'Overview'},
  {id:'marketplace',icon:'◈', label:'Marketplace'},
  {id:'schedule',   icon:'▦', label:'My Schedule'},
  {id:'connections',icon:'◎', label:'Connections'},
  {id:'profile',    icon:'◐', label:'Profile'},
]

export default function ProviderDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User|null>(null)
  const [page, setPage] = useState<Page>('overview')
  const [connections, setConnections] = useState<Connection[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string|null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d => {
      if (!d.user || d.user.role !== 'provider') { router.push('/login'); return }
      setUser(d.user)
    })
  }, [router])

  const loadData = useCallback(async () => {
    const [connRes, notifRes, jobsRes] = await Promise.all([
      fetch('/api/connections'),
      fetch('/api/notifications'),
      fetch('/api/service-jobs'),
    ])
    const [conns, notifs, jobsData] = await Promise.all([connRes.json(), notifRes.json(), jobsRes.json()])
    setConnections(Array.isArray(conns) ? conns : [])
    setNotifications(Array.isArray(notifs) ? notifs : [])
    setJobs(Array.isArray(jobsData) ? jobsData : [])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  async function respond(id: string, status: 'active'|'declined') {
    setResponding(id)
    await fetch(`/api/connections/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    await loadData()
    setResponding(null)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method:'POST' })
    router.push('/login')
  }

  if (!user || loading) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:24,height:24,border:'2px solid rgba(0,230,210,0.2)',borderTopColor:'var(--cyan)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const pending = connections.filter(c => c.status==='pending' && c.manager)
  const active  = connections.filter(c => c.status==='active')
  const unread  = notifications.filter(n => !n.readAt).length
  const openJobs = jobs.filter(j => ['open','bidding'].includes(j.status))
  const awardedJobs = jobs.filter(j => ['awarded','in_progress'].includes(j.status) && j.bids.some(b=>b.status==='accepted'))
  const catLabel = user.serviceCategory ? (CAT_LABELS[user.serviceCategory]||user.serviceCategory) : 'Provider'

  const inp = {width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',color:'var(--text)',fontFamily:'DM Sans,sans-serif',fontSize:13,outline:'none'}

  function MiniStat({label,value,color='var(--text)'}:{label:string;value:string|number;color?:string}) {
    return(
      <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 12px',border:'1px solid var(--border)'}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color,lineHeight:1}}>{value}</div>
        <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'var(--text-dim)',marginTop:3}}>{label}</div>
      </div>
    )
  }

  // ── MARKETPLACE ──────────────────────────────────────────────────────────────
  function MarketplacePage() {
    const [bidJob, setBidJob] = useState<string|null>(null)
    const [bidForm, setBidForm] = useState({amount:'',notes:'',estimatedDays:''})
    const [submitting, setSubmitting] = useState(false)
    const [withdrawing, setWithdrawing] = useState<string|null>(null)
    const [err, setErr] = useState('')

    async function submitBid(jobId: string) {
      if (!bidForm.amount) { setErr('Enter a bid amount'); return }
      setSubmitting(true); setErr('')
      const res = await fetch(`/api/service-jobs/${jobId}/bids`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(bidForm)
      })
      if (res.ok) { setBidJob(null); setBidForm({amount:'',notes:'',estimatedDays:''}); loadData() }
      else { const d = await res.json(); setErr(d.error||'Failed') }
      setSubmitting(false)
    }

    async function withdrawBid(jobId: string, bidId: string) {
      if (!confirm('Withdraw your bid?')) return
      setWithdrawing(bidId)
      await fetch(`/api/service-jobs/${jobId}/bids/${bidId}`, {method:'DELETE'})
      loadData(); setWithdrawing(null)
    }

    if (active.length === 0) return (
      <div>
        <PageHeader title="Marketplace" subtitle="Jobs from your connected managers"/>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'48px 32px',textAlign:'center'}}>
          <div style={{fontSize:38,marginBottom:16}}>🔗</div>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>No active connections yet</div>
          <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Once a property manager connects with you and you accept, their open jobs will appear here.</div>
          <button onClick={()=>setPage('connections')} style={{padding:'10px 24px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            View Connections
          </button>
        </div>
      </div>
    )

    return (
      <div>
        <PageHeader title="Marketplace" subtitle={`${openJobs.length} open job${openJobs.length!==1?'s':''} from your managers`}/>
        {openJobs.length === 0 ? (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'40px',textAlign:'center'}}>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>No open jobs right now. Check back soon — you'll get notified when managers post new jobs.</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {openJobs.map(job => {
              const myBid = job.bids[0]
              const isBidding = bidJob === job.id
              const ss = STATUS_BADGE[job.status] || STATUS_BADGE.open
              return (
                <div key={job.id} style={{background:'var(--surface)',border:`1px solid ${isBidding?'rgba(0,212,170,0.35)':'var(--border)'}`,borderRadius:12,overflow:'hidden',transition:'border-color .2s',boxShadow:'var(--shadow-sm)'}}>
                  <div style={{padding:'18px 20px'}}>
                    {/* Job header */}
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:14,marginBottom:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                          <div style={{width:10,height:10,borderRadius:'50%',background:cc(job.category),boxShadow:`0 0 6px ${cc(job.category)}`,flexShrink:0}}/>
                          <span style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:'var(--text)'}}>{job.title}</span>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:ss.bg,color:ss.color}}>{ss.label}</span>
                          {job.urgency==='urgent'&&<span style={{fontSize:10,fontWeight:700,color:'#ff5370',background:'rgba(255,83,112,0.1)',padding:'2px 7px',borderRadius:10}}>⚡ Urgent</span>}
                        </div>
                        <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:8}}>
                          {job.property.name} · {job.property.address}
                          {job.postedBy&&<span style={{color:'var(--text-muted)'}}> · {job.postedBy.company||job.postedBy.name}</span>}
                        </div>
                        <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>{job.description}</div>
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        {job.budget&&(
                          <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--teal)'}}>
                            ${job.budget.toFixed(0)}
                            <div style={{fontSize:10,color:'var(--text-dim)',fontFamily:'DM Sans,sans-serif',fontWeight:400}}>budget</div>
                          </div>
                        )}
                        {job.scheduledDate&&<div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{fmtDate(job.scheduledDate)}</div>}
                        <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{cl(job.category)}</div>
                      </div>
                    </div>

                    {/* My existing bid */}
                    {myBid && (
                      <div style={{background:myBid.status==='accepted'?'rgba(0,212,170,0.08)':'rgba(0,0,0,0.12)',border:`1px solid ${myBid.status==='accepted'?'rgba(0,212,170,0.25)':myBid.status==='rejected'?'rgba(232,82,90,0.2)':'rgba(0,212,170,0.15)'}`,borderRadius:8,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                        <div>
                          <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:3}}>Your bid</div>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <span style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:myBid.status==='accepted'?'var(--green)':'var(--teal)'}}>${myBid.amount.toFixed(2)}</span>
                            {myBid.notes&&<span style={{fontSize:11,color:'var(--text-dim)',fontStyle:'italic'}}>"{myBid.notes}"</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                          {myBid.status==='accepted'&&<span style={{fontSize:12,fontWeight:700,color:'var(--green)',background:'var(--green-bg)',padding:'4px 12px',borderRadius:20,border:'1px solid rgba(16,185,129,0.25)'}}>✓ You got the job!</span>}
                          {myBid.status==='rejected'&&<span style={{fontSize:11,color:'var(--red)'}}>Not selected</span>}
                          {myBid.status==='pending'&&(
                            <>
                              <span style={{fontSize:11,color:'var(--amber)',background:'rgba(245,158,11,0.1)',padding:'3px 10px',borderRadius:10,border:'1px solid rgba(245,158,11,0.2)'}}>Pending review</span>
                              <button onClick={()=>withdrawBid(job.id,myBid.id)} disabled={withdrawing===myBid.id}
                                style={{fontSize:11,color:'var(--text-dim)',background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                                {withdrawing===myBid.id?'...':'Withdraw'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bid form or button */}
                    {!myBid && (
                      isBidding ? (
                        <div style={{background:'rgba(0,0,0,0.12)',borderRadius:10,padding:'16px',border:'1px solid var(--border)'}}>
                          {err&&<div style={{color:'var(--red)',fontSize:12,marginBottom:8}}>{err}</div>}
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                            <div>
                              <label style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,color:'var(--text-dim)',display:'block',marginBottom:4}}>Your Bid Amount *</label>
                              <input style={inp} type="number" placeholder="$0.00" value={bidForm.amount} onChange={e=>setBidForm(p=>({...p,amount:e.target.value}))}
                                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
                            </div>
                            <div>
                              <label style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,color:'var(--text-dim)',display:'block',marginBottom:4}}>Estimated Days</label>
                              <input style={inp} type="number" placeholder="e.g. 2" value={bidForm.estimatedDays} onChange={e=>setBidForm(p=>({...p,estimatedDays:e.target.value}))}
                                onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
                            </div>
                          </div>
                          <div style={{marginBottom:10}}>
                            <label style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,color:'var(--text-dim)',display:'block',marginBottom:4}}>Note to Manager (optional)</label>
                            <input style={inp} placeholder="Describe your approach, experience, availability..." value={bidForm.notes} onChange={e=>setBidForm(p=>({...p,notes:e.target.value}))}
                              onFocus={e=>(e.target.style.borderColor='var(--teal)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/>
                          </div>
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>{setBidJob(null);setErr('')}} style={{flex:1,padding:'9px',borderRadius:8,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)',fontFamily:'DM Sans,sans-serif',fontSize:12,cursor:'pointer'}}>Cancel</button>
                            <button onClick={()=>submitBid(job.id)} disabled={submitting} style={{flex:2,padding:'9px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',opacity:submitting?.6:1}}>
                              {submitting?'Submitting...':'Submit Bid'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>{setBidJob(job.id);setErr('')}} style={{padding:'10px 24px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 0 14px rgba(0,212,170,0.25)'}}>
                          Place Bid
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── SCHEDULE ─────────────────────────────────────────────────────────────────
  function SchedulePage() {
    const awarded = jobs.filter(j => ['awarded','in_progress'].includes(j.status) && j.bids.some(b=>b.status==='accepted'))
    const completed = jobs.filter(j => j.status==='completed' && j.bids.some(b=>b.status==='accepted'))

    return (
      <div>
        <PageHeader title="My Schedule" subtitle={`${awarded.length} active job${awarded.length!==1?'s':''}`}/>
        {awarded.length===0 && completed.length===0 ? (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'48px',textAlign:'center'}}>
            <div style={{fontSize:38,marginBottom:16}}>📋</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>No awarded jobs yet</div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Submit bids in the Marketplace. When a manager accepts your bid, the job appears here.</div>
            <button onClick={()=>setPage('marketplace')} style={{padding:'10px 24px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>Browse Jobs</button>
          </div>
        ) : (
          <div>
            {awarded.length > 0 && (
              <div style={{marginBottom:24}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--teal)',marginBottom:12}}>Active & Upcoming ({awarded.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {awarded.map(job => {
                    const myBid = job.bids.find(b=>b.status==='accepted')
                    const ss = STATUS_BADGE[job.status] || STATUS_BADGE.awarded
                    return (
                      <div key={job.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 20px',boxShadow:'var(--shadow-sm)'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:14}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <div style={{width:9,height:9,borderRadius:'50%',background:cc(job.category),boxShadow:`0 0 5px ${cc(job.category)}`}}/>
                              <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>{job.title}</span>
                              <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10,background:ss.bg,color:ss.color}}>{ss.label}</span>
                            </div>
                            <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:6}}>{job.property.name} · {job.property.address}</div>
                            {job.scheduledDate&&<div style={{fontSize:12,color:'var(--teal)',fontWeight:700,marginBottom:8}}>{fmtDate(job.scheduledDate)}</div>}
                            <div style={{fontSize:13,color:'var(--text-muted)'}}>{job.description}</div>
                          </div>
                          {myBid&&(
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--green)',textShadow:'0 0 10px rgba(0,229,160,0.3)'}}>${myBid.amount.toFixed(2)}</div>
                              <div style={{fontSize:10,color:'var(--text-dim)'}}>your bid</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:12}}>Completed ({completed.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:8,opacity:.65}}>
                  {completed.map(job => {
                    const myBid = job.bids.find(b=>b.status==='accepted')
                    return (
                      <div key={job.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div><div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{job.title}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{job.property.name}{job.scheduledDate&&` · ${fmtDate(job.scheduledDate)}`}</div></div>
                        {myBid&&<span style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-muted)'}}>${myBid.amount.toFixed(2)}</span>}
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
  }

  // ── CONNECTIONS ───────────────────────────────────────────────────────────────
  function ConnectionsPage() {
    return (
      <div>
        <PageHeader title="Connections" subtitle={`${active.length} active · ${pending.length} pending`}/>
        {pending.length > 0 && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--amber)',marginBottom:12}}>Pending Invites ({pending.length})</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {pending.map(c => (
                <div key={c.id} style={{background:'rgba(0,212,170,0.06)',border:'1px solid rgba(0,212,170,0.2)',borderRadius:12,padding:'18px 20px',display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:46,height:46,borderRadius:'50%',background:'rgba(0,212,170,0.12)',border:'2px solid rgba(0,212,170,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700,color:'var(--teal)',flexShrink:0}}>
                    {c.manager.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--text)'}}>{c.manager.name}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{c.manager.company||c.manager.email} wants to connect with you</div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    <button onClick={()=>respond(c.id,'declined')} disabled={responding===c.id}
                      style={{padding:'8px 18px',borderRadius:8,background:'var(--red-bg)',border:'1px solid rgba(232,82,90,0.25)',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Decline</button>
                    <button onClick={()=>respond(c.id,'active')} disabled={responding===c.id}
                      style={{padding:'8px 18px',borderRadius:8,background:'var(--teal)',color:'#000',border:'none',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Syne,sans-serif',boxShadow:'0 0 12px rgba(0,212,170,0.25)'}}>
                      {responding===c.id?'...':'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {active.length > 0 && (
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--green)',marginBottom:12}}>Active ({active.length})</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {active.map(c => (
                <div key={c.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'15px 18px',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:'rgba(16,185,129,0.12)',border:'2px solid rgba(16,185,129,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--green)',flexShrink:0}}>
                    {c.manager.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:700,color:'var(--text)'}}>{c.manager.name}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>{c.manager.company||c.manager.email}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,color:'var(--green)',background:'var(--green-bg)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(16,185,129,0.25)'}}>✓ Connected</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {active.length===0 && pending.length===0 && (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'48px',textAlign:'center'}}>
            <div style={{fontSize:38,marginBottom:16}}>🤝</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>No connections yet</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>Property managers will find you by searching for your trade and send you an invite. Make sure your profile is complete.</div>
          </div>
        )}
      </div>
    )
  }

  // ── PROFILE ───────────────────────────────────────────────────────────────────
  function ProfilePage() {
    if (!user) return null
    return (
      <div>
        <PageHeader title="My Profile"/>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'28px',maxWidth:600}}>
          {/* Avatar */}
          <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:28,paddingBottom:24,borderBottom:'1px solid var(--border)'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:`${cc(user.serviceCategory||'other')}22`,border:`2px solid ${cc(user.serviceCategory||'other')}55`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:700,color:cc(user.serviceCategory||'other'),flexShrink:0}}>
              {user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)'}}>{user.name}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{catLabel}</div>
              {user.company&&<div style={{fontSize:12,color:'var(--text-dim)',marginTop:1}}>{user.company}</div>}
            </div>
          </div>
          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
            <MiniStat label="Connections" value={active.length} color="var(--teal)"/>
            <MiniStat label="Jobs Won" value={awardedJobs.length} color="var(--green)"/>
            <MiniStat label="Pending Bids" value={jobs.filter(j=>j.bids.some(b=>b.status==='pending')).length} color="var(--amber)"/>
          </div>
          {/* Fields */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[
              {label:'Full Name',value:user.name},
              {label:'Email',value:user.email},
              {label:'Company',value:user.company||'—'},
              {label:'Trade',value:user.serviceCategory?(CAT_LABELS[user.serviceCategory]||user.serviceCategory):'—'},
            ].map(f=>(
              <div key={f.label}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:5}}>{f.label}</div>
                <div style={{fontSize:14,color:'var(--text)',fontWeight:500,padding:'9px 13px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:18,padding:'12px 14px',background:'var(--teal-bg)',borderRadius:8,border:'1px solid var(--teal-border)',fontSize:12,color:'var(--teal)'}}>
            Profile editing, bio, certifications, and ratings coming in Phase 4.
          </div>
        </div>
      </div>
    )
  }

  // ── OVERVIEW ─────────────────────────────────────────────────────────────────
  function OverviewPage() {
    return (
      <div>
        {/* Welcome banner */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px',marginBottom:24,position:'relative',overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,var(--teal),${cc(user.serviceCategory||'other')})`}}/>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:6}}>
            Welcome back, {user.name.split(' ')[0]} 👋
          </div>
          <div style={{fontSize:13,color:'var(--text-muted)'}}>
            {catLabel}
            {user.company&&` · ${user.company}`}
            {active.length>0&&<span style={{marginLeft:10,color:'var(--teal)'}}>· {active.length} active connection{active.length!==1?'s':''}</span>}
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          <div onClick={()=>setPage('marketplace')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--teal)',textShadow:'0 0 12px rgba(0,212,170,0.4)',lineHeight:1}}>{openJobs.length}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>Open Jobs</div>
          </div>
          <div onClick={()=>setPage('schedule')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--green)',textShadow:'0 0 12px rgba(16,185,129,0.4)',lineHeight:1}}>{awardedJobs.length}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>Awarded Jobs</div>
          </div>
          <div onClick={()=>setPage('connections')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'#a78bfa',textShadow:'0 0 12px rgba(167,139,250,0.4)',lineHeight:1}}>{active.length}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>Connections</div>
          </div>
          <div onClick={()=>setPage('connections')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--amber)',textShadow:'0 0 12px rgba(245,158,11,0.4)',lineHeight:1}}>{pending.length}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>Pending Invites</div>
          </div>
        </div>

        {/* Callouts */}
        {pending.length > 0 && (
          <div onClick={()=>setPage('connections')} style={{background:'rgba(0,212,170,0.07)',border:'1px solid rgba(0,212,170,0.2)',borderRadius:12,padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--teal)'}}>{pending.length} connection invite{pending.length>1?'s':''} waiting</div>
              <div style={{fontSize:12,color:'var(--text-dim)',marginTop:2}}>Property managers want to work with you — review and accept</div>
            </div>
            <span style={{color:'var(--teal)',fontSize:20}}>→</span>
          </div>
        )}
        {openJobs.length > 0 && (
          <div onClick={()=>setPage('marketplace')} style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--amber)'}}>{openJobs.length} open job{openJobs.length>1?'s':''} available</div>
              <div style={{fontSize:12,color:'var(--text-dim)',marginTop:2}}>Submit bids on jobs from your connected property managers</div>
            </div>
            <span style={{color:'var(--amber)',fontSize:20}}>→</span>
          </div>
        )}

        {/* Recent notifications */}
        {notifications.length > 0 && (
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:12}}>Recent Activity</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {notifications.slice(0,5).map(n=>(
                <div key={n.id} style={{background:n.readAt?'var(--surface)':'rgba(0,212,170,0.05)',border:`1px solid ${n.readAt?'var(--border)':'rgba(0,212,170,0.18)'}`,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'flex-start',gap:10}}>
                  {!n.readAt&&<div style={{width:6,height:6,borderRadius:'50%',background:'var(--teal)',flexShrink:0,marginTop:3}}/>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{n.title}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)'}}>{n.body}</div>
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{fmtRel(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active.length===0 && pending.length===0 && (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'40px',textAlign:'center',marginTop:8}}>
            <div style={{fontSize:38,marginBottom:14}}>🚀</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>You're all set up!</div>
            <div style={{fontSize:13,color:'var(--text-muted)',maxWidth:400,margin:'0 auto'}}>
              Property managers will find and invite you when they need a {catLabel.toLowerCase()}. Make sure your profile info is complete so they can find you.
            </div>
          </div>
        )}
      </div>
    )
  }

  function PageHeader({title,subtitle}:{title:string;subtitle?:string}) {
    return (
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:700,color:'var(--text)'}}>{title}</h1>
        {subtitle&&<p style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{subtitle}</p>}
      </div>
    )
  }

  const pageBadges: Partial<Record<Page,number>> = {
    marketplace: openJobs.length||0,
    connections: pending.length||0,
    schedule: awardedJobs.length||0,
  }

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg)',fontFamily:'DM Sans,sans-serif'}}>

      {/* LEFT SIDEBAR */}
      <nav style={{width:sidebarCollapsed?64:220,minWidth:sidebarCollapsed?64:220,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',transition:'width .2s,min-width .2s',overflow:'hidden',flexShrink:0}}>
        {/* Logo */}
        <div style={{padding:'20px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,minWidth:220}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,var(--teal),${cc(user.serviceCategory||'other')})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 0 12px rgba(0,212,170,0.3)'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="white" opacity=".9"/><rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity=".6"/><rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity=".6"/><rect x="13" y="13" width="8" height="8" rx="2" fill="white" opacity=".3"/></svg>
          </div>
          {!sidebarCollapsed&&(
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)'}}>CleanSync</div>
              <div style={{fontSize:10,color:'var(--teal)',fontWeight:600,letterSpacing:1}}>{catLabel.toUpperCase()}</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{flex:1,padding:'12px 8px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
          {NAV_ITEMS.map(item => {
            const isActive = page===item.id
            const badge = pageBadges[item.id]
            return (
              <button key={item.id} onClick={()=>setPage(item.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:sidebarCollapsed?'10px':'10px 12px',borderRadius:10,border:'none',cursor:'pointer',background:isActive?'var(--teal-bg)':'transparent',color:isActive?'var(--teal)':'var(--text-muted)',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:isActive?700:500,transition:'all .15s',textAlign:'left',width:'100%',justifyContent:sidebarCollapsed?'center':'flex-start',position:'relative'}}>
                <span style={{fontSize:15,flexShrink:0}}>{item.icon}</span>
                {!sidebarCollapsed&&<span style={{flex:1,whiteSpace:'nowrap'}}>{item.label}</span>}
                {!sidebarCollapsed&&badge!=null&&badge>0&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:'var(--amber)',color:'#000',fontWeight:800}}>{badge}</span>}
                {isActive&&<div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:20,borderRadius:'0 2px 2px 0',background:'var(--teal)'}}/>}
              </button>
            )
          })}
        </div>

        {/* User + collapse */}
        <div style={{padding:'12px 8px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:6}}>
          {!sidebarCollapsed&&(
            <div style={{padding:'8px 10px',borderRadius:8,background:'var(--surface2)',border:'1px solid var(--border)'}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
              <div style={{fontSize:10,color:'var(--text-dim)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
            </div>
          )}
          <button onClick={logout} style={{width:'100%',padding:'7px',borderRadius:7,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',color:'var(--text-muted)',fontSize:11,fontFamily:'DM Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {sidebarCollapsed?'↩':'Sign out'}
          </button>
          <button onClick={()=>setSidebarCollapsed(p=>!p)} style={{width:'100%',padding:'7px',borderRadius:7,border:'1px solid var(--border)',background:'var(--surface2)',cursor:'pointer',color:'var(--text-muted)',fontSize:11,fontFamily:'DM Sans,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {sidebarCollapsed?'→':'← Collapse'}
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main style={{flex:1,overflowY:'auto',padding:24}}>
        {unread>0&&(
          <div style={{marginBottom:16,padding:'10px 16px',borderRadius:8,background:'rgba(0,212,170,0.08)',border:'1px solid rgba(0,212,170,0.2)',fontSize:12,color:'var(--teal)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>{unread} unread notification{unread>1?'s':''}</span>
            <button onClick={async()=>{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:'all'})});loadData()}} style={{background:'none',border:'none',color:'var(--teal)',fontSize:11,cursor:'pointer',fontFamily:'DM Sans,sans-serif',textDecoration:'underline'}}>Mark all read</button>
          </div>
        )}
        {page==='overview'    && <OverviewPage/>}
        {page==='marketplace' && <MarketplacePage/>}
        {page==='schedule'    && <SchedulePage/>}
        {page==='connections' && <ConnectionsPage/>}
        {page==='profile'     && <ProfilePage/>}
      </main>
    </div>
  )
}
