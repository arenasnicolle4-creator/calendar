// app/api/auth/gmail/callback/route.ts
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getOAuthClient } from '@/lib/gmailSync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=gmail_denied`)
  }

  try {
    const oauth2Client = getOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get the email address for this account
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const email = userInfo.email

    if (!email) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=no_email`)
    }

    // Upsert the Gmail account
    await prisma.gmailAccount.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000),
      },
      create: {
        email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000),
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?connected=${encodeURIComponent(email)}`)
  } catch (err) {
    console.error('Gmail OAuth error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=oauth_failed`)
  }
}
