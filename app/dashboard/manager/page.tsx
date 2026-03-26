'use client'
// app/dashboard/manager/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; email: string; role: string; company?: string; avatarUrl?: string; connectionStatus?: string; serviceCategory?: string }
interface Property { id: string; name: string; address: string; platform?: string; beds?: number; baths?: number }
interface Connection { id: string; status: string; type: string; manager: User; provider: User }
interface Notification { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string }
interface Job { id: string; displayName: string; propertyLabel: string; checkoutTime: string; platform: string }
interface Bid { id: string; amount: number; notes?: string; estimatedDays?: number; status: string; createdAt: string; provider: User }
interface ServiceJob {
  id: string; title: string; description: string; category: string; status: string; urgency: string
  scheduledDate?: string; budget?: number; createdAt: string
  property: { id: string; name: string; address: string }
  bids: Bid[]
  assignedTo?: User
}

type Tab = 'overview' | 'properties' | 'team' | 'jobs' | 'find'

const CAT_LABELS: Record<string, string> = { plumbing:'Plumber',electrical:'Electrician',lawn:'Lawn Care',snow:'Snow Removal',handyman:'Handyman',pest:'Pest Control',hvac:'HVAC',painting:'Painting',roofing:'Roofing',cleaning:'Cleaning',other:'Other' }
const CAT_COLORS: Record<string, string> = { plumbing:'#2196f3',electrical:'#ffb86c',lawn:'#00e5a0',snow:'#a78bfa',handyman:'#ff8fa3',pest:'#ff5370',hvac:'#5bb8ff',painting:'#f9b3e8',roofing:'#ffb86c',cleaning:'#00e6d2',other:'#7fb3cc' }
const STATUS_STYLES: Record<string, {bg:string;color:string;label:string}> = {
  open:        {bg:'rgba(0,230,210,0.1)',   color:'#00e6d2',label:'Open'},
  bidding:     {bg:'rgba(255,184,108,0.12)',color:'#ffb86c',label:'Bidding'},
  awarded:     {bg:'rgba(167,139,250,0.12)',color:'#a78bfa',label:'Awarded'},
  in_progress: {bg:'rgba(33,150,243,0.12)', color:'#5bb8ff',label:'In Progress'},
  completed:   {bg:'rgba(0,229,160,0.12)',  color:'#00e5a0',label:'Completed'},
  cancelled:   {bg:'rgba(255,83,112,0.1)',  color:'#ff5370',label:'Cancelled'},
}

