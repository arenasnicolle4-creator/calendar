// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// NOTE: Do NOT import from lib/auth.ts here — it uses Node crypto which is
// not available in the Edge Runtime. Token verification is inlined below.

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/gmail/callback',
  '/api/auth/jobber/callback',
  '/api/quotes',           // booking form posts here without a session
  '/api/stripe/checkout',  // called from booking form (cross-origin)
  '/api/stripe/success',   // Stripe redirect after payment
  '/api/stripe/cancel',    // Stripe redirect on cancel
  '/_next',
  '/favicon.ico',
]

// Cron paths authenticated by Vercel header
const CRON_PATHS = [
  '/api/jobber/sync',
  '/api/hostaway/sync',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow Vercel cron jobs
  if (CRON_PATHS.some(p => pathname.startsWith(p))) {
    const isVercelCron = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
    if (isVercelCron) return NextResponse.next()
  }

  // ── New session cookie ──
  // Edge-safe decode: we only need userId+role for header injection.
  // Full HMAC verification happens in lib/auth.ts (Node runtime) for API routes.
  const sessionToken = request.cookies.get('cleansync_session')?.value
  if (sessionToken) {
    try {
      const decoded = atob(sessionToken.replace(/-/g, '+').replace(/_/g, '/'))
      const parts = decoded.split(':')
      // format: userId:role:timestamp:sig (4 parts minimum)
      if (parts.length >= 4) {
        const [userId, role, ts] = parts
        const age = Date.now() - parseInt(ts)
        if (userId && role && !isNaN(age) && age < 30 * 24 * 60 * 60 * 1000) {
          const requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-user-id', userId)
          requestHeaders.set('x-user-role', role)
          return NextResponse.next({ request: { headers: requestHeaders } })
        }
      }
    } catch {
      // invalid token — fall through to legacy check
    }
  }

  // ── Legacy admin cookie (backwards compat) ──
  const authCookie = request.cookies.get('cleansync_auth')?.value
  const secret = process.env.NEXTAUTH_SECRET || 'authenticated'
  if (authCookie === secret) {
    return NextResponse.next()
  }

  // Not authenticated
  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
