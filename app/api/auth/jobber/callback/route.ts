// app/api/auth/jobber/callback/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeJobberCode } from '@/lib/jobberSync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=jobber_${error || 'no_code'}`)
  }

  try {
    const tokens = await exchangeJobberCode(code)

    // Get account info from Jobber
    const meRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2024-11-15',
      },
      body: JSON.stringify({ query: `query { account { id name owner { email name { full } } } }` }),
    })
    const meData = await meRes.json()
    const account = meData?.data?.account
    const email = account?.owner?.email || `jobber-${Date.now()}@unknown.com`
    const companyName = account?.name || null

    // Upsert the account
    await prisma.jobberAccount.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        companyName,
      },
      create: {
        email,
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?connected=jobber&page=integrations`)
  } catch (e) {
    console.error('Jobber callback error:', e)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=jobber_auth_failed`)
  }
}
