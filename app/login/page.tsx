'use client'
// app/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLE_REDIRECTS: Record<string, string> = {
  manager:  '/dashboard/manager',
  cleaner:  '/dashboard/cleaner',
  provider: '/dashboard/provider',
  admin:    '/dashboard',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        return
      }
      const role = data.user?.role || (data.legacy ? 'admin' : 'admin')
      router.push(ROLE_REDIRECTS[role] || '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="bg-pattern" />
      <div className="login-container">

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
              <h1>Your centralized<br/>property operations<br/>hub.</h1>
              <p>One login. Every property, cleaner, and service provider you need.</p>
            </div>
            <div className="brand-features">
              <div className="feature-item"><span className="feature-dot" />Property Managers</div>
              <div className="feature-item"><span className="feature-dot" />Cleaners &amp; cleaning companies</div>
              <div className="feature-item"><span className="feature-dot" />Plumbers, electricians, lawn &amp; more</div>
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
            <div className="form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your CleanSync workspace</p>
            </div>

            <form onSubmit={handleLogin} className="auth-form">
              <div className="field-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <div className="error-msg">{error}</div>}
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? <span className="loading-dots"><span /><span /><span /></span>
                  : 'Sign in'}
              </button>
            </form>

            <div className="form-footer">
              <p>
                Don&apos;t have an account?{' '}
                <button onClick={() => router.push('/register')} className="switch-btn" type="button">
                  Create account
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .login-root{
          min-height:100vh;background:#0d1f2d;
          display:flex;align-items:stretch;
          font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;
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
        .login-container{display:flex;width:100%;min-height:100vh;position:relative;z-index:1;}
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
          color:#30ffea;text-shadow:0 0 16px rgba(0,230,210,0.7),0 0 40px rgba(0,230,210,0.3);letter-spacing:.5px;
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
        .form-panel{
          flex:.9;display:flex;align-items:center;justify-content:center;
          padding:52px 40px;background:rgba(9,20,32,0.97);
        }
        .form-inner{width:100%;max-width:360px;}
        .form-header{margin-bottom:28px;}
        .form-header h2{
          font-family:'Syne',sans-serif;font-size:26px;font-weight:700;
          color:#30ffea;text-shadow:0 0 16px rgba(0,230,210,0.4);margin-bottom:6px;
        }
        .form-header p{font-size:13px;color:#7fb3cc;}
        .auth-form{display:flex;flex-direction:column;gap:16px;}
        .field-group{display:flex;flex-direction:column;gap:6px;}
        .field-group label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4a7a96;}
        .field-group input{
          padding:11px 14px;background:rgba(0,0,0,0.25);
          border:1px solid rgba(0,230,210,0.14);border-radius:8px;
          color:#e2f0f7;font-family:'DM Sans',sans-serif;font-size:14px;
          outline:none;transition:border-color .15s,box-shadow .15s;
        }
        .field-group input:focus{
          border-color:#00e6d2;
          box-shadow:0 0 0 3px rgba(0,230,210,0.1),0 0 12px rgba(0,230,210,0.12);
          background:rgba(0,230,210,0.04);
        }
        .field-group input::placeholder{color:#4a7a96;}
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
        .submit-btn:hover:not(:disabled){box-shadow:0 0 28px rgba(0,230,210,0.5),0 4px 16px rgba(0,0,0,0.3);transform:translateY(-1px);}
        .submit-btn:disabled{opacity:.5;cursor:not-allowed;}
        .loading-dots{display:flex;gap:5px;align-items:center;}
        .loading-dots span{width:6px;height:6px;background:#071a24;border-radius:50%;animation:bounce .8s ease-in-out infinite alternate;}
        .loading-dots span:nth-child(2){animation-delay:.15s;}
        .loading-dots span:nth-child(3){animation-delay:.3s;}
        @keyframes bounce{0%{transform:translateY(0);opacity:.5}100%{transform:translateY(-4px);opacity:1}}
        .form-footer{margin-top:24px;text-align:center;font-size:13px;color:#4a7a96;}
        .switch-btn{
          background:none;border:none;color:#00e6d2;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
          cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:2px;
        }
        .switch-btn:hover{color:#30ffea;}
        @media(max-width:768px){
          .login-container{flex-direction:column;}
          .brand-panel{min-height:220px;flex:none;}
          .brand-tagline h1{font-size:26px;}
          .form-panel{padding:32px 20px;}
        }
      `}</style>
    </div>
  )
}
