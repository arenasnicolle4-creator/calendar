// lib/gmailSync.ts
import { google } from 'googleapis'
import { prisma } from './prisma'

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/gmail/callback`
  )
}

export function getGmailAuthUrl(state?: string) {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: state || '',
  })
}

async function getFreshToken(account: { id: string; accessToken: string; refreshToken: string; expiresAt: Date | null }): Promise<string> {
  // FIX: expiresAt is nullable — guard before constructing Date
  const isExpired = account.expiresAt ? new Date(account.expiresAt) <= new Date() : true

  if (!isExpired) return account.accessToken

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ refresh_token: account.refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: {
      accessToken: credentials.access_token || account.accessToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : account.expiresAt,
    },
  })

  return credentials.access_token || account.accessToken
}

export async function syncGmailAccount(accountId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Gmail account not found')

  const accessToken = await getFreshToken(account)

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: account.refreshToken })

  // Auto-refresh token if expired
  oauth2Client.on('tokens', async (tokens) => {
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token || account.accessToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : account.expiresAt,
      },
    })
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Gmail OAuth kept for future use — no active Turno parsing
  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: { lastSynced: new Date() },
  })

  return { imported: 0, total: 0 }
}

export async function syncAllAccounts() {
  const accounts = await prisma.gmailAccount.findMany()
  const results = []
  for (const account of accounts) {
    try {
      const r = await syncGmailAccount(account.id)
      results.push({ email: account.email, ...r })
    } catch (e) {
      results.push({ email: account.email, error: String(e) })
    }
  }
  return results
}
