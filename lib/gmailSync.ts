// lib/gmailSync.ts — Gmail OAuth connection (Turno sync removed, kept for future use)
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

export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await prisma.gmailAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Gmail account not found')

  if (new Date(account.expiresAt) > new Date()) return account.accessToken

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ refresh_token: account.refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: {
      accessToken: credentials.access_token!,
      expiresAt: new Date(credentials.expiry_date!),
      ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
    },
  })

  return credentials.access_token!
}

// Stub — no active Turno email sync
export async function syncGmailAccount(accountId: string) {
  return { imported: 0, total: 0, note: 'Gmail sync paused — Turno email format does not include job details' }
}

export async function syncAllGmailAccounts() {
  const accounts = await prisma.gmailAccount.findMany()
  return accounts.map(a => ({ email: a.email, imported: 0, total: 0 }))
}
