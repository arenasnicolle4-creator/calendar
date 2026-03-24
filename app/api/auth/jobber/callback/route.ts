// app/api/auth/jobber/callback/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeJobberCode } from '@/lib/jobberSync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=jobber_${error || 'no_code'}`
    )
  }

  try {
    const tokens = await exchangeJobberCode(code)

    // Try to get account info — use a simple query that works across API versions
    let email = `jobber-${Date.now()}@cleansync.app`
    let companyName: string | null = null

    try {
      const meRes = await fetch('https://api.getjobber.com/api/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2024-11-15',
        },
        body: JSON.stringify({
          query: `query {
            account {
              id
              name
            }
          }`
        }),
      })
      const meData = await meRes.json()
      if (meData?.data?.account?.name) {
        companyName = meData.data.account.name
        // Use company name as unique key since email may not be available
        const safeName = (companyName || 'jobber').toLowerCase().replace(/\s+/g, '-')
        email = `${safeName}-${meData.data.account.id}@jobber.cleansync`
      }
    } catch (accountErr) {
      console.error('Could not fetch Jobber account info:', accountErr)
      // Continue with fallback email — don't fail the whole auth
    }

    // Upsert the account — use 1 hour fallback if expires_in missing
    const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    await prisma.jobberAccount.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        companyName,
      },
      create: {
        email,
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?connected=jobber&page=integrations`
    )
  } catch (e) {
    console.error('Jobber callback error:', String(e))
    // Pass the actual error message through so we can debug
    const msg = encodeURIComponent(String(e).slice(0, 100))
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=jobber_${msg}`
    )
  }
}
