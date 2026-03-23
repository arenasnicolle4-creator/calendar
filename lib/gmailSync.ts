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

// Recursively pull all text and html from MIME parts
function extractParts(payload: any): { plain: string; html: string } {
  let plain = ''
  let html = ''
  if (!payload) return { plain, html }

  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
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

// Convert Turno HTML email to plain text preserving field structure
function htmlToText(html: string): string {
  return html
    // Table cells and rows → newlines/spaces
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8226;/gi, '•')
    .replace(/&bull;/gi, '•')
    .replace(/&#x2022;/gi, '•')
    .replace(/&middot;/gi, '·')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Parse Turno job from text (works for both plain text and HTML-converted-to-text)
function parseTurnoText(text: string, messageId: string, accountEmail: string): ParsedJob | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (!lower.includes('turno')) return null
  if (!lower.includes('start time') && !lower.includes('start\u00a0time')) return null

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let propertyLabel: string | null = null
  let address: string | null = null
  let hostName: string | null = null
  let startTime: string | null = null
  let endTime: string | null = null
  let bedrooms: number | null = null
  let bathrooms: number | null = null
  let checklist: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Property label — "Cleaning XYZ" 
    if (!propertyLabel && /^Cleaning\s+\S/.test(line)) {
      propertyLabel = line.replace(/^Cleaning\s+/, '').trim()
    }

    // Address — contains city/state, not the property line
    if (!address) {
      if ((line.includes('Anchorage') || line.includes(', AK') || line.includes('#Unit')) 
          && !line.startsWith('Cleaning')
          && !lower.includes('start time')
          && !lower.includes('end time')) {
        // Strip host info if concatenated on same line
        const hostIdx = line.indexOf('Host:')
        address = (hostIdx > -1 ? line.substring(0, hostIdx) : line).trim()
        // Also grab host from same line
        if (!hostName && hostIdx > -1) {
          hostName = line.substring(hostIdx).replace(/Host:\s*/i, '').trim()
        }
      }
    }

    // Host on its own line
    if (!hostName) {
      const m = line.match(/Host:\s*(.+)/i)
      if (m) hostName = m[1].split('\t')[0].trim()
    }

    // Start Time — handle formats like "Start Time: Fri, Mar 6 2026 11:00 AM"
    if (!startTime) {
      const m = line.match(/Start\s*Time[:\s]+(.+)/i)
      if (m) {
        const dateStr = m[1].trim()
        // Try direct parse
        let parsed = new Date(dateStr)
        // If direct parse fails, try stripping day name
        if (isNaN(parsed.getTime())) {
          const stripped = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          parsed = new Date(stripped)
        }
        if (!isNaN(parsed.getTime())) startTime = parsed.toISOString()
      }
    }

    // End Time
    if (!endTime) {
      const m = line.match(/End\s*Time[:\s]+(.+)/i)
      if (m) {
        const dateStr = m[1].trim()
        let parsed = new Date(dateStr)
        if (isNaN(parsed.getTime())) {
          const stripped = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          parsed = new Date(stripped)
        }
        if (!isNaN(parsed.getTime())) endTime = parsed.toISOString()
      }
    }

    // Bedrooms
    if (bedrooms === null) {
      const m = line.match(/Bedroom[s]?\s*[:\s]+(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }

    // Bathrooms
    if (bathrooms === null) {
      const m = line.match(/Bathroom[s]?\s*[:\s]+(\d+\.?\d*)/i)
      if (m) bathrooms = parseFloat(m[1])
    }

    // Checklist
    if (!checklist) {
      const m = line.match(/Checklist[:\s]+(.+)/i)
      if (m && !m[1].toLowerCase().includes('too many')) {
        checklist = m[1].trim()
      }
    }
  }

  // Need at least a start time to create a job
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

  // Get already-imported IDs
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

    // Get full message with all MIME parts
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    })

    const { plain, html } = extractParts(full.data.payload)

    let parsed: ParsedJob | null = null

    // Try plain text first — if it has "Start Time" in it, use it directly
    if (plain && plain.toLowerCase().includes('start time')) {
      parsed = parseTurnoText(plain, msg.id, account.email)
    }

    // Fall back to HTML converted to text
    if (!parsed && html) {
      const htmlAsText = htmlToText(html)
      parsed = parseTurnoText(htmlAsText, msg.id, account.email)
    }

    // Skip if we couldn't parse a valid date
    if (!parsed) continue

    const jobData = jobFromParsed(parsed)
    if (!jobData) continue // skip if no valid start time

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
