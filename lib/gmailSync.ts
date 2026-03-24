// lib/gmailSync.ts
import { google } from 'googleapis'
import { prisma } from './prisma'
import { jobFromParsed } from './parseEmail'
import type { ParsedJob } from './parseEmail'

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

function extractParts(payload: any): { plain: string; html: string } {
  let plain = '', html = ''
  if (!payload) return { plain, html }
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    if (payload.mimeType === 'text/plain') plain += decoded
    if (payload.mimeType === 'text/html') html += decoded
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractParts(part)
      plain += sub.plain
      html += sub.html
    }
  }
  return { plain, html }
}

// Alaska is currently on AKDT (UTC-8) from March to November
// AKST (UTC-9) November to March
// Turno shows times in Alaska local time — we store as UTC
function parseAlaskaTime(dateStr: string): Date | null {
  if (!dateStr) return null
  // Strip day name prefix: "Mon, Jun 8 2026 11:00 AM" → "Jun 8 2026 11:00 AM"
  const stripped = dateStr.trim().replace(/^[A-Za-z]+,?\s*/, '').trim()
  // Try with AKDT offset (-08:00) first — currently active most of the year
  const withAKDT = stripped.replace(/(AM|PM)\s*$/i, '$1 -08:00')
  let d = new Date(withAKDT)
  if (!isNaN(d.getTime())) return d
  // Try with AKST offset (-09:00)
  const withAKST = stripped.replace(/(AM|PM)\s*$/i, '$1 -09:00')
  d = new Date(withAKST)
  if (!isNaN(d.getTime())) return d
  // Last resort — parse as-is
  d = new Date(stripped)
  if (!isNaN(d.getTime())) return d
  return null
}

function parseTurnoText(text: string, messageId: string, accountEmail: string): ParsedJob | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (!lower.includes('turno')) return null
  if (!lower.includes('start time')) return null

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find where the actual Turno content starts — after the forwarded header
  // Look for the "New Cleaning project available" line to skip all header lines
  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('new cleaning project available')) {
      startIdx = i
      break
    }
  }
  const parseLines = lines.slice(startIdx)

  let propertyLabel: string | null = null
  let address: string | null = null
  let hostName: string | null = null
  let startTime: string | null = null
  let endTime: string | null = null
  let bedrooms: number | null = null
  let beds: number | null = null
  let bathrooms: number | null = null
  let checklist: string | null = null

  for (const line of parseLines) {
    // Skip the subject/header lines that contain "Subject:" or "Date:" or "From:" or "To:"
    if (/^(Subject|Date|From|To|Cc|Bcc):/i.test(line)) continue

    // Property label — "Cleaning X" (not "Cleaning project")
    if (!propertyLabel && /^Cleaning\s+\S/.test(line) && !line.toLowerCase().includes('project')) {
      propertyLabel = line.replace(/^Cleaning\s+/, '').trim()
    }

    // Address — street address pattern or contains Anchorage
    // Must NOT be a Subject/Date/Header line
    if (!address &&
        !line.toLowerCase().startsWith('subject:') &&
        !line.toLowerCase().startsWith('new cleaning') &&
        !line.toLowerCase().startsWith('cleaning') &&
        !line.toLowerCase().includes('start time') &&
        !line.toLowerCase().includes('end time') &&
        !line.toLowerCase().includes('too many') &&
        !line.toLowerCase().includes('bishop') &&
        !line.toLowerCase().includes('project details') &&
        !line.toLowerCase().includes('best regards') &&
        !line.includes('turno.com') &&
        !line.includes('@') &&
        (line.includes('Anchorage') || line.includes(', AK') ||
         /^\d+\s+\w/.test(line) || /\d{4}\s+\w/.test(line))) {
      const hostIdx = line.indexOf('Host:')
      address = (hostIdx > -1 ? line.substring(0, hostIdx) : line).trim()
      if (!hostName && hostIdx > -1) {
        hostName = line.substring(hostIdx).replace(/Host:\s*/i, '').replace(/\*/g, '').trim()
      }
    }

    // Host on its own line
    if (!hostName && /^Host:\s*/i.test(line)) {
      hostName = line.replace(/^Host:\s*/i, '').replace(/\*/g, '').trim()
    }

    // Start Time
    if (!startTime) {
      const m = line.match(/Start\s*Time:\s*(.+)/i)
      if (m) {
        const d = parseAlaskaTime(m[1].trim())
        if (d) startTime = d.toISOString()
      }
    }

    // End Time
    if (!endTime) {
      const m = line.match(/End\s*Time:\s*(.+)/i)
      if (m) {
        const d = parseAlaskaTime(m[1].trim())
        if (d) endTime = d.toISOString()
      }
    }

    // Bedrooms — "Bedrooms: 4 Beds: 5" on same line
    if (bedrooms === null) {
      const m = line.match(/Bedroom[s]?:\s*(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }

    // Beds — "Beds: 5" but NOT "Bedrooms:" — negative lookbehind
    if (beds === null) {
      const m = line.match(/(?<![a-z])Beds:\s*(\d+)/i)
      if (m) beds = parseInt(m[1])
    }

    // Bathrooms — "Bathrooms: 2.5" on same or separate line
    if (bathrooms === null) {
      const m = line.match(/Bathroom[s]?:\s*(\d+\.?\d*)/i)
      if (m) bathrooms = parseFloat(m[1])
    }

    // Checklist
    if (!checklist) {
      const m = line.match(/^Checklist:\s*(.+)/i)
      if (m && !m[1].toLowerCase().includes('too many')) {
        checklist = m[1].trim()
      }
    }
  }

  if (!startTime) return null
  if (!address && !propertyLabel) return null

  const finalAddress = address || propertyLabel || 'Unknown'

  return {
    address: finalAddress,
    hostName: hostName || null,
    startTime,
    endTime,
    bedrooms,
    beds: beds ?? null,
    bathrooms,
    checklist,
    gmailMessageId: messageId,
    gmailAccountEmail: accountEmail,
  } as ParsedJob
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

  const queries = [
    'from:turno.com subject:"New Cleaning project available" "Start Time"',
    'subject:"Fwd: New Cleaning project available" "Start Time"',
    'subject:"FW: New Cleaning project available" "Start Time"',
  ]

  const allMessages: Array<{id: string}> = []
  for (const q of queries) {
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.job.create({
        data: { ...(jobData as any), gmailAccountId: accountId, gmailMessageId: msg.id },
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
