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

    // Log what Jobber actually returns for debugging
    console.log('Jobber token response keys:', Object.keys(tokens))
    console.log('expires_in:', (tokens as any).expires_in)
    console.log('expires_in type:', typeof (tokens as any).expires_in)

    // Jobber tokens last 1 hour — use 55 minutes to be safe
    // Don't rely on expires_in since Jobber may not return it consistently
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000)

    let email = `jobber-${Date.now()}@cleansync.app`
    let companyName: string | null = null

    try {
      const meRes = await fetch('https://api.getjobber.com/api/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-03-10',
        },
        body: JSON.stringify({ query: `query { account { id name } }` }),
      })
      const meData = await meRes.json()
      if (meData?.data?.account?.name) {
        companyName = meData.data.account.name
        const safeName = companyName.toLowerCase().replace(/\s+/g, '-')
        email = `${safeName}-${meData.data.account.id}@jobber.cleansync`
      }
    } catch (accountErr) {
      console.error('Could not fetch Jobber account info:', accountErr)
    }

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
    const msg = encodeURIComponent(String(e).slice(0, 100))
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=jobber_${msg}`
    )
  }
}
