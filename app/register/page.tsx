'use client'
// app/register/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SERVICE_CATEGORIES = [
  { value: 'plumbing',   label: 'Plumber' },
  { value: 'electrical', label: 'Electrician' },
  { value: 'lawn',       label: 'Lawn Care' },
  { value: 'snow',       label: 'Snow Removal' },
  { value: 'handyman',   label: 'Handyman' },
  { value: 'pest',       label: 'Pest Control' },
  { value: 'hvac',       label: 'HVAC' },
  { value: 'painting',   label: 'Painting' },
  { value: 'roofing',    label: 'Roofing' },
  { value: 'other',      label: 'Other' },
]

const ROLES = [
  {
    value: 'manager',
    label: 'Property Manager',
    description: 'Manage properties, connect cleaners & service providers, post jobs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
        <rect x="2" y="3" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 9h20" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="5" y="13" width="5" height="3" rx="0.5" fill="currentColor" opacity=".5"/>
      </svg>
    ),
  },
  {
    value: 'cleaner',
    label: 'Cleaner',
    description: 'Sync your cleaning calendars from Hostaway, Jobber & more',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'provider',
    label: 'Service Provider',
    description: 'Browse jobs, submit bids, get hired & receive payments',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
        <path d="M3 21V9l9-6 9 6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="9" y="13" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="17" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 6h2M17 5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'role' | 'details'>('role')
  const [role, setRole] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    company: '', phone: '', serviceCategory: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (role === 'provider' && !form.serviceCategory) {
      setError('Please select your service category')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          role,
          company: form.company || undefined,
          phone: form.phone || undefined,
          serviceCategory: form.serviceCategory || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }
      // Route to correct dashboard based on role
      if (role === 'manager') router.push('/dashboard/manager')
      else if (role === 'cleaner') router.push('/dashboard/cleaner')
      else router.push('/dashboard/provider')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-root">
      <div className="bg-pattern" />
      <div className="register-container">

        {/* Left brand panel */}
        <div className="brand-panel">
          <div className="brand-inner">
            <div className="brand-logo">
              <div className="logo-mark">
                <svg viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="4" width="14" height="14" rx="3" fill="currentColor" opacity=".9"/>
                  <rect x="22" y="4" width="14" height="14" rx="3" fill="currentColor" opacity=".6"/>
                  <rect x="4" y="22" width="14" height="14" rx="3" fill="currentColor" opacity=".6"/>
                  <rect x="22" y="22" width="14" height="14" rx="3" fill="currentColor" opacity=".3"/>
                </svg>
              </div>
              <span className="logo-text">CleanSync</span>
            </div>
            <div className="brand-tagline">
              <h1>One platform.<br/>Every property.<br/>Every pro.</h1>
              <p>Connect your properties, cleaners, and service providers — all in one place.</p>
            </div>
            <div className="brand-features">
              <div className="feature-item"><span className="feature-dot" />Property managers</div>
              <div className="feature-item"><span className="feature-dot" />Cleaners &amp; cleaning companies</div>
              <div className="feature-item"><span className="feature-dot" />Plumbers, electricians, lawn &amp; more</div>
              <div className="feature-item"><span className="feature-dot" />Bids, invoicing &amp; payments</div>
            </div>
          </div>
          <div className="brand-grid">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="grid-cell" style={{ animationDelay: `${(i * 0.05) % 2}s` }} />
            ))}
          </div>
        </div>

        {/* Right form panel */}
        <div className="form-panel">
          <div className="form-inner">

            {step === 'role' ? (
              <>
                <div className="form-header">
                  <h2>Create your account</h2>
                  <p>Choose the role that describes you best</p>
                </div>
                <div className="role-grid">
                  {ROLES.map(r => (
                    <button
                      key={r.value}
                      className={`role-card ${role === r.value ? 'selected' : ''}`}
                      onClick={() => setRole(r.value)}
                      type="button"
                    >
                      <div className="role-icon">{r.icon}</div>
                      <div className="role-label">{r.label}</div>
                      <div className="role-desc">{r.description}</div>
                    </button>
                  ))}
                </div>
                <button
                  className="submit-btn"
                  disabled={!role}
                  onClick={() => role && setStep('details')}
                  type="button"
                >
                  Continue as {ROLES.find(r => r.value === role)?.label || '—'}
                </button>
                <div className="form-footer">
                  Already have an account?{' '}
                  <button className="switch-btn" onClick={() => router.push('/login')} type="button">
                    Sign in
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-header">
                  <button className="back-btn" onClick={() => setStep('role')} type="button">
                    ← Back
                  </button>
                  <h2>
                    {role === 'manager' ? 'Property Manager' : role === 'cleaner' ? 'Cleaner' : 'Service Provider'} account
                  </h2>
                  <p>Fill in your details to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="field-row">
                    <div className="field-group">
                      <label>Full name</label>
                      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required />
                    </div>
                    <div className="field-group">
                      <label>Email</label>
                      <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
                    </div>
                  </div>

                  {(role === 'manager' || role === 'provider') && (
                    <div className="field-row">
                      <div className="field-group">
                        <label>Company <span className="optional">optional</span></label>
                        <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Your company name" />
                      </div>
                      <div className="field-group">
                        <label>Phone <span className="optional">optional</span></label>
                        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(907) 555-0100" />
                      </div>
                    </div>
                  )}

                  {role === 'provider' && (
                    <div className="field-group">
                      <label>Service category</label>
                      <select value={form.serviceCategory} onChange={e => set('serviceCategory', e.target.value)} required>
                        <option value="">Select your trade...</option>
                        {SERVICE_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field-row">
                    <div className="field-group">
                      <label>Password</label>
                      <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="8+ characters" required />
                    </div>
                    <div className="field-group">
                      <label>Confirm password</label>
                      <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" required />
                    </div>
                  </div>

                  {error && <div className="error-msg">{error}</div>}

                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? <span className="loading-dots"><span /><span /><span /></span> : 'Create account'}
                  </button>
                </form>

                <div className="form-footer">
                  Already have an account?{' '}
                  <button className="switch-btn" onClick={() => router.push('/login')} type="button">
                    Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}

        .register-root{
          min-height:100vh;background:#0d1f2d;
          display:flex;align-items:stretch;
          font-family:'DM Sans',sans-serif;
          position:relative;overflow:hidden;
          background-image:
            linear-gradient(rgba(0,230,210,0.03) 1px,transparent 1px),
            linear-gradient(90deg,rgba(0,230,210,0.03) 1px,transparent 1px);
          background-size:38px 38px;
        }
        .bg-pattern{
          position:fixed;inset:0;pointer-events:none;
          background:
            radial-gradient(ellipse at 15% 20%,rgba(0,180,210,0.12) 0%,transparent 50%),
            radial-gradient(ellipse at 85% 75%,rgba(0,100,180,0.1) 0%,transparent 50%);
        }
        .register-container{display:flex;width:100%;min-height:100vh;position:relative;z-index:1;}

        /* Brand */
        .brand-panel{
          flex:1.1;background:#0d1f2d;
          display:flex;align-items:stretch;position:relative;overflow:hidden;
          border-right:1px solid rgba(0,230,210,0.12);
        }
        .brand-inner{
          position:relative;z-index:2;padding:52px 48px;
          display:flex;flex-direction:column;justify-content:space-between;flex:1;
        }
        .brand-logo{display:flex;align-items:center;gap:12px;}
        .logo-mark{width:36px;height:36px;color:#00e6d2;filter:drop-shadow(0 0 8px rgba(0,230,210,0.6));}
        .logo-text{
          font-family:'Syne',sans-serif;font-size:20px;font-weight:800;
          color:#30ffea;
          text-shadow:0 0 16px rgba(0,230,210,0.7),0 0 40px rgba(0,230,210,0.3);
          letter-spacing:.5px;
        }
        .brand-tagline{margin-top:auto;padding-top:48px;}
        .brand-tagline h1{
          font-family:'Syne',sans-serif;font-size:38px;font-weight:700;
          line-height:1.15;color:#e2f0f7;letter-spacing:-.5px;margin-bottom:18px;
        }
        .brand-tagline p{font-size:14px;color:#7fb3cc;line-height:1.6;max-width:300px;}
        .brand-features{margin-top:40px;display:flex;flex-direction:column;gap:10px;}
        .feature-item{display:flex;align-items:center;gap:9px;font-size:13px;color:rgba(0,230,210,0.6);}
        .feature-dot{width:5px;height:5px;border-radius:50%;background:#00e6d2;box-shadow:0 0 5px #00e6d2;flex-shrink:0;}
        .brand-grid{
          position:absolute;inset:0;display:grid;
          grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(6,1fr);
          opacity:.04;pointer-events:none;
        }
        .grid-cell{border:1px solid rgba(0,230,210,0.5);animation:pulse 4s ease-in-out infinite alternate;}
        @keyframes pulse{0%{opacity:.3}100%{opacity:1}}

        /* Form panel */
        .form-panel{
          flex:.9;display:flex;align-items:flex-start;justify-content:center;
          padding:48px 40px;background:rgba(9,20,32,0.97);overflow-y:auto;
        }
        .form-inner{width:100%;max-width:460px;}
        .form-header{margin-bottom:28px;}
        .form-header h2{
          font-family:'Syne',sans-serif;font-size:24px;font-weight:700;
          color:#30ffea;text-shadow:0 0 16px rgba(0,230,210,0.4);
          margin-bottom:6px;margin-top:10px;
        }
        .form-header p{font-size:13px;color:#7fb3cc;}
        .back-btn{
          background:none;border:none;color:#4a7a96;font-size:12px;cursor:pointer;
          font-family:'DM Sans',sans-serif;padding:0;margin-bottom:8px;
          transition:color .15s;
        }
        .back-btn:hover{color:#00e6d2;}

        /* Role cards */
        .role-grid{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;}
        .role-card{
          display:flex;align-items:flex-start;gap:14px;
          padding:16px;border-radius:12px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(0,230,210,0.1);
          cursor:pointer;text-align:left;
          transition:all .15s;width:100%;
        }
        .role-card:hover{background:rgba(0,230,210,0.06);border-color:rgba(0,230,210,0.25);}
        .role-card.selected{
          background:rgba(0,230,210,0.1);
          border-color:rgba(0,230,210,0.5);
          box-shadow:0 0 20px rgba(0,230,210,0.12);
        }
        .role-icon{color:#00e6d2;margin-top:2px;flex-shrink:0;}
        .role-card.selected .role-icon{filter:drop-shadow(0 0 6px rgba(0,230,210,0.6));}
        .role-label{
          font-family:'Syne',sans-serif;font-size:14px;font-weight:700;
          color:#e2f0f7;margin-bottom:4px;
        }
        .role-card.selected .role-label{color:#30ffea;}
        .role-desc{font-size:12px;color:#7fb3cc;line-height:1.4;}

        /* Form fields */
        .auth-form{display:flex;flex-direction:column;gap:14px;}
        .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .field-group{display:flex;flex-direction:column;gap:6px;}
        .field-group label{
          font-size:10px;font-weight:700;text-transform:uppercase;
          letter-spacing:1px;color:#4a7a96;
        }
        .optional{font-size:9px;font-weight:400;color:#4a7a96;text-transform:none;letter-spacing:0;margin-left:4px;}
        .field-group input,
        .field-group select{
          padding:10px 13px;
          background:rgba(0,0,0,0.25);
          border:1px solid rgba(0,230,210,0.14);
          border-radius:8px;
          color:#e2f0f7;font-family:'DM Sans',sans-serif;font-size:13px;
          outline:none;transition:border-color .15s,box-shadow .15s;
          width:100%;
        }
        .field-group input:focus,
        .field-group select:focus{
          border-color:#00e6d2;
          box-shadow:0 0 0 3px rgba(0,230,210,0.1),0 0 12px rgba(0,230,210,0.12);
          background:rgba(0,230,210,0.04);
        }
        .field-group input::placeholder{color:#4a7a96;}
        .field-group select option{background:#0d1f2d;color:#e2f0f7;}

        .error-msg{
          padding:10px 14px;background:rgba(255,83,112,0.1);
          border:1px solid rgba(255,83,112,0.25);border-radius:8px;
          font-size:13px;color:#ff8fa3;
        }

        .submit-btn{
          padding:13px 20px;width:100%;
          background:linear-gradient(135deg,#00b8a8,#00e6d2);
          color:#071a24;border:none;border-radius:9px;
          font-family:'Syne',sans-serif;font-size:14px;font-weight:700;
          cursor:pointer;letter-spacing:.3px;
          box-shadow:0 0 16px rgba(0,230,210,0.3),0 2px 8px rgba(0,0,0,0.3);
          transition:all .16s;margin-top:4px;
          display:flex;align-items:center;justify-content:center;min-height:46px;
        }
        .submit-btn:hover:not(:disabled){
          box-shadow:0 0 28px rgba(0,230,210,0.5),0 4px 16px rgba(0,0,0,0.3);
          transform:translateY(-1px);
        }
        .submit-btn:disabled{opacity:.5;cursor:not-allowed;}

        .loading-dots{display:flex;gap:5px;align-items:center;}
        .loading-dots span{
          width:6px;height:6px;background:#071a24;border-radius:50%;
          animation:bounce .8s ease-in-out infinite alternate;
        }
        .loading-dots span:nth-child(2){animation-delay:.15s;}
        .loading-dots span:nth-child(3){animation-delay:.3s;}
        @keyframes bounce{0%{transform:translateY(0);opacity:.5}100%{transform:translateY(-4px);opacity:1}}

        .form-footer{margin-top:22px;text-align:center;font-size:13px;color:#4a7a96;}
        .switch-btn{
          background:none;border:none;color:#00e6d2;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
          cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:2px;
        }
        .switch-btn:hover{color:#30ffea;}

        @media(max-width:768px){
          .register-container{flex-direction:column;}
          .brand-panel{min-height:220px;flex:none;}
          .brand-tagline h1{font-size:26px;}
          .form-panel{padding:32px 20px;}
          .field-row{grid-template-columns:1fr;}
        }
      `}</style>
    </div>
  )
}
