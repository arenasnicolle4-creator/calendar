// app/api/auth/jobber/callback/route.ts
import { NextResponse } from 'next/server'
import { exchangeJobberCode } from '@/lib/jobberSync'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard?jobber=error', req.url))
  }

  try {
    const tokens = await exchangeJobberCode(code)

    // Fetch company info from Jobber
    let companyName: string | null = null
    let email: string | null = null
    try {
      const res = await fetch('https://api.getjobber.com/api/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-03-10',
        },
        body: JSON.stringify({ query: '{ account { name } user { email } }' }),
      })
      const json = await res.json()
      companyName = json.data?.account?.name || null
      email = json.data?.user?.email || null
    } catch { /* optional enrichment */ }

    const expiresAt = new Date(Date.now() + 55 * 60 * 1000)

    // Get logged-in user if available
    const currentUser = await getCurrentUser()
    const userId = currentUser?.id || null

    // Find existing account by email (if we have one), otherwise create new
    // FIX: use findFirst + update/create instead of upsert on email
    // (email is not a @unique field in the new schema)
    const existing = email
      ? await prisma.jobberAccount.findFirst({ where: { email } })
      : null

    if (existing) {
      await prisma.jobberAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          companyName: companyName || existing.companyName,
          userId: userId || existing.userId,
        },
      })
    } else {
      await prisma.jobberAccount.create({
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          companyName,
          email,
          userId,
        },
      })
    }

    // Redirect to correct dashboard
    const dest = currentUser?.role === 'cleaner'
      ? '/dashboard/cleaner?jobber=connected'
      : '/dashboard?jobber=connected'

    return NextResponse.redirect(new URL(dest, req.url))
  } catch (e) {
    console.error('Jobber callback error:', e)
    return NextResponse.redirect(new URL('/dashboard?jobber=error', req.url))
  }
}