const cc = (c:string) => CAT_COLORS[c]||'#7fb3cc'
const cl = (c:string) => CAT_LABELS[c]||c
function fmtDate(d:string){return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtRel(d:string){const m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return'Just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`}

function Nav({user,tab,setTab,notifCount,logout}:{user:User;tab:Tab;setTab:(t:Tab)=>void;notifCount:number;logout:()=>void}){
  const tabs:{id:Tab;label:string}[]=[{id:'overview',label:'Overview'},{id:'properties',label:'Properties'},{id:'jobs',label:'Jobs'},{id:'team',label:'My Team'},{id:'find',label:'Find Providers'}]
  return(
    <nav style={{background:'rgba(9,20,32,0.97)',borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',alignItems:'center',height:56,position:'sticky',top:0,zIndex:50}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'var(--cyan-b)',textShadow:'0 0 16px rgba(0,230,210,0.6)',marginRight:32}}>CleanSync</div>
      <div style={{display:'flex',gap:2,flex:1}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'6px 16px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:tab===t.id?'rgba(0,230,210,0.12)':'transparent',color:tab===t.id?'var(--cyan-b)':'var(--text-muted)',fontFamily:"'DM Sans',sans-serif",transition:'all .14s'}}>{t.label}</button>)}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {notifCount>0&&<div style={{background:'var(--red)',color:'#fff',borderRadius:20,fontSize:10,fontWeight:700,padding:'2px 7px'}}>{notifCount}</div>}
        <div style={{fontSize:12,color:'var(--text-muted)'}}>{user.name} <span style={{color:'var(--dim)',fontSize:10}}>· Manager</span></div>
        <button onClick={logout} style={{padding:'5px 12px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Sign out</button>
      </div>
    </nav>
  )
}

function StatCard({value,label,color,onClick}:{value:number;label:string;color:string;onClick?:()=>void}){
  return(
    <div onClick={onClick} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px',cursor:onClick?'pointer':'default',transition:'all .2s',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(0,230,210,0.04) 0%,transparent 60%)',pointerEvents:'none'}}/>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,color,textShadow:`0 0 12px ${color}50`}}>{value}</div>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text-dim)',marginTop:3}}>{label}</div>
    </div>
  )
}

// ── JOBS TAB ───────────────────────────────────────────────────────────────
function JobsTab({serviceJobs,properties,onRefresh}:{serviceJobs:ServiceJob[];properties:Property[];onRefresh:()=>void}){
  const [showPost,setShowPost]=useState(false)
  const [expanded,setExpanded]=useState<string|null>(null)
  const [form,setForm]=useState({propertyId:'',category:'',title:'',description:'',scheduledDate:'',budget:'',urgency:'normal'})
  const [saving,setSaving]=useState(false)
  const [acting,setActing]=useState<string|null>(null)
  const [err,setErr]=useState('')
  const [filter,setFilter]=useState('all')

  const filtered=filter==='all'?serviceJobs:serviceJobs.filter(j=>j.status===filter)

  async function postJob(){
    if(!form.propertyId||!form.category||!form.title||!form.description){setErr('Property, category, title and description are required');return}
    setSaving(true);setErr('')
    const res=await fetch('/api/service-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    if(res.ok){setShowPost(false);setForm({propertyId:'',category:'',title:'',description:'',scheduledDate:'',budget:'',urgency:'normal'});onRefresh()}
    else{const d=await res.json();setErr(d.error||'Failed')}
    setSaving(false)
  }

  async function decideBid(jobId:string,bidId:string,status:'accepted'|'rejected'){
    setActing(bidId)
    await fetch(`/api/service-jobs/${jobId}/bids/${bidId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    onRefresh();setActing(null)
  }

  async function deleteJob(id:string){
    if(!confirm('Delete this job?'))return
    await fetch(`/api/service-jobs/${id}`,{method:'DELETE'});onRefresh()
  }

  const inp={width:'100%',background:'rgba(0,0,0,0.2)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 11px',color:'var(--text)',fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:'none',marginBottom:8}

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)'}}>Jobs</div>
        <div style={{display:'flex',gap:8}}>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...inp,width:140,marginBottom:0}}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={()=>setShowPost(!showPost)} style={{padding:'8px 18px',borderRadius:8,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>+ Post Job</button>
        </div>
      </div>

      {showPost&&(
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:20,marginBottom:20}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:14}}>Post a New Job</div>
          {err&&<div style={{color:'var(--red)',fontSize:12,marginBottom:8}}>{err}</div>}
          {properties.length===0?(
            <div style={{color:'var(--text-dim)',fontSize:13,padding:'12px 0'}}>Add a property first before posting jobs.</div>
          ):(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <select style={inp} value={form.propertyId} onChange={e=>setForm(p=>({...p,propertyId:e.target.value}))}>
                  <option value="">Select property *</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select style={inp} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  <option value="">Category *</option>
                  {Object.entries(CAT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
                <input style={inp} placeholder="Job title *" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
                <input style={inp} type="date" value={form.scheduledDate} onChange={e=>setForm(p=>({...p,scheduledDate:e.target.value}))}/>
                <input style={inp} placeholder="Max budget (optional)" type="number" value={form.budget} onChange={e=>setForm(p=>({...p,budget:e.target.value}))}/>
                <select style={inp} value={form.urgency} onChange={e=>setForm(p=>({...p,urgency:e.target.value}))}>
                  <option value="low">Low urgency</option><option value="normal">Normal urgency</option><option value="urgent">⚡ Urgent</option>
                </select>
              </div>
              <textarea style={{...inp,minHeight:80,resize:'vertical'}} placeholder="Describe the work needed *" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setShowPost(false)} style={{flex:1,padding:'8px',borderRadius:7,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:12}}>Cancel</button>
                <button onClick={postJob} disabled={saving} style={{flex:2,padding:'8px',borderRadius:7,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{saving?'Posting...':'Post Job'}</button>
              </div>
            </>
          )}
        </div>
      )}

      {filtered.length===0?(
        <div style={{color:'var(--text-dim)',fontSize:14,textAlign:'center',padding:'60px 0'}}>{serviceJobs.length===0?'No jobs posted yet.':'No jobs match this filter.'}</div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(job=>{
            const ss=STATUS_STYLES[job.status]||STATUS_STYLES.open
            const isExp=expanded===job.id
            const pendingBids=job.bids.filter(b=>b.status==='pending')
            return(
              <div key={job.id} style={{background:'var(--surface)',border:`1px solid ${isExp?'rgba(0,230,210,0.25)':'var(--border)'}`,borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setExpanded(isExp?null:job.id)}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:cc(job.category),boxShadow:`0 0 6px ${cc(job.category)}`,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{job.title}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10,background:ss.bg,color:ss.color}}>{ss.label}</span>
                      {job.urgency==='urgent'&&<span style={{fontSize:10,fontWeight:700,color:'#ff5370'}}>⚡ Urgent</span>}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-dim)'}}>
                      {job.property.name} · {cl(job.category)}
                      {job.scheduledDate&&` · ${fmtDate(job.scheduledDate)}`}
                      {job.budget&&` · Budget: $${job.budget.toFixed(0)}`}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                    {pendingBids.length>0&&<span style={{fontSize:11,fontWeight:700,color:'var(--amber)',background:'rgba(255,184,108,0.12)',padding:'2px 9px',borderRadius:10,border:'1px solid rgba(255,184,108,0.25)'}}>{pendingBids.length} bid{pendingBids.length>1?'s':''}</span>}
                    {job.assignedTo&&<span style={{fontSize:11,color:'var(--green)'}}>→ {job.assignedTo.name}</span>}
                    <button onClick={e=>{e.stopPropagation();deleteJob(job.id)}} style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:13,opacity:.5}}>✕</button>
                    <span style={{color:'var(--text-dim)',fontSize:11}}>{isExp?'▲':'▼'}</span>
                  </div>
                </div>

                {isExp&&(
                  <div style={{borderTop:'1px solid var(--border)',padding:'14px 16px'}}>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>{job.description}</div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--cyan)',marginBottom:10}}>Bids ({job.bids.length})</div>
                    {job.bids.length===0?(
                      <div style={{fontSize:12,color:'var(--text-dim)'}}>No bids yet. Connected providers will be notified.</div>
                    ):(
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {job.bids.map(bid=>{
                          const isAcc=bid.status==='accepted',isRej=bid.status==='rejected'
                          return(
                            <div key={bid.id} style={{background:isAcc?'rgba(0,229,160,0.07)':'rgba(0,0,0,0.15)',border:`1px solid ${isAcc?'rgba(0,229,160,0.25)':isRej?'rgba(255,83,112,0.15)':'var(--border)'}`,borderRadius:9,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,opacity:isRej?.5:1}}>
                              <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(0,230,210,0.1)',border:'1.5px solid rgba(0,230,210,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:'var(--cyan)',flexShrink:0}}>{bid.provider.name.charAt(0).toUpperCase()}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{bid.provider.name}</div>
                                <div style={{fontSize:11,color:'var(--text-dim)'}}>{bid.provider.company||bid.provider.email}{bid.estimatedDays&&` · ${bid.estimatedDays}d`}</div>
                                {bid.notes&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:3,fontStyle:'italic'}}>"{bid.notes}"</div>}
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                                <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:isAcc?'var(--green)':'var(--cyan-b)'}}>${bid.amount.toFixed(2)}</span>
                                {isAcc&&<span style={{fontSize:10,fontWeight:700,color:'var(--green)',background:'var(--green-bg)',padding:'2px 8px',borderRadius:10}}>✓ Accepted</span>}
                                {isRej&&<span style={{fontSize:10,color:'var(--red)'}}>Passed</span>}
                                {bid.status==='pending'&&job.status!=='awarded'&&(
                                  <div style={{display:'flex',gap:6}}>
                                    <button onClick={()=>decideBid(job.id,bid.id,'rejected')} disabled={acting===bid.id} style={{padding:'5px 12px',borderRadius:6,background:'var(--red-bg)',border:'1px solid rgba(255,83,112,0.2)',color:'var(--red)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Pass</button>
                                    <button onClick={()=>decideBid(job.id,bid.id,'accepted')} disabled={acting===bid.id} style={{padding:'5px 12px',borderRadius:6,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{acting===bid.id?'...':'Accept'}</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
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

// ── OVERVIEW ───────────────────────────────────────────────────────────────
function OverviewTab({properties,connections,jobs,serviceJobs,notifications,onMarkRead,onSetTab}:{properties:Property[];connections:Connection[];jobs:Job[];serviceJobs:ServiceJob[];notifications:Notification[];onMarkRead:()=>void;onSetTab:(t:Tab)=>void}){
  const active=connections.filter(c=>c.status==='active')
  const pendingBids=serviceJobs.reduce((n,j)=>n+j.bids.filter(b=>b.status==='pending').length,0)
  const openJobs=serviceJobs.filter(j=>['open','bidding'].includes(j.status)).length
  const upcoming=jobs.filter(j=>new Date(j.checkoutTime)>=new Date()).sort((a,b)=>new Date(a.checkoutTime).getTime()-new Date(b.checkoutTime).getTime()).slice(0,6)
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28}}>
        <StatCard value={properties.length} label="Properties" color="var(--cyan-b)" onClick={()=>onSetTab('properties')}/>
        <StatCard value={active.length} label="Team Members" color="var(--green)" onClick={()=>onSetTab('team')}/>
        <StatCard value={openJobs} label="Open Jobs" color="var(--amber)" onClick={()=>onSetTab('jobs')}/>
        <StatCard value={pendingBids} label="Bids to Review" color="var(--violet)" onClick={()=>onSetTab('jobs')}/>
      </div>
      {pendingBids>0&&(
        <div onClick={()=>onSetTab('jobs')} style={{background:'rgba(255,184,108,0.07)',border:'1px solid rgba(255,184,108,0.25)',borderRadius:12,padding:'14px 18px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--amber)'}}>{pendingBids} bid{pendingBids>1?'s':''} waiting for review</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>Click to review and accept</div>
          </div>
          <span style={{color:'var(--amber)',fontSize:16}}>→</span>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--cyan)',marginBottom:12}}>Upcoming Checkouts</div>
          {upcoming.length===0?<div style={{color:'var(--text-dim)',fontSize:13,padding:'20px 0'}}>No upcoming jobs yet.</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {upcoming.map(j=>(
                <div key={j.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'11px 14px',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'var(--cyan)',flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.displayName}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{j.propertyLabel}</div></div>
                  <div style={{fontSize:11,color:'var(--cyan)',fontWeight:700,flexShrink:0}}>{fmtDate(j.checkoutTime)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--cyan)'}}>Notifications</div>
            {notifications.some(n=>!n.readAt)&&<button onClick={onMarkRead} style={{fontSize:10,color:'var(--cyan)',background:'none',border:'none',cursor:'pointer'}}>Mark all read</button>}
          </div>
          {notifications.length===0?<div style={{color:'var(--text-dim)',fontSize:13}}>No notifications yet.</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {notifications.slice(0,8).map(n=>(
                <div key={n.id} style={{background:n.readAt?'var(--surface)':'rgba(0,230,210,0.06)',border:`1px solid ${n.readAt?'var(--border)':'rgba(0,230,210,0.2)'}`,borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{n.title}</div>
                  <div style={{fontSize:11,color:'var(--text-dim)'}}>{n.body}</div>
                  <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{fmtRel(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PROPERTIES ─────────────────────────────────────────────────────────────
function PropertiesTab({properties,onRefresh}:{properties:Property[];onRefresh:()=>void}){
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({name:'',address:'',platform:'manual',beds:'',baths:'',notes:'',accessCode:'',wifiName:'',wifiPass:''})
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState('')
  const inp={width:'100%',background:'rgba(0,0,0,0.2)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 11px',color:'var(--text)',fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:'none',marginBottom:8}
  async function add(){if(!form.name||!form.address){setErr('Name and address required');return}setSaving(true);setErr('');const res=await fetch('/api/properties',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});if(res.ok){setShowAdd(false);setForm({name:'',address:'',platform:'manual',beds:'',baths:'',notes:'',accessCode:'',wifiName:'',wifiPass:''});onRefresh()}else{const d=await res.json();setErr(d.error||'Failed')};setSaving(false)}
  async function del(id:string,name:string){if(!confirm(`Delete "${name}"?`))return;await fetch(`/api/properties/${id}`,{method:'DELETE'});onRefresh()}
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)'}}>Properties</div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:'8px 18px',borderRadius:8,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>+ Add Property</button>
      </div>
      {showAdd&&(
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:20,marginBottom:20}}>
          {err&&<div style={{color:'var(--red)',fontSize:12,marginBottom:8}}>{err}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <input style={inp} placeholder="Property name *" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <input style={inp} placeholder="Address *" value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}/>
            <select style={inp} value={form.platform} onChange={e=>setForm(p=>({...p,platform:e.target.value}))}><option value="manual">Manual</option><option value="airbnb">Airbnb</option><option value="hostaway">Hostaway</option></select>
            <input style={inp} placeholder="Notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
            <input style={inp} placeholder="Beds" type="number" value={form.beds} onChange={e=>setForm(p=>({...p,beds:e.target.value}))}/>
            <input style={inp} placeholder="Baths" type="number" step="0.5" value={form.baths} onChange={e=>setForm(p=>({...p,baths:e.target.value}))}/>
            <input style={inp} placeholder="Access code" value={form.accessCode} onChange={e=>setForm(p=>({...p,accessCode:e.target.value}))}/>
            <input style={inp} placeholder="WiFi name" value={form.wifiName} onChange={e=>setForm(p=>({...p,wifiName:e.target.value}))}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:'8px',borderRadius:7,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:12}}>Cancel</button>
            <button onClick={add} disabled={saving} style={{flex:2,padding:'8px',borderRadius:7,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{saving?'Saving...':'Save Property'}</button>
          </div>
        </div>
      )}
      {properties.length===0?<div style={{color:'var(--text-dim)',fontSize:14,textAlign:'center',padding:'60px 0'}}>No properties yet.</div>:(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {properties.map(p=>(
            <div key={p.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                <div><div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:'var(--text)'}}>{p.name}</div><div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>{p.address}</div></div>
                <button onClick={()=>del(p.id,p.name)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:14,opacity:.7}}>✕</button>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {p.platform&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'var(--cyan-bg)',color:'var(--cyan)',border:'1px solid rgba(0,230,210,0.2)'}}>{p.platform}</span>}
                {p.beds&&<span style={{fontSize:10,color:'var(--text-dim)'}}>{p.beds} bed</span>}
                {p.baths&&<span style={{fontSize:10,color:'var(--text-dim)'}}>{p.baths} bath</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TEAM ───────────────────────────────────────────────────────────────────
function TeamTab({connections,onRefresh}:{connections:Connection[];onRefresh:()=>void}){
  const active=connections.filter(c=>c.status==='active')
  const pending=connections.filter(c=>c.status==='pending')
  async function remove(id:string){if(!confirm('Remove?'))return;await fetch(`/api/connections/${id}`,{method:'DELETE'});onRefresh()}
  function Card({conn}:{conn:Connection}){const p=conn.provider,color=cc(conn.type);return(<div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}><div style={{width:40,height:40,borderRadius:'50%',background:`${color}22`,border:`2px solid ${color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color,flexShrink:0}}>{p.name.charAt(0).toUpperCase()}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{p.name}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{p.company||p.email}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:`${color}18`,color,border:`1px solid ${color}35`}}>{cl(conn.type)}</span>{conn.status==='pending'&&<span style={{fontSize:10,color:'var(--amber)'}}>Pending</span>}<button onClick={()=>remove(conn.id)} style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:12,opacity:.6}}>✕</button></div></div>)}
  return(<div><div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>My Team</div>
    {pending.length>0&&<div style={{marginBottom:24}}><div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--amber)',marginBottom:10}}>Pending ({pending.length})</div><div style={{display:'flex',flexDirection:'column',gap:8}}>{pending.map(c=><Card key={c.id} conn={c}/>)}</div></div>}
    {active.length>0&&<div><div style={{fontSize:11,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--green)',marginBottom:10}}>Active ({active.length})</div><div style={{display:'flex',flexDirection:'column',gap:8}}>{active.map(c=><Card key={c.id} conn={c}/>)}</div></div>}
    {active.length===0&&pending.length===0&&<div style={{color:'var(--text-dim)',fontSize:14,textAlign:'center',padding:'60px 0'}}>No team members yet. Use <strong style={{color:'var(--cyan)'}}>Find Providers</strong> to invite people.</div>}
  </div>)
}

// ── FIND ───────────────────────────────────────────────────────────────────
function FindTab({onRefresh}:{onRefresh:()=>void}){
  const [q,setQ]=useState('')
  const [role,setRole]=useState<'cleaner'|'provider'|''>('')
  const [results,setResults]=useState<User[]>([])
  const [loading,setLoading]=useState(false)
  const [inviting,setInviting]=useState<string|null>(null)
  const search=useCallback(async()=>{if(q.length<2){setResults([]);return}setLoading(true);const p=new URLSearchParams({q});if(role)p.set('role',role);const res=await fetch(`/api/users/search?${p}`);setResults(await res.json());setLoading(false)},[q,role])
  useEffect(()=>{const t=setTimeout(search,350);return()=>clearTimeout(t)},[search])
  async function invite(userId:string,type:string){setInviting(userId);await fetch('/api/connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({providerId:userId,type})});setResults(r=>r.map(u=>u.id===userId?{...u,connectionStatus:'pending'}:u));onRefresh();setInviting(null)}
  const inp={background:'rgba(0,0,0,0.2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',color:'var(--text)',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',width:'100%'}
  return(<div>
    <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'var(--cyan-b)',marginBottom:20}}>Find Providers</div>
    <div style={{display:'flex',gap:10,marginBottom:20}}>
      <input style={{...inp,flex:1}} placeholder="Search by name, company or email..." value={q} onChange={e=>setQ(e.target.value)}/>
      <select style={{...inp,width:160}} value={role} onChange={e=>setRole(e.target.value as any)}><option value="">All roles</option><option value="cleaner">Cleaners</option><option value="provider">Service Providers</option></select>
    </div>
    {loading&&<div style={{color:'var(--text-dim)',fontSize:13}}>Searching...</div>}
    {results.length>0&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
      {results.map(u=>{const color=cc(u.serviceCategory||(u.role==='cleaner'?'cleaner':'other'));return(
        <div key={u.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:42,height:42,borderRadius:'50%',background:`${color}22`,border:`2px solid ${color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color,flexShrink:0}}>{u.name.charAt(0).toUpperCase()}</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{u.name}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{u.company||u.email}</div>{u.serviceCategory&&<div style={{fontSize:10,color,marginTop:2,fontWeight:600}}>{cl(u.serviceCategory)}</div>}</div>
          <div>{u.connectionStatus==='active'?<span style={{fontSize:11,color:'var(--green)',fontWeight:600}}>✓ Connected</span>:u.connectionStatus==='pending'?<span style={{fontSize:11,color:'var(--amber)',fontWeight:600}}>Pending</span>:<button onClick={()=>invite(u.id,u.role==='cleaner'?'cleaner':(u.serviceCategory||'other'))} disabled={inviting===u.id} style={{padding:'6px 16px',borderRadius:7,background:'linear-gradient(135deg,#00b8a8,#00e6d2)',color:'#071a24',border:'none',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{inviting===u.id?'...':'+ Invite'}</button>}</div>
        </div>
      )})}
    </div>}
    {!loading&&q.length>=2&&results.length===0&&<div style={{color:'var(--text-dim)',fontSize:13,textAlign:'center',padding:'40px 0'}}>No users found for "{q}"</div>}
    {q.length<2&&<div style={{color:'var(--text-dim)',fontSize:13,textAlign:'center',padding:'40px 0'}}>Type at least 2 characters to search</div>}
  </div>)
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function ManagerDashboard(){
  const router=useRouter()
  const [user,setUser]=useState<User|null>(null)
  const [tab,setTab]=useState<Tab>('overview')
  const [properties,setProperties]=useState<Property[]>([])
  const [connections,setConnections]=useState<Connection[]>([])
  const [jobs,setJobs]=useState<Job[]>([])
  const [serviceJobs,setServiceJobs]=useState<ServiceJob[]>([])
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(!d.user||d.user.role!=='manager'){router.push('/login');return}setUser(d.user)})},[router])

  const loadData=useCallback(async()=>{
    const [p,c,j,s,n]=await Promise.all([fetch('/api/properties'),fetch('/api/connections'),fetch('/api/jobs'),fetch('/api/service-jobs'),fetch('/api/notifications')])
    const [props,conns,jobsData,svcJobs,notifs]=await Promise.all([p.json(),c.json(),j.json(),s.json(),n.json()])
    setProperties(Array.isArray(props)?props:[])
    setConnections(Array.isArray(conns)?conns:[])
    setJobs(Array.isArray(jobsData)?jobsData:[])
    setServiceJobs(Array.isArray(svcJobs)?svcJobs:[])
    setNotifications(Array.isArray(notifs)?notifs:[])
    setLoading(false)
  },[])

  useEffect(()=>{if(user)loadData()},[user,loadData])

  async function markAllRead(){await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:'all'})});loadData()}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}

  if(!user||loading)return(<div style={{minHeight:'100vh',background:'#0d1f2d',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:24,height:24,border:'2px solid rgba(0,230,210,0.2)',borderTopColor:'#00e6d2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>)

  return(
    <div style={{minHeight:'100vh',background:'var(--bg)',color:'var(--text)',fontFamily:"'DM Sans',sans-serif"}}>
      <Nav user={user} tab={tab} setTab={setTab} notifCount={notifications.filter(n=>!n.readAt).length} logout={logout}/>
      <main style={{padding:'28px 24px',maxWidth:1200,margin:'0 auto'}}>
        {tab==='overview'&&<OverviewTab properties={properties} connections={connections} jobs={jobs} serviceJobs={serviceJobs} notifications={notifications} onMarkRead={markAllRead} onSetTab={setTab}/>}
        {tab==='properties'&&<PropertiesTab properties={properties} onRefresh={loadData}/>}
        {tab==='jobs'&&<JobsTab serviceJobs={serviceJobs} properties={properties} onRefresh={loadData}/>}
        {tab==='team'&&<TeamTab connections={connections} onRefresh={loadData}/>}
        {tab==='find'&&<FindTab onRefresh={loadData}/>}
      </main>
    </div>
  )
}
