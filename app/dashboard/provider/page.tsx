'use client'
// app/dashboard/provider/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string; company?: string; serviceCategory?: string }
interface Connection { id: string; status: string; type: string; manager: { id: string; name: string; email: string; company?: string } }
interface Notification { id: string; title: string; body: string; readAt: string | null; createdAt: string }
interface MyBid { id: string; amount: number; notes?: string; status: string }
interface ServiceJob {
  id: string; title: string; description: string; category: string; status: string; urgency: string
  scheduledDate?: string; budget?: number; createdAt: string
  property: { id: string; name: string; address: string }
  postedBy?: { id: string; name: string; company?: string }
  assignedTo?: { id: string; name: string }
  bids: MyBid[] // only current provider's own bid
}

type Tab = 'overview' | 'marketplace' | 'schedule' | 'connections' | 'profile'

const CAT_LABELS: Record<string,string> = { plumbing:'Plumber',electrical:'Electrician',lawn:'Lawn Care',snow:'Snow Removal',handyman:'Handyman',pest:'Pest Control',hvac:'HVAC',painting:'Painting',roofing:'Roofing',cleaning:'Cleaning',other:'Other' }
const CAT_COLORS: Record<string,string> = { plumbing:'#2196f3',electrical:'#ffb86c',lawn:'#00e5a0',snow:'#a78bfa',handyman:'#ff8fa3',pest:'#ff5370',hvac:'#5bb8ff',painting:'#f9b3e8',roofing:'#ffb86c',cleaning:'#00e6d2',other:'#7fb3cc' }
const STATUS_STYLES: Record<string,{bg:string;color:string;label:string}> = {
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

// ── MARKETPLACE TAB ────────────────────────────────────────────────────────
function MarketplaceTab({jobs,connections,onRefresh}:{jobs:ServiceJob[];connections:Connection[];onRefresh:()=>void}){
  const [bidJob,setBidJob]=useState<string|null>(null)
  const [bidForm,setBidForm]=useState({amount:'',notes:'',estimatedDays:''})
  const [submitting,setSubmitting]=useState(false)
  const [withdrawing,setWithdrawing]=useState<string|null>(null)
  const [err,setErr]=useState('')

  const openJobs=jobs.filter(j=>['open','bidding'].includes(j.status))
  const hasConnections=connections.some(c=>c.status==='active')

  async function submitBid(jobId:string){
    if(!bidForm.amount){setErr('Enter a bid amount');return}
    setSubmitting(true);setErr('')
    const res=await fetch(`/api/service-jobs/${jobId}/bids`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bidForm)})
    if(res.ok){setBidJob(null);setBidForm({amount:'',notes:'',estimatedDays:''});onRefresh()}
    else{const d=await res.json();setErr(d.error||'Failed to submit bid')}
    setSubmitting(false)
  }

  async function withdrawBid(jobId:string,bidId:string){
    if(!confirm('Withdraw your bid?'))return
    setWithdrawing(bidId)
    await fetch(`/api/service-jobs/${jobId}/bids/${bidId}`,{method:'DELETE'})
    onRefresh();setWithdrawing(null)
  }

  const inp={width:'100%',background:'rgba(0,0,0,0.2)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 11px',color:'var(--text)',fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:'none',marginBottom:8}

  if(!hasConnections)return(
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:14,color:'var(--text-muted)',marginBottom:8}}>No active connections yet</div>
      <div style={{fontSize:12,color:'var(--text-dim)'}}>Once a property manager connects with you and you accept, their open jobs will appear here.</div>
    </div>
  )

  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>
        Marketplace <span style={{fontSize:13,fontWeight:400,color:'var(--text-dim)',marginLeft:8}}>{openJobs.length} open job{openJobs.length!==1?'s':''}</span>
      </div>

      {openJobs.length===0?(
        <div style={{color:'var(--text-dim)',fontSize:14,textAlign:'center',padding:'60px 0'}}>No open jobs from your connected managers right now.</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {openJobs.map(job=>{
            const myBid=job.bids[0]
            const isBidding=bidJob===job.id
            const ss=STATUS_STYLES[job.status]||STATUS_STYLES.open
            return(
              <div key={job.id} style={{background:'var(--surface)',border:`1px solid ${isBidding?'rgba(0,230,210,0.3)':'var(--border)'}`,borderRadius:12,overflow:'hidden',transition:'border-color .2s'}}>
                <div style={{padding:'16px 18px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                        <div style={{width:9,height:9,borderRadius:'50%',background:cc(job.category),boxShadow:`0 0 5px ${cc(job.category)}`,flexShrink:0}}/>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:'var(--text)'}}>{job.title}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10,background:ss.bg,color:ss.color}}>{ss.label}</span>
                        {job.urgency==='urgent'&&<span style={{fontSize:10,fontWeight:700,color:'#ff5370'}}>⚡ Urgent</span>}
                      </div>
                      <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:6}}>
                        {job.property.name} · {cl(job.category)}
                        {job.postedBy&&` · Posted by ${job.postedBy.company||job.postedBy.name}`}
                      </div>
                      <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.5}}>{job.description}</div>
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      {job.budget&&<div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:'var(--cyan-b)'}}>${job.budget.toFixed(0)}<span style={{fontSize:10,color:'var(--text-dim)',fontFamily:"'DM Sans',sans-serif",fontWeight:400}}> budget</span></div>}
                      {job.scheduledDate&&<div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{fmtDate(job.scheduledDate)}</div>}
                    </div>
                  </div>

                  {/* My bid status */}
                  {myBid&&(
                    <div style={{background:myBid.status==='accepted'?'rgba(0,229,160,0.08)':'rgba(0,0,0,0.15)',border:`1px solid ${myBid.status==='accepted'?'rgba(0,229,160,0.25)':myBid.status==='rejected'?'rgba(255,83,112,0.2)':'rgba(0,230,210,0.15)'}`,borderRadius:8,padding:'10px 12px',marginTop:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Your bid: </span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:myBid.status==='accepted'?'var(--green)':'var(--cyan-b)'}}>${myBid.amount.toFixed(2)}</span>
                        {myBid.notes&&<span style={{fontSize:11,color:'var(--text-dim)',marginLeft:8,fontStyle:'italic'}}>"{myBid.notes}"</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        {myBid.status==='accepted'&&<span style={{fontSize:11,fontWeight:700,color:'var(--green)',background:'var(--green-bg)',padding:'2px 8px',borderRadius:10}}>✓ Accepted!</span>}
                        {myBid.status==='rejected'&&<span style={{fontSize:11,color:'var(--red)'}}>Not selected</span>}
                        {myBid.status==='pending'&&<><span style={{fontSize:11,color:'var(--amber)'}}>Pending review</span><button onClick={()=>withdrawBid(job.id,myBid.id)} disabled={withdrawing===myBid.id} style={{fontSize:11,color:'var(--text-dim)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',fontFamily:"'DM Sans',sans-serif"}}>{withdrawing===myBid.id?'...':'Withdraw'}</button></>}
                      </div>
                    </div>
                  )}

                  {/* Bid button — only if no existing bid */}
                  {!myBid&&(
                    <div style={{marginTop:12}}>
                      {isBidding?(
                        <div style={{background:'rgba(0,0,0,0.15)',borderRadius:9,padding:'14px 14px 10px'}}>
                          {err&&<div style={{color:'var(--red)',fontSize:12,marginBottom:8}}>{err}</div>}
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                            <input style={inp} type="number" placeholder="Your bid amount ($) *" value={bidForm.amount} onChange={e=>setBidForm(p=>({...p,amount:e.target.value}))}/>
                            <input style={inp} type="number" placeholder="Estimated days" value={bidForm.estimatedDays} onChange={e=>setBidForm(p=>({...p,estimatedDays:e.target.value}))}/>
                          </div>
                          <input style={inp} placeholder="Notes to manager (optional)" value={bidForm.notes} onChange={e=>setBidForm(p=>({...p,notes:e.target.value}))}/>
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>{setBidJob(null);setErr('')}} style={{flex:1,padding:'7px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:12}}>Cancel</button>
                            <button onClick={()=>submitBid(job.id)} disabled={submitting} style={{flex:2,padding:'7px',borderRadius:6,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{submitting?'Submitting...':'Submit Bid'}</button>
                          </div>
                        </div>
                      ):(
                        <button onClick={()=>{setBidJob(job.id);setErr('')}} style={{padding:'8px 20px',borderRadius:8,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:'0 0 12px rgba(0,230,210,0.25)'}}>Place Bid</button>
                      )}
                    </div>
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

// ── SCHEDULE TAB ───────────────────────────────────────────────────────────
function ScheduleTab({jobs}:{jobs:ServiceJob[]}){
  const awarded=jobs.filter(j=>['awarded','in_progress'].includes(j.status)&&j.bids.some(b=>b.status==='accepted'))
  const completed=jobs.filter(j=>j.status==='completed'&&j.bids.some(b=>b.status==='accepted'))

  function JobCard({job}:{job:ServiceJob}){
    const myBid=job.bids.find(b=>b.status==='accepted')
    const ss=STATUS_STYLES[job.status]||STATUS_STYLES.awarded
    return(
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:cc(job.category),boxShadow:`0 0 5px ${cc(job.category)}`}}/>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:'var(--text)'}}>{job.title}</span>
              <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10,background:ss.bg,color:ss.color}}>{ss.label}</span>
            </div>
            <div style={{fontSize:11,color:'var(--text-dim)'}}>{job.property.name} · {job.property.address}</div>
            {job.scheduledDate&&<div style={{fontSize:11,color:'var(--cyan)',marginTop:2,fontWeight:600}}>{fmtDate(job.scheduledDate)}</div>}
          </div>
          {myBid&&<div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:'var(--green)',textShadow:'0 0 10px rgba(0,229,160,0.3)',flexShrink:0}}>${myBid.amount.toFixed(2)}</div>}
        </div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>{job.description}</div>
      </div>
    )
  }

  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>My Schedule</div>
      {awarded.length===0&&completed.length===0?(
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'48px 32px',textAlign:'center'}}>
          <div style={{fontSize:14,color:'var(--text-muted)',marginBottom:8}}>No awarded jobs yet</div>
          <div style={{fontSize:12,color:'var(--text-dim)'}}>Submit bids in the Marketplace tab. Once a manager accepts your bid, the job will appear here.</div>
        </div>
      ):(
        <div>
          {awarded.length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--cyan)',marginBottom:12}}>Upcoming ({awarded.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>{awarded.map(j=><JobCard key={j.id} job={j}/>)}</div>
            </div>
          )}
          {completed.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:12}}>Completed ({completed.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:10,opacity:.7}}>{completed.map(j=><JobCard key={j.id} job={j}/>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function ProviderDashboard(){
  const router=useRouter()
  const [user,setUser]=useState<User|null>(null)
  const [tab,setTab]=useState<Tab>('overview')
  const [connections,setConnections]=useState<Connection[]>([])
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [jobs,setJobs]=useState<ServiceJob[]>([])
  const [loading,setLoading]=useState(true)
  const [responding,setResponding]=useState<string|null>(null)

  useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(!d.user||d.user.role!=='provider'){router.push('/login');return}setUser(d.user)})},[router])

  const loadData=useCallback(async()=>{
    const [connRes,notifRes,jobsRes]=await Promise.all([fetch('/api/connections'),fetch('/api/notifications'),fetch('/api/service-jobs')])
    const [conns,notifs,jobsData]=await Promise.all([connRes.json(),notifRes.json(),jobsRes.json()])
    setConnections(Array.isArray(conns)?conns:[])
    setNotifications(Array.isArray(notifs)?notifs:[])
    setJobs(Array.isArray(jobsData)?jobsData:[])
    setLoading(false)
  },[])

  useEffect(()=>{if(user)loadData()},[user,loadData])

  async function respond(id:string,status:'active'|'declined'){setResponding(id);await fetch(`/api/connections/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});await loadData();setResponding(null)}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}

  if(!user||loading)return(<div style={{minHeight:'100vh',background:'#0d1f2d',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:24,height:24,border:'2px solid rgba(0,230,210,0.2)',borderTopColor:'#00e6d2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>)

  const pending=connections.filter(c=>c.status==='pending'&&c.manager)
  const active=connections.filter(c=>c.status==='active')
  const unread=notifications.filter(n=>!n.readAt).length
  const openJobs=jobs.filter(j=>['open','bidding'].includes(j.status))
  const awardedJobs=jobs.filter(j=>['awarded','in_progress'].includes(j.status)&&j.bids.some(b=>b.status==='accepted'))
  const catLabel=user.serviceCategory?(CAT_LABELS[user.serviceCategory]||user.serviceCategory):'Provider'

  const tabs:{id:Tab;label:string;badge?:number}[]=[
    {id:'overview',label:'Overview'},
    {id:'marketplace',label:'Marketplace',badge:openJobs.length||undefined},
    {id:'schedule',label:'My Schedule',badge:awardedJobs.length||undefined},
    {id:'connections',label:'Connections',badge:pending.length||undefined},
    {id:'profile',label:'Profile'},
  ]

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)',color:'var(--text)',fontFamily:"'DM Sans',sans-serif"}}>
      <nav style={{background:'rgba(9,20,32,0.97)',borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',alignItems:'center',height:56,position:'sticky',top:0,zIndex:50}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'var(--cyan-b)',textShadow:'0 0 16px rgba(0,230,210,0.6)',marginRight:32}}>CleanSync</div>
        <div style={{display:'flex',gap:2,flex:1}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'6px 16px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:tab===t.id?'rgba(0,230,210,0.12)':'transparent',color:tab===t.id?'var(--cyan-b)':'var(--text-muted)',fontFamily:"'DM Sans',sans-serif",transition:'all .14s'}}>
              {t.label}{t.badge?<span style={{marginLeft:6,background:'var(--amber)',color:'#071a24',borderRadius:10,fontSize:9,fontWeight:800,padding:'1px 5px'}}>{t.badge}</span>:null}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {unread>0&&<div style={{background:'var(--red)',color:'#fff',borderRadius:20,fontSize:10,fontWeight:700,padding:'2px 7px'}}>{unread}</div>}
          <div style={{fontSize:12,color:'var(--text-muted)'}}>{user.name} <span style={{color:'var(--dim)',fontSize:10}}>· {catLabel}</span></div>
          <button onClick={logout} style={{padding:'5px 12px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Sign out</button>
        </div>
      </nav>

      <main style={{padding:'28px 24px',maxWidth:960,margin:'0 auto'}}>

        {/* OVERVIEW */}
        {tab==='overview'&&(
          <div>
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px',marginBottom:24,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(0,230,210,0.04) 0%,transparent 60%)',pointerEvents:'none'}}/>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:700,color:'var(--cyan-b)',marginBottom:6}}>Welcome back, {user.name.split(' ')[0]}</div>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>{catLabel} · {active.length} active connection{active.length!==1?'s':''}{pending.length>0&&<span style={{marginLeft:10,color:'var(--amber)',fontWeight:600}}>· {pending.length} pending invite{pending.length>1?'s':''}</span>}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
              {[{label:'Open Jobs',value:openJobs.length,color:'var(--cyan-b)',t:'marketplace'},{label:'Awarded Jobs',value:awardedJobs.length,color:'var(--green)',t:'schedule'},{label:'Connections',value:active.length,color:'var(--violet)',t:'connections'}].map(s=>(
                <div key={s.label} onClick={()=>setTab(s.t as Tab)} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:'pointer',transition:'all .2s'}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,color:s.color,textShadow:`0 0 12px ${s.color}50`}}>{s.value}</div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
            {pending.length>0&&(
              <div onClick={()=>setTab('connections')} style={{background:'rgba(0,230,210,0.06)',border:'1px solid rgba(0,230,210,0.2)',borderRadius:12,padding:'14px 18px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
                <div><div style={{fontSize:13,fontWeight:600,color:'var(--cyan-b)'}}>{pending.length} connection invite{pending.length>1?'s':''} waiting</div><div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>Property managers want to work with you</div></div>
                <span style={{color:'var(--cyan)',fontSize:16}}>→</span>
              </div>
            )}
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--cyan)',marginBottom:12}}>Recent Activity</div>
            {notifications.length===0?<div style={{color:'var(--text-dim)',fontSize:13}}>No activity yet.</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {notifications.slice(0,6).map(n=>(
                  <div key={n.id} style={{background:n.readAt?'var(--surface)':'rgba(0,230,210,0.05)',border:`1px solid ${n.readAt?'var(--border)':'rgba(0,230,210,0.2)'}`,borderRadius:10,padding:'11px 14px'}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{n.title}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)'}}>{n.body}</div>
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{fmtRel(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==='marketplace'&&<MarketplaceTab jobs={jobs} connections={connections} onRefresh={loadData}/>}
        {tab==='schedule'&&<ScheduleTab jobs={jobs}/>}

        {/* CONNECTIONS */}
        {tab==='connections'&&(
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>Connections</div>
            {pending.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--amber)',marginBottom:12}}>Pending Invites ({pending.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {pending.map(c=>(
                    <div key={c.id} style={{background:'rgba(0,230,210,0.06)',border:'1px solid rgba(0,230,210,0.2)',borderRadius:12,padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}>
                      <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(0,230,210,0.12)',border:'2px solid rgba(0,230,210,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:'var(--cyan-b)',flexShrink:0}}>{c.manager.name.charAt(0).toUpperCase()}</div>
                      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{c.manager.name}</div><div style={{fontSize:12,color:'var(--text-dim)'}}>{c.manager.company||c.manager.email} wants to connect with you</div></div>
                      <div style={{display:'flex',gap:8,flexShrink:0}}>
                        <button onClick={()=>respond(c.id,'declined')} disabled={responding===c.id} style={{padding:'7px 16px',borderRadius:7,background:'var(--red-bg)',border:'1px solid rgba(255,83,112,0.25)',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Decline</button>
                        <button onClick={()=>respond(c.id,'active')} disabled={responding===c.id} style={{padding:'7px 16px',borderRadius:7,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{responding===c.id?'...':'Accept'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {active.length>0&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--green)',marginBottom:12}}>Active ({active.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {active.map(c=>(
                    <div key={c.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(0,229,160,0.12)',border:'2px solid rgba(0,229,160,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:'var(--green)',flexShrink:0}}>{c.manager.name.charAt(0).toUpperCase()}</div>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{c.manager.name}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{c.manager.company||c.manager.email}</div></div>
                      <span style={{fontSize:10,fontWeight:700,color:'var(--green)',background:'var(--green-bg)',padding:'2px 8px',borderRadius:10,border:'1px solid rgba(0,229,160,0.2)'}}>Connected</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {active.length===0&&pending.length===0&&<div style={{color:'var(--text-dim)',fontSize:14,textAlign:'center',padding:'60px 0'}}>No connections yet. Property managers will find you and send invites.</div>}
          </div>
        )}

        {/* PROFILE */}
        {tab==='profile'&&(
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>My Profile</div>
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'24px 28px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {[{label:'Full Name',value:user.name},{label:'Email',value:user.email},{label:'Company',value:user.company||'—'},{label:'Trade',value:user.serviceCategory?(CAT_LABELS[user.serviceCategory]||user.serviceCategory):'—'}].map(f=>(
                  <div key={f.label}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:4}}>{f.label}</div>
                    <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:20,padding:'12px 14px',background:'rgba(0,230,210,0.05)',borderRadius:8,border:'1px solid rgba(0,230,210,0.12)',fontSize:12,color:'var(--text-dim)'}}>Profile editing, bio, photo, and ratings coming in Phase 4.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
