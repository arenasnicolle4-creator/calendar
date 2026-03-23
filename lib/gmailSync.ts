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

// Recursively pull all MIME parts
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

// Parse Turno job details from plain text body
// Works for both direct turno emails AND forwarded versions
function parseTurnoText(text: string, messageId: string, accountEmail: string): ParsedJob | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (!lower.includes('turno')) return null
  // Must have start time to be a valid job email
  if (!lower.includes('start time')) return null

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
    // Property label from "Cleaning X" line
    if (!propertyLabel && /^Cleaning\s+\S/.test(line) && !line.toLowerCase().includes('project')) {
      propertyLabel = line.replace(/^Cleaning\s+/, '').trim()
    }

    // Address — has Anchorage or AK, not a Cleaning line, not a time line
    if (!address && 
        (line.includes('Anchorage') || line.includes(', AK') || line.match(/\d{4}\s+\w/)) &&
        !line.startsWith('Cleaning') &&
        !line.toLowerCase().includes('start time') &&
        !line.toLowerCase().includes('end time') &&
        !line.toLowerCase().includes('copyright') &&
        !line.toLowerCase().includes('bishop')) {
      const hostIdx = line.indexOf('Host:')
      address = (hostIdx > -1 ? line.substring(0, hostIdx) : line).trim()
      // Grab host from same line if concatenated
      if (!hostName && hostIdx > -1) {
        hostName = line.substring(hostIdx).replace(/Host:\s*/i, '').replace(/\*/g, '').trim()
      }
    }

    // Host on its own line — strip markdown bold asterisks
    if (!hostName) {
      const m = line.match(/Host:\s*\*?(.+?)\*?$/i)
      if (m) hostName = m[1].trim()
    }

    // Start Time — format: "Start Time: Sat, Jun 20 2026 11:00 AM"
    if (!startTime) {
      const m = line.match(/Start\s*Time:\s*(.+)/i)
      if (m) {
        const dateStr = m[1].trim()
        let parsed = new Date(dateStr)
        // Strip day name if parse fails e.g. "Sat, Jun 20 2026" → "Jun 20 2026"
        if (isNaN(parsed.getTime())) {
          parsed = new Date(dateStr.replace(/^[A-Za-z]+,?\s*/, ''))
        }
        if (!isNaN(parsed.getTime())) startTime = parsed.toISOString()
      }
    }

    // End Time
    if (!endTime) {
      const m = line.match(/End\s*Time:\s*(.+)/i)
      if (m) {
        const dateStr = m[1].trim()
        let parsed = new Date(dateStr)
        if (isNaN(parsed.getTime())) {
          parsed = new Date(dateStr.replace(/^[A-Za-z]+,?\s*/, ''))
        }
        if (!isNaN(parsed.getTime())) endTime = parsed.toISOString()
      }
    }

    // Bedrooms — "Bedrooms: 4 Beds: 5" or "Bedrooms: 4"
    if (bedrooms === null) {
      const m = line.match(/Bedroom[s]?:\s*(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }

    // Bathrooms — "Bathrooms: 2.5" or on same line as bedrooms
    if (bathrooms === null) {
      const m = line.match(/Bathroom[s]?:\s*(\d+\.?\d*)/i)
      if (m) bathrooms = parseFloat(m[1])
    }

    // Checklist
    if (!checklist) {
      const m = line.match(/Checklist:\s*(.+)/i)
      if (m && !m[1].toLowerCase().includes('too many')) {
        checklist = m[1].trim()
      }
    }
  }

  // Must have start time
  if (!startTime) return null
  if (!address && !propertyLabel) return null

  return {
    address: address || propertyLabel || 'Unknown',
    hostName: hostName || null,
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

  // Get already-imported message IDs
  const existingIds = await prisma.job.findMany({
    where: { gmailAccountId: accountId, gmailMessageId: { not: null } },
    select: { gmailMessageId: true },
  })
  const seen = new Set(existingIds.map(j => j.gmailMessageId))

  // Search for BOTH direct Turno emails AND forwarded versions
  const queries = [
    'from:turno.com subject:"New Cleaning project available"',
    'subject:"Fwd: New Cleaning project available" "Start Time"',
    'subject:"FW: New Cleaning project available" "Start Time"',
  ]

  const allMessages: Array<{id: string}> = []
  for (const q of queries) {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
    })
    for (const msg of res.data.messages || []) {
      if (msg.id && !allMessages.find(m => m.id === msg.id)) {
        allMessages.push({ id: msg.id })
      }
    }
  }

  let imported = 0

  for (const msg of allMessages) {
    if (seen.has(msg.id)) continue

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    })

    const { plain } = extractParts(full.data.payload)

    const parsed = parseTurnoText(plain, msg.id, account.email)
    if (!parsed) continue

    const jobData = jobFromParsed(parsed)
    if (!jobData) continue

    try {
      await prisma.job.create({
        data: { ...jobData, gmailAccountId: accountId, gmailMessageId: msg.id },
      })
      imported++
    } catch {
      // Skip duplicates silently
    }
  }

  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: { lastSynced: new Date() },
  })

  return { imported, total: allMessages.length }
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
