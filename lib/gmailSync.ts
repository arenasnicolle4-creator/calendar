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

// Parse Turno time string as Alaska time (AKST = UTC-9, AKDT = UTC-8)
// Turno emails show times in Alaska local time
function parseAlaskaTime(dateStr: string): Date | null {
  if (!dateStr) return null
  // Strip day name prefix e.g. "Mon, Jun 8 2026 11:00 AM" -> "Jun 8 2026 11:00 AM"
  const stripped = dateStr.replace(/^[A-Za-z]+,?\s*/, '').trim()
  // Parse as local time string, then apply Alaska offset
  // Alaska is UTC-9 standard, UTC-8 daylight
  // We'll use UTC-9 (AKST) as the conservative offset
  // Append -09:00 to force correct timezone interpretation
  const withTZ = stripped.replace(/\s*(AM|PM)\s*$/i, (m) => ` ${m.trim()} -09:00`)
  let d = new Date(withTZ)
  if (isNaN(d.getTime())) {
    // Try direct parse with offset appended differently
    d = new Date(`${stripped} UTC-9`)
  }
  if (isNaN(d.getTime())) {
    // Last resort: parse without timezone (will be UTC) and subtract 9 hours
    d = new Date(stripped)
    if (!isNaN(d.getTime())) {
      // Already parsed as UTC — but Turno shows local AK time
      // So "11:00 AM" parsed as UTC is wrong, it should be UTC+9 offset
      // Add 9 hours to compensate (making 11am AK = 8pm UTC)
      d = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    }
  }
  return isNaN(d.getTime()) ? null : d
}

function parseTurnoText(text: string, messageId: string, accountEmail: string): ParsedJob | null {
  if (!text) return null
  const lower = text.toLowerCase()
  if (!lower.includes('turno')) return null
  if (!lower.includes('start time')) return null

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find the block of lines that are inside the forwarded Turno message
  // Skip the forwarding header lines (From:, Date:, Subject:, To:)
  let inTurnoContent = false
  const turnoLines: string[] = []
  for (const line of lines) {
    if (line.includes('New Cleaning project available')) inTurnoContent = true
    if (inTurnoContent) turnoLines.push(line)
  }
  const parseLines = turnoLines.length > 0 ? turnoLines : lines

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
    // Property label — "Cleaning X" where X is NOT "project"
    if (!propertyLabel && /^Cleaning\s+\S/.test(line) && !line.toLowerCase().includes('project')) {
      propertyLabel = line.replace(/^Cleaning\s+/, '').trim()
    }

    // Address — contains Anchorage or AK street pattern, not a Cleaning/Start/End/Host line
    if (!address &&
        (line.includes('Anchorage') || line.includes(', AK') || /^\d+\s+\w+\s+(Dr|St|Ave|Rd|Blvd|Ln|Way|Ct|Pl|Cir)/i.test(line)) &&
        !line.startsWith('Cleaning') &&
        !line.toLowerCase().includes('start time') &&
        !line.toLowerCase().includes('end time') &&
        !line.toLowerCase().includes('too many') &&
        !line.toLowerCase().includes('bishop') &&
        !line.toLowerCase().includes('copyright') &&
        !line.includes('@')) {
      const hostIdx = line.indexOf('Host:')
      address = (hostIdx > -1 ? line.substring(0, hostIdx) : line).trim()
      if (!hostName && hostIdx > -1) {
        hostName = line.substring(hostIdx).replace(/Host:\s*/i, '').replace(/\*/g, '').trim()
      }
    }

    // Host on its own line — strip markdown bold asterisks Gmail adds
    if (!hostName) {
      const m = line.match(/^Host:\s*\*?(.+?)\*?\s*$/)
      if (m) hostName = m[1].trim()
    }

    // Start Time — "Start Time: Mon, Jun 8 2026 11:00 AM"
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

    // Bedrooms — "Bedrooms: 4 Beds: 5" all on one line
    if (bedrooms === null) {
      const m = line.match(/Bedroom[s]?:\s*(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }

    // Beds (number of actual beds, may differ from bedrooms)
    if (beds === null) {
      const m = line.match(/Beds?:\s*(\d+)/i)
      if (m) beds = parseInt(m[1])
    }

    // Bathrooms — may be on its own line "Bathrooms: 2.5"
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

  // Use address as the property label (cleaner and more consistent)
  const finalAddress = address || propertyLabel || 'Unknown'

  return {
    address: finalAddress,
    hostName: hostName || null,
    startTime,
    endTime,
    bedrooms,
    beds,
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

  // Search for direct AND forwarded Turno emails
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
