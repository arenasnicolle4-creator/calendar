'use client'
// app/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
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
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="login-root">
      {/* Background pattern */}
      <div className="bg-pattern" />

      <div className="login-container">
        {/* Left panel — branding */}
        <div className="brand-panel">
          <div className="brand-inner">
            <div className="brand-logo">
              <div className="logo-mark">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="14" height="14" rx="3" fill="currentColor" opacity="0.9"/>
                  <rect x="22" y="4" width="14" height="14" rx="3" fill="currentColor" opacity="0.6"/>
                  <rect x="4" y="22" width="14" height="14" rx="3" fill="currentColor" opacity="0.6"/>
                  <rect x="22" y="22" width="14" height="14" rx="3" fill="currentColor" opacity="0.3"/>
                </svg>
              </div>
              <span className="logo-text">CleanSync</span>
            </div>
            <div className="brand-tagline">
              <h1>Your centralized<br/>cleaning operations<br/>hub.</h1>
              <p>Connect all your platforms. Manage every job. One place.</p>
            </div>
            <div className="brand-features">
              <div className="feature-item">
                <span className="feature-dot" />
                Airbnb · Turno · Hostaway · Jobber
              </div>
              <div className="feature-item">
                <span className="feature-dot" />
                Auto-sync from Gmail
              </div>
              <div className="feature-item">
                <span className="feature-dot" />
                Team cleaner assignment
              </div>
            </div>
          </div>
          <div className="brand-grid">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="grid-cell" style={{ animationDelay: `${(i * 0.05) % 2}s` }} />
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="form-panel">
          <div className="form-inner">
            <div className="form-header">
              <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p>{mode === 'login' ? 'Sign in to your CleanSync workspace' : 'Set up your cleaning operations hub'}</p>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="auth-form">
                <div className="field-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
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
                  {loading ? (
                    <span className="loading-dots"><span /><span /><span /></span>
                  ) : 'Sign in'}
                </button>
              </form>
            ) : (
              <div className="signup-disabled">
                <div className="signup-icon">🔒</div>
                <h3>Sign-ups are currently closed</h3>
                <p>CleanSync is invite-only right now. If you&apos;d like access, reach out to the workspace admin.</p>
              </div>
            )}

            <div className="form-footer">
              {mode === 'login' ? (
                <p>
                  Want your own workspace?{' '}
                  <button onClick={() => setMode('signup')} className="switch-btn">
                    Request access
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="switch-btn">
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #f0ece6;
          display: flex;
          align-items: stretch;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .bg-pattern {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 50%, rgba(14,116,144,0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(165,243,252,0.15) 0%, transparent 40%),
            radial-gradient(circle at 60% 80%, rgba(14,116,144,0.04) 0%, transparent 40%);
          pointer-events: none;
        }

        .login-container {
          display: flex;
          width: 100%;
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }

        /* BRAND PANEL */
        .brand-panel {
          flex: 1.1;
          background: #0e7490;
          background-image:
            radial-gradient(circle at 30% 70%, rgba(165,243,252,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(6,182,212,0.2) 0%, transparent 40%);
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
        }

        .brand-inner {
          position: relative;
          z-index: 2;
          padding: 60px 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex: 1;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-mark {
          width: 40px;
          height: 40px;
          color: #a5f3fc;
        }

        .logo-text {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 300;
          color: #f0fafe;
          letter-spacing: 0.5px;
        }

        .brand-tagline {
          margin-top: auto;
          padding-top: 60px;
        }

        .brand-tagline h1 {
          font-family: 'Fraunces', serif;
          font-size: 42px;
          font-weight: 300;
          line-height: 1.15;
          color: #f0fafe;
          letter-spacing: -0.5px;
          margin-bottom: 20px;
        }

        .brand-tagline p {
          font-size: 15px;
          color: rgba(165,243,252,0.8);
          line-height: 1.6;
          max-width: 320px;
        }

        .brand-features {
          margin-top: 48px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(165,243,252,0.75);
          font-weight: 400;
        }

        .feature-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a5f3fc;
          flex-shrink: 0;
        }

        /* Animated grid */
        .brand-grid {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          grid-template-rows: repeat(6, 1fr);
          opacity: 0.06;
          pointer-events: none;
        }

        .grid-cell {
          border: 1px solid rgba(165,243,252,0.5);
          animation: pulse 4s ease-in-out infinite alternate;
        }

        @keyframes pulse {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }

        /* FORM PANEL */
        .form-panel {
          flex: 0.9;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 48px;
          background: #f5f1eb;
        }

        .form-inner {
          width: 100%;
          max-width: 380px;
        }

        .form-header {
          margin-bottom: 36px;
        }

        .form-header h2 {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 400;
          color: #0c4a5a;
          letter-spacing: -0.3px;
          margin-bottom: 8px;
        }

        .form-header p {
          font-size: 14px;
          color: #6b8a93;
          line-height: 1.5;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-group label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #4a7480;
        }

        .field-group input {
          padding: 12px 16px;
          border: 1.5px solid #c8dde2;
          border-radius: 10px;
          background: #faf8f5;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #0c4a5a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .field-group input:focus {
          border-color: #0e7490;
          box-shadow: 0 0 0 3px rgba(14,116,144,0.1);
          background: #fff;
        }

        .field-group input::placeholder {
          color: #b0c8cf;
        }

        .error-msg {
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          font-size: 13px;
          color: #dc2626;
        }

        .submit-btn {
          padding: 13px 20px;
          background: #0e7490;
          color: #f0fafe;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          margin-top: 4px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #0c6478;
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-dots {
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .loading-dots span {
          width: 6px;
          height: 6px;
          background: #a5f3fc;
          border-radius: 50%;
          animation: bounce 0.8s ease-in-out infinite alternate;
        }

        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          0% { transform: translateY(0); opacity: 0.5; }
          100% { transform: translateY(-4px); opacity: 1; }
        }

        /* SIGNUP DISABLED */
        .signup-disabled {
          text-align: center;
          padding: 40px 20px;
          background: #eef5f7;
          border-radius: 14px;
          border: 1.5px dashed #b0cdd4;
        }

        .signup-icon {
          font-size: 32px;
          margin-bottom: 14px;
        }

        .signup-disabled h3 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 400;
          color: #0c4a5a;
          margin-bottom: 10px;
        }

        .signup-disabled p {
          font-size: 13px;
          color: #6b8a93;
          line-height: 1.6;
          max-width: 260px;
          margin: 0 auto;
        }

        .form-footer {
          margin-top: 28px;
          text-align: center;
          font-size: 13px;
          color: #7a9aa3;
        }

        .switch-btn {
          background: none;
          border: none;
          color: #0e7490;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .switch-btn:hover { color: #0c6478; }

        @media (max-width: 768px) {
          .login-container { flex-direction: column; }
          .brand-panel { min-height: 280px; flex: none; }
          .brand-tagline h1 { font-size: 28px; }
          .brand-grid { grid-template-columns: repeat(6, 1fr); }
          .form-panel { padding: 40px 24px; }
        }
      `}</style>
    </div>
  )
}
