// lib/gmailSync.ts
import { google } from 'googleapis'
import { prisma } from './prisma'
import { jobFromParsed, ParsedJob } from './parseEmail'

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

// Recursively extract plain and HTML text from all MIME parts
function extractParts(payload: any): { plain: string; html: string } {
  let plain = ''
  let html = ''
  if (!payload) return { plain, html }
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    if (payload.mimeType === 'text/plain') plain += decoded
    if (payload.mimeType === 'text/html') html += decoded
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const sub = extractParts(part)
      plain += sub.plain
      html += sub.html
    }
  }
  return { plain, html }
}

// Parse Turno job details from HTML email body
function parseTurnoHTML(html: string, messageId: string, accountEmail: string): ParsedJob | null {
  if (!html || !html.toLowerCase().includes('turno')) return null
  if (!html.includes('Start Time') && !html.includes('Start\u00a0Time')) return null

  // Convert HTML to readable text preserving structure
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8226;/gi, '•')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let propertyLabel: string | null = null
  let address: string | null = null
  let hostName: string | null = null
  let startTime: string | null = null
  let endTime: string | null = null
  let bedrooms: number | null = null
  let bathrooms: number | null = null
  let checklist: string | null = null

  for (const line of lines) {
    if (!propertyLabel && /^Cleaning\s+\S/.test(line)) {
      propertyLabel = line.replace(/^Cleaning\s+/, '').trim()
    }
    if (!address && (line.includes('Anchorage') || line.includes(', AK')) && !line.startsWith('Cleaning')) {
      address = line.split('Host:')[0].trim()
    }
    if (!hostName) {
      const m = line.match(/Host[:\s]+(.+)/i)
      if (m) hostName = m[1].split('\t')[0].trim()
    }
    if (!startTime) {
      const m = line.match(/Start\s*Time[:\s]+(.+)/i)
      if (m) {
        const p = new Date(m[1].trim())
        if (!isNaN(p.getTime())) startTime = p.toISOString()
      }
    }
    if (!endTime) {
      const m = line.match(/End\s*Time[:\s]+(.+)/i)
      if (m) {
        const p = new Date(m[1].trim())
        if (!isNaN(p.getTime())) endTime = p.toISOString()
      }
    }
    if (bedrooms === null) {
      const m = line.match(/Bedroom[s]?\s*[:\s]+(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }
    if (bathrooms === null) {
      const m = line.match(/Bathroom[s]?\s*[:\s]+(\d+\.?\d*)/i)
      if (m) bathrooms = parseFloat(m[1])
    }
    if (!checklist) {
      const m = line.match(/Checklist[:\s]+(.+)/i)
      if (m) checklist = m[1].trim()
    }
  }

  if (!startTime) return null
  if (!address && !propertyLabel) return null

  return {
    address: address || propertyLabel || 'Unknown',
    hostName,
    startTime,
    endTime,
    bedrooms,
    bathrooms,
    checklist,
    gmailMessageId: messageId,
    gmailAccountEmail: accountEmail,
  }
}

export async function syncGmailAccount(accountId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Account not found')

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  })

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

  const existingIds = await prisma.job.findMany({
    where: { gmailAccountId: accountId, gmailMessageId: { not: null } },
    select: { gmailMessageId: true },
  })
  const seen = new Set(existingIds.map(j => j.gmailMessageId))

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:turno.com subject:"New Cleaning project available"',
    maxResults: 100,
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

    const { plain, html } = extractParts(full.data.payload)

    let parsed: ParsedJob | null = null

    // Try HTML first — Turno info@turno.com emails have details in HTML
    if (html) parsed = parseTurnoHTML(html, msg.id, account.email)

    // Fall back to plain text — noreply@turno.com emails have details in plain text
    if (!parsed && plain) {
      const { parseTurnoEmail } = await import('./parseEmail')
      parsed = parseTurnoEmail(plain, msg.id, account.email)
    }

    if (!parsed) continue

    const jobData = jobFromParsed(parsed)

    try {
      await prisma.job.create({
        data: { ...jobData, gmailAccountId: accountId, gmailMessageId: msg.id },
      })
      imported++
    } catch {
      // Skip duplicates
    }
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
