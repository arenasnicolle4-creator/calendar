// lib/gmailSync.ts
import { google } from 'googleapis'
import { prisma } from './prisma'
import { parseTurnoEmail, jobFromParsed } from './parseEmail'

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

export async function syncGmailAccount(accountId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Account not found')

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  })

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

  // Search for Turno emails not yet imported
  const existingIds = await prisma.job.findMany({
    where: { gmailAccountId: accountId, gmailMessageId: { not: null } },
    select: { gmailMessageId: true },
  })
  const seen = new Set(existingIds.map(j => j.gmailMessageId))

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:noreply@turno.com subject:"New Cleaning project"',
    maxResults: 50,
  })

  const messages = res.data.messages || []
  let imported = 0

  for (const msg of messages) {
    if (!msg.id || seen.has(msg.id)) continue

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    })

    // Decode body
    let body = ''
    const payload = full.data.payload
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    } else if (payload?.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8')
        }
      }
    }

    if (!body) continue

    const parsed = parseTurnoEmail(body, msg.id, account.email)
    if (!parsed) continue

    const jobData = jobFromParsed(parsed)

    await prisma.job.create({
      data: {
        ...jobData,
        gmailAccountId: accountId,
        gmailMessageId: msg.id,
      },
    })
    imported++
  }

  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: { lastSynced: new Date() },
  })

  return { imported, total: messages.length }
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
