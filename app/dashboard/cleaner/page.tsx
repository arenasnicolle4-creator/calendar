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

type Page = 'dashboard' | 'quotes' | 'clients' | 'calendar' | 'integrations' | 'settings' | 'quote-detail'

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
  const [activeQuoteId, setActiveQuoteId] = useState<string|null>(null)
  const [selectedJob, setSelectedJob] = useState<Job|null>(null)

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
    await load()
  }

  async function deleteQuote(id:string){
    await fetch(`/api/quotes/${id}`,{method:'DELETE'})
    if(activeQuoteId===id){setActiveQuoteId(null);setPage('quotes')}
    await load()
  }

  function openQuoteDetail(q:Quote){
    setActiveQuoteId(q.id)
    setPage('quote-detail')
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

  // ── QUOTE DETAIL PAGE ─────────────────────────────────────────────────────
  function QuoteDetailPage(){
    const quote = quotes.find(q=>q.id===activeQuoteId)
    if(!quote) return <div style={{padding:40,color:T.dim,textAlign:'center'}}>Quote not found. <button onClick={()=>setPage('quotes')} style={{color:T.cyan,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif'}}>Back to Quotes</button></div>

    const q = quote
    const sc = STATUS[q.status]||STATUS.pending
    const isIB = q.submissionType==='instant_book'

    // Editable state
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [sendErr, setSendErr] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    // Editable fields
    const [editTotal, setEditTotal] = useState(q.totalPrice.toString())
    const [editSubtotal, setEditSubtotal] = useState(q.subtotal.toString())
    const [editDiscount, setEditDiscount] = useState(q.discount.toString())
    const [editDiscountLabel, setEditDiscountLabel] = useState(q.discountLabel)
    const [editBreakdown, setEditBreakdown] = useState(q.priceBreakdown)
    const [editService, setEditService] = useState(q.serviceType)
    const [editFrequency, setEditFrequency] = useState(q.frequency)
    const [editAddress, setEditAddress] = useState(q.address)
    const [editSqft, setEditSqft] = useState(q.sqftRange||'')
    const [editBeds, setEditBeds] = useState(q.bedrooms?.toString()||'')
    const [editBaths, setEditBaths] = useState(q.bathrooms?.toString()||'')
    const [editAddons, setEditAddons] = useState(q.addonsList)
    const [editNotes, setEditNotes] = useState(q.additionalNotes)
    const [editKeyAreas, setEditKeyAreas] = useState(q.keyAreas)

    // Parse price breakdown into editable line items
    const [lineItems, setLineItems] = useState<{label:string;amount:string}[]>(()=>{
      const lines = q.priceBreakdown.split('\n').filter(Boolean)
      return lines.map(line => {
        const parts = line.split('..')
        const label = parts[0]?.trim() || line
        const amountMatch = line.match(/\$[\d,.]+/)
        return { label, amount: amountMatch ? amountMatch[0].replace('$','') : '0' }
      })
    })

    function addLineItem(){
      setLineItems([...lineItems, {label:'New Item', amount:'0'}])
    }
    function removeLineItem(idx:number){
      setLineItems(lineItems.filter((_,i)=>i!==idx))
    }
    function updateLineItem(idx:number, field:'label'|'amount', value:string){
      const updated = [...lineItems]
      updated[idx] = {...updated[idx], [field]: value}
      setLineItems(updated)
      // Recalculate subtotal from line items
      const newSubtotal = updated.reduce((sum,li)=>sum + (parseFloat(li.amount)||0), 0)
      setEditSubtotal(newSubtotal.toFixed(2))
      const disc = parseFloat(editDiscount)||0
      setEditTotal((newSubtotal - disc).toFixed(2))
    }

    function recalcTotal(){
      const sub = parseFloat(editSubtotal)||0
      const disc = parseFloat(editDiscount)||0
      setEditTotal(Math.max(0, sub - disc).toFixed(2))
    }

    async function saveChanges(){
      setSaving(true)
      const breakdown = lineItems.map(li => `${li.label}...$${parseFloat(li.amount||'0').toFixed(2)}`).join('\n')
      await fetch(`/api/quotes/${q.id}`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          totalPrice: parseFloat(editTotal),
          subtotal: parseFloat(editSubtotal),
          discount: parseFloat(editDiscount),
          discountLabel: editDiscountLabel,
          priceBreakdown: breakdown,
          serviceType: editService,
          frequency: editFrequency,
          address: editAddress,
          sqftRange: editSqft||null,
          bedrooms: editBeds ? parseInt(editBeds) : null,
          bathrooms: editBaths ? parseFloat(editBaths) : null,
          addonsList: editAddons,
          additionalNotes: editNotes,
          keyAreas: editKeyAreas,
        })
      })
      await load()
      setSaving(false)
      setSaved(true)
      setEditing(false)
      setTimeout(()=>setSaved(false), 2500)
    }

    async function sendEmail(){
      setSending(true);setSendErr('')
      try{
        const r=await fetch(`/api/quotes/${q.id}/email`,{method:'POST'})
        const d=await r.json()
        if(r.ok){setSent(true);load()}
        else setSendErr(d.error||'Failed to send')
      }catch(e){setSendErr(String(e))}
      setSending(false)
    }

    async function handleDelete(){
      setDeleting(true)
      await deleteQuote(q.id)
      setDeleting(false)
    }

    const fieldStyle = editing ? {
      ...inp,
      background: dark ? 'rgba(255,255,255,0.08)' : '#f0f9ff',
      border: `1px solid ${T.borderB}`,
    } as React.CSSProperties : {
      ...inp,
      background: 'transparent',
      border: `1px solid transparent`,
      cursor: 'default',
      padding: '10px 0',
    } as React.CSSProperties

    const sectionHeader = (title:string,icon:string) => (
      <div style={{fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase' as const,color:T.cyan,marginBottom:12,display:'flex',alignItems:'center',gap:6,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:14}}>{icon}</span>{title}
      </div>
    )

    return(
      <div style={{maxWidth:960,margin:'0 auto'}}>
        {/* Breadcrumb + Actions Bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>setPage('quotes')} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.surf,color:T.muted,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Inter,sans-serif'}}>
              ← Quotes
            </button>
            <span style={{color:T.dim,fontSize:12}}>/</span>
            <span style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</span>
            <span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,color:sc.color,border:`1px solid ${sc.color}40`,background:dark?'rgba(255,255,255,0.05)':L.surf}}>{sc.label}</span>
            {isIB&&<span style={{fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:20,background:D.greenBg,color:D.green,border:'1px solid rgba(16,185,129,0.3)'}}>⚡ Instant Book</span>}
          </div>
          <div style={{display:'flex',gap:6}}>
            {saved&&<span style={{fontSize:12,color:D.green,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>✓ Saved</span>}
            {!editing ? (
              <button onClick={()=>setEditing(true)} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${T.borderB}`,background:T.cyanBg,color:T.cyan,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif'}}>
                ✎ Edit Quote
              </button>
            ) : (
              <>
                <button onClick={()=>setEditing(false)} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Inter,sans-serif'}}>
                  Cancel
                </button>
                <button onClick={saveChanges} disabled={saving} style={{padding:'8px 18px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#0ea5e9,#0284c7)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',boxShadow:'0 4px 14px rgba(14,165,233,0.35)',opacity:saving?.7:1}}>
                  {saving ? 'Saving...' : '✓ Save Changes'}
                </button>
              </>
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
            <div style={{fontSize:11,color:T.dim,marginTop:2}}>per visit</div>
          </div>
        </div>

        {/* Main content grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16,alignItems:'start'}}>
          {/* Left column */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Pricing / Line Items */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Pricing & Line Items','💰')}
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {lineItems.map((li,idx)=>(
                  <div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${T.border}`}}>
                    {editing ? (
                      <>
                        <input value={li.label} onChange={e=>updateLineItem(idx,'label',e.target.value)} style={{...fieldStyle,flex:1}} />
                        <div style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                          <span style={{color:T.muted,fontSize:13,fontWeight:700}}>$</span>
                          <input value={li.amount} onChange={e=>updateLineItem(idx,'amount',e.target.value)} style={{...fieldStyle,width:80,textAlign:'right'}} type="number" step="0.01" />
                        </div>
                        <button onClick={()=>removeLineItem(idx)} style={{width:26,height:26,borderRadius:6,border:`1px solid rgba(239,68,68,0.3)`,background:D.redBg,color:D.red,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                      </>
                    ) : (
                      <>
                        <span style={{flex:1,fontSize:13,color:T.muted,fontWeight:500}}>{li.label}</span>
                        <span style={{fontSize:13,color:T.text,fontWeight:700}}>${parseFloat(li.amount||'0').toFixed(2)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {editing&&(
                <button onClick={addLineItem} style={{marginTop:10,padding:'7px 14px',borderRadius:7,border:`1px dashed ${T.borderB}`,background:'transparent',color:T.cyan,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',width:'100%'}}>
                  + Add Line Item
                </button>
              )}
              {/* Discount */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',marginTop:6,borderTop:`1px solid ${T.border}`}}>
                {editing ? (
                  <>
                    <input value={editDiscountLabel} onChange={e=>setEditDiscountLabel(e.target.value)} placeholder="Discount label" style={{...fieldStyle,flex:1,fontSize:12,color:D.green}} />
                    <div style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                      <span style={{color:D.green,fontSize:12,fontWeight:700}}>-$</span>
                      <input value={editDiscount} onChange={e=>{setEditDiscount(e.target.value);}} onBlur={recalcTotal} style={{...fieldStyle,width:80,textAlign:'right',color:D.green}} type="number" step="0.01" />
                    </div>
                  </>
                ) : (
                  q.discount > 0 && <>
                    <span style={{fontSize:12,color:D.green,fontWeight:700}}>✓ {q.discountLabel}</span>
                    <span style={{fontSize:12,color:D.green,fontWeight:800}}>-{fmtMoney(q.discount)}</span>
                  </>
                )}
              </div>
              {q.instantBookSavings!=null&&q.instantBookSavings>0&&(
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:D.greenBg,borderRadius:8,marginTop:4,border:'1px solid rgba(16,185,129,0.3)'}}>
                  <span style={{color:D.green,fontWeight:700,fontSize:12}}>⚡ Instant Book Discount (10%)</span>
                  <span style={{color:D.green,fontWeight:800,fontSize:12}}>-{fmtMoney(q.instantBookSavings)}/visit</span>
                </div>
              )}
              {/* Total */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderTop:`2px solid ${T.borderB}`,marginTop:10}}>
                <span style={{color:T.text,fontWeight:800,fontSize:15}}>Total per visit</span>
                {editing ? (
                  <div style={{display:'flex',alignItems:'center',gap:2}}>
                    <span style={{color:isIB?D.green:T.cyan,fontSize:20,fontWeight:900}}>$</span>
                    <input value={editTotal} onChange={e=>setEditTotal(e.target.value)} style={{...fieldStyle,width:100,textAlign:'right',fontSize:20,fontWeight:900,color:isIB?D.green:T.cyan}} type="number" step="0.01" />
                  </div>
                ) : (
                  <span style={{color:isIB?D.green:T.cyan,fontWeight:900,fontSize:22}}>{fmtMoney(q.totalPrice)}</span>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Service Details','🏠')}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  {label:'Service Type',value:editService,setter:setEditService,key:'service'},
                  {label:'Frequency',value:editFrequency,setter:setEditFrequency,key:'freq'},
                  {label:'Square Footage',value:editSqft,setter:setEditSqft,key:'sqft'},
                  {label:'Bedrooms',value:editBeds,setter:setEditBeds,key:'beds'},
                  {label:'Bathrooms',value:editBaths,setter:setEditBaths,key:'baths'},
                ].map(f=>(
                  <div key={f.key}>
                    <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.label}</div>
                    {editing ? (
                      <input value={f.value} onChange={e=>f.setter(e.target.value)} style={fieldStyle} />
                    ) : (
                      <div style={{fontSize:13,fontWeight:600,color:T.text,padding:'10px 0'}}>{f.value||'—'}</div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Property Address</div>
                {editing ? (
                  <input value={editAddress} onChange={e=>setEditAddress(e.target.value)} style={fieldStyle} />
                ) : (
                  <div style={{fontSize:13,fontWeight:600,color:T.text,padding:'10px 0'}}>{q.address||'—'}</div>
                )}
              </div>
            </div>

            {/* Add-ons & Notes */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Add-ons & Notes','📝')}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Add-ons</div>
                {editing ? (
                  <textarea value={editAddons} onChange={e=>setEditAddons(e.target.value)} rows={3} style={{...fieldStyle,resize:'vertical'}} />
                ) : (
                  <div style={{fontSize:13,color:T.muted,lineHeight:1.6,padding:'6px 0'}}>{q.addonsList&&q.addonsList!=='None selected' ? q.addonsList : '—'}</div>
                )}
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Key Areas</div>
                {editing ? (
                  <textarea value={editKeyAreas} onChange={e=>setEditKeyAreas(e.target.value)} rows={2} style={{...fieldStyle,resize:'vertical'}} />
                ) : (
                  <div style={{fontSize:13,color:T.muted,lineHeight:1.6,padding:'6px 0'}}>{q.keyAreas||'—'}</div>
                )}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Additional Notes</div>
                {editing ? (
                  <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} rows={3} style={{...fieldStyle,resize:'vertical'}} />
                ) : (
                  <div style={{fontSize:13,color:T.muted,lineHeight:1.6,padding:'6px 0'}}>{q.additionalNotes||'—'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Client Info */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Client','👤')}
              {[
                {l:'Name',v:`${q.client.firstName} ${q.client.lastName}`},
                {l:'Email',v:q.client.email},
                {l:'Phone',v:q.client.phone||'—'},
                {l:'Address',v:[q.client.address,q.client.city,q.client.state,q.client.zip].filter(Boolean).join(', ')||'—'},
                {l:'Client Since',v:fmtDate(q.client.createdAt)},
              ].map(f=>(
                <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`,gap:8}}>
                  <span style={{fontSize:11,color:T.dim,fontWeight:600,flexShrink:0}}>{f.l}</span>
                  <span style={{fontSize:12,color:T.text,fontWeight:600,textAlign:'right'}}>{f.v}</span>
                </div>
              ))}
            </div>

            {/* Scheduling */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Scheduling','📅')}
              {[
                {l:'Preferred Date 1',v:fmtDate(q.preferredDate1)},
                {l:'Preferred Date 2',v:fmtDate(q.preferredDate2)},
                {l:'Preferred Times',v:q.preferredTimes||'—'},
              ].map(f=>(
                <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${T.border}`,gap:8}}>
                  <span style={{fontSize:11,color:T.dim,fontWeight:600,flexShrink:0}}>{f.l}</span>
                  <span style={{fontSize:12,color:T.text,fontWeight:600,textAlign:'right'}}>{f.v}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{...card,padding:'22px'}}>
              {sectionHeader('Actions','⚡')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {/* Send quote email */}
                {!isIB && (
                  <button onClick={sendEmail} disabled={sending||sent} style={{width:'100%',padding:'12px',borderRadius:10,background:sent?D.greenBg:dark?'linear-gradient(135deg,#0ea5e9,#0284c7)':'linear-gradient(135deg,#0ea5e9,#0284c7)',color:'#fff',border:sent?`1px solid rgba(16,185,129,0.3)`:'none',fontSize:13,fontWeight:800,cursor:sent?'default':'pointer',fontFamily:'Inter,sans-serif',boxShadow:sent?'none':'0 6px 20px rgba(14,165,233,0.35)',opacity:sending?.7:1}}>
                    {sent ? '✓ Quote Email Sent!' : sending ? 'Sending...' : '✉ Send Quote to Client'}
                  </button>
                )}
                {sendErr&&<div style={{padding:'8px 12px',borderRadius:8,background:D.redBg,color:D.red,fontSize:12,border:'1px solid rgba(239,68,68,0.3)'}}>{sendErr}</div>}

                {/* Status actions */}
                {q.status==='pending'&&(
                  <button onClick={()=>updateStatus(q.id,'reviewed')} style={{width:'100%',padding:'11px',borderRadius:10,background:T.cyanBg,border:`1px solid ${T.borderB}`,color:T.cyan,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Mark Reviewed</button>
                )}
                {['pending','reviewed'].includes(q.status)&&(
                  <button onClick={()=>updateStatus(q.id,'booked')} style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 6px 20px rgba(16,185,129,0.3)'}}>
                    ✓ Confirm Booking
                  </button>
                )}
                {q.status==='booked'&&(
                  <button onClick={()=>updateStatus(q.id,'completed')} style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    Mark Completed
                  </button>
                )}
                {q.status!=='cancelled'&&(
                  <button onClick={()=>updateStatus(q.id,'cancelled')} style={{width:'100%',padding:'11px',borderRadius:10,background:D.redBg,border:'1px solid rgba(239,68,68,0.3)',color:D.red,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    Cancel Quote
                  </button>
                )}

                {/* Delete */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:4}}>
                  {!confirmDelete ? (
                    <button onClick={()=>setConfirmDelete(true)} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid rgba(239,68,68,0.2)`,background:'transparent',color:D.red,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:0.7}}>
                      🗑 Delete Quote
                    </button>
                  ) : (
                    <div style={{background:D.redBg,borderRadius:10,padding:'14px',border:'1px solid rgba(239,68,68,0.3)'}}>
                      <div style={{fontSize:12,fontWeight:700,color:D.red,marginBottom:8}}>Delete this quote permanently?</div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:'8px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'Inter,sans-serif'}}>Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} style={{flex:1,padding:'8px',borderRadius:7,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif',opacity:deleting?.6:1}}>
                          {deleting?'Deleting...':'Yes, Delete'}
                        </button>
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
                    <div key={q.id} onClick={()=>openQuoteDetail(q)} style={{...card,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color .15s'}}
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
                  <div key={j.id} onClick={()=>setSelectedJob(j)} style={{...card,padding:'9px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',transition:'border-color .15s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
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
    const [deleteId,setDeleteId]=useState<string|null>(null)
    const [deletingId,setDeletingId]=useState<string|null>(null)
    const filtered=quotes
      .filter(q=>filter==='all'||q.status===filter)
      .filter(q=>!search||`${q.client.firstName} ${q.client.lastName} ${q.client.email} ${q.serviceType}`.toLowerCase().includes(search.toLowerCase()))

    async function handleDelete(id:string,e:React.MouseEvent){
      e.stopPropagation()
      setDeletingId(id)
      await deleteQuote(id)
      setDeletingId(null)
      setDeleteId(null)
    }

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
              const isDelTarget = deleteId===q.id
              return(
                <div key={q.id} style={{position:'relative'}}>
                  <div onClick={()=>openQuoteDetail(q)} style={{...card,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'border-color .15s',opacity:isDelTarget?0.5:1}}
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
                    <div style={{textAlign:'right' as const,flexShrink:0,marginRight:36}}>
                      <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:isIB?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</div>
                      {q.instantBookSavings!=null&&q.instantBookSavings>0&&<div style={{fontSize:10,color:D.green,fontWeight:700}}>saving {fmtMoney(q.instantBookSavings)}</div>}
                    </div>
                  </div>
                  {/* Delete button */}
                  {!isDelTarget ? (
                    <button onClick={(e)=>{e.stopPropagation();setDeleteId(q.id)}} title="Delete quote" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:6,border:`1px solid rgba(239,68,68,0.15)`,background:'transparent',color:D.red,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.4,transition:'opacity .15s'}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.opacity='1';(e.currentTarget as HTMLButtonElement).style.background=D.redBg}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity='0.4';(e.currentTarget as HTMLButtonElement).style.background='transparent'}}>
                      🗑
                    </button>
                  ) : (
                    <div onClick={e=>e.stopPropagation()} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',display:'flex',gap:4,alignItems:'center',background:dark?'rgba(2,8,20,0.95)':L.card,padding:'5px 8px',borderRadius:8,border:`1px solid rgba(239,68,68,0.3)`,boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
                      <span style={{fontSize:11,color:D.red,fontWeight:600,marginRight:4}}>Delete?</span>
                      <button onClick={(e)=>handleDelete(q.id,e)} disabled={deletingId===q.id} style={{padding:'4px 10px',borderRadius:5,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Inter,sans-serif',opacity:deletingId===q.id?.6:1}}>
                        {deletingId===q.id?'...':'Yes'}
                      </button>
                      <button onClick={(e)=>{e.stopPropagation();setDeleteId(null)}} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'Inter,sans-serif'}}>No</button>
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
                                <div key={q.id} onClick={()=>openQuoteDetail(q)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:T.surf,borderRadius:8,cursor:'pointer',border:`1px solid ${T.border}`}}>
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

    // Day detail panel
    const [selectedDate, setSelectedDate] = useState<Date|null>(null)
    const selJobs = selectedDate ? jobsOn(selectedDate) : []
    const selQuotes = selectedDate ? quotesOn(selectedDate) : []

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

        <div style={{display:'grid',gridTemplateColumns: selectedDate ? '1fr 300px' : '1fr',gap:16}}>
          {/* Calendar grid */}
          <div>
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
                const hasEvents = dj.length > 0 || dq.length > 0
                const isSelected = selectedDate && sameDay(date, selectedDate)
                return(
                  <div key={day}
                    onClick={()=>setSelectedDate(isSelected ? null : date)}
                    style={{
                      background:isSelected ? (dark?'rgba(93,235,241,0.15)':'rgba(14,165,233,0.12)') : isT?T.cyanBg:dark?D.surf:L.surf,
                      padding:'5px 4px',
                      borderTop:isSelected ? `2px solid ${T.cyan}` : isT?`2px solid ${T.cyan}`:'2px solid transparent',
                      display:'flex',flexDirection:'column',overflow:'hidden',
                      cursor: hasEvents ? 'pointer' : 'default',
                      transition:'background .12s',
                    }}>
                    <div style={{fontSize:11,fontWeight:700,color:isT?T.cyan:T.dim,marginBottom:3,width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',background:isT?T.cyanBg:'transparent'}}>{day}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:2,flex:1,overflow:'hidden'}}>
                      {dj.slice(0,2).map(j=>(
                        <div key={j.id} onClick={(e)=>{e.stopPropagation();setSelectedJob(j);setSelectedDate(date)}} style={{padding:'1px 4px',borderRadius:3,background:T.cyanBg,borderLeft:`2px solid ${T.cyan}`,fontSize:9,fontWeight:700,color:T.cyan,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}>{fmtTime(j.checkoutTime)} {j.displayName}</div>
                      ))}
                      {dq.slice(0,1).map(q=>(
                        <div key={q.id} onClick={(e)=>{e.stopPropagation();openQuoteDetail(q)}} style={{padding:'1px 4px',borderRadius:3,background:q.submissionType==='instant_book'?D.amberBg:D.greenBg,borderLeft:`2px solid ${q.submissionType==='instant_book'?D.amber:D.green}`,fontSize:9,fontWeight:700,color:q.submissionType==='instant_book'?D.amber:D.green,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}>
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

          {/* Day detail panel */}
          {selectedDate && (
            <div style={{...card,padding:'18px',position:'sticky',top:24,maxHeight:'calc(100vh - 120px)',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div>
                  <div style={{fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:800,color:T.text}}>
                    {selectedDate.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
                  </div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{selJobs.length} job{selJobs.length!==1?'s':''} · {selQuotes.length} quote{selQuotes.length!==1?'s':''}</div>
                </div>
                <button onClick={()=>setSelectedDate(null)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:13}}>×</button>
              </div>

              {selJobs.length > 0 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',color:T.cyan,marginBottom:8}}>Synced Jobs</div>
                  {selJobs.map(j=>(
                    <div key={j.id} onClick={()=>setSelectedJob(j)} style={{padding:'10px 12px',background:T.cyanBg,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6,cursor:'pointer',transition:'border-color .12s'}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{j.displayName}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{j.propertyLabel}</div>
                      <div style={{display:'flex',gap:10,marginTop:4}}>
                        <span style={{fontSize:10,color:T.cyan,fontWeight:600}}>{fmtTime(j.checkoutTime)}</span>
                        <span style={{fontSize:10,color:T.dim,fontWeight:600,textTransform:'capitalize'}}>{j.platform}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selQuotes.length > 0 && (
                <div>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase',color:D.green,marginBottom:8}}>Quotes & Bookings</div>
                  {selQuotes.map(q=>{
                    const sc = STATUS[q.status]||STATUS.pending
                    return(
                      <div key={q.id} onClick={()=>openQuoteDetail(q)} style={{padding:'10px 12px',background:q.submissionType==='instant_book'?D.amberBg:D.greenBg,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:6,cursor:'pointer',transition:'border-color .12s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.borderB}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.text}}>{q.client.firstName} {q.client.lastName}</div>
                          <span style={{fontSize:14,fontWeight:900,color:q.submissionType==='instant_book'?D.green:T.cyan}}>{fmtMoney(q.totalPrice)}</span>
                        </div>
                        <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>
                          <span style={{fontSize:10,color:T.muted}}>{q.serviceType}</span>
                          <span style={{fontSize:8,fontWeight:800,padding:'1px 6px',borderRadius:8,color:sc.color,border:`1px solid ${sc.color}40`}}>{sc.label}</span>
                          {q.submissionType==='instant_book'&&<span style={{fontSize:8,fontWeight:800,color:D.green}}>⚡</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {selJobs.length===0 && selQuotes.length===0 && (
                <div style={{textAlign:'center',padding:'24px 0',color:T.dim,fontSize:12}}>No events on this day.</div>
              )}
            </div>
          )}
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

  // ── JOB DETAIL MODAL ──────────────────────────────────────────────────────
  function JobModal(){
    if(!selectedJob) return null
    const j = selectedJob
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelectedJob(null)}>
        <div style={{background:dark?'rgba(2,8,30,0.98)':'#ffffff',border:dark?`1px solid ${D.borderB}`:`1px solid ${L.borderB}`,borderRadius:18,width:'100%',maxWidth:420,boxShadow:dark?'0 30px 80px rgba(0,0,0,0.7)':'0 20px 60px rgba(0,0,0,0.15)',padding:'24px'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:18,fontWeight:900,color:T.text}}>{j.displayName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:3}}>{j.propertyLabel}</div>
            </div>
            <button onClick={()=>setSelectedJob(null)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.dim,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>
          {[
            {l:'Platform',v:j.platform,icon:'🔌'},
            {l:'Checkout',v:`${fmtDate(j.checkoutTime)} at ${fmtTime(j.checkoutTime)}`,icon:'📅'},
            {l:'Check-in',v:j.checkinTime ? `${fmtDate(j.checkinTime)} at ${fmtTime(j.checkinTime)}` : '—',icon:'🏠'},
          ].map(f=>(
            <div key={f.l} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14}}>{f.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:'uppercase',letterSpacing:1}}>{f.l}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:1}}>{f.v}</div>
              </div>
            </div>
          ))}
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
            const active = page===id || (page==='quote-detail' && id==='quotes')
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
        {page==='quote-detail' &&<QuoteDetailPage/>}
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

      {selectedJob&&<JobModal/>}

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
