// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/gmail/callback',
  '/api/auth/jobber/callback',
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
  const sessionToken = request.cookies.get('cleansync_session')?.value
  if (sessionToken) {
    const session = verifySessionToken(sessionToken)
    if (session) {
      // Inject user info into headers for route handlers
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', session.userId)
      requestHeaders.set('x-user-role', session.role)
      return NextResponse.next({ request: { headers: requestHeaders } })
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
