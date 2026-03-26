// lib/hostawaySync.ts — Hostaway iCal sync
import { prisma } from './prisma'

interface ICalEvent {
  uid: string
  summary: string | null
  dtstart: Date | null
  dtend: Date | null
  description: string | null
  location: string | null
}

function parseIcal(icsText: string): ICalEvent[] {
  const events: ICalEvent[] = []

  // Normalize line endings to \n, then unfold continued lines.
  // iCal spec: a line that starts with a space or tab is a continuation of the previous line.
  // We must handle BOTH \r\n and \n-only line endings before unfolding.
  const normalized = icsText
    .replace(/\r\n/g, '\n')   // normalize CRLF → LF
    .replace(/\r/g, '\n')     // normalize bare CR → LF
    .replace(/\n[ \t]/g, '')  // unfold: join continuation lines

  const lines = normalized.split('\n')
  let current: Partial<ICalEvent> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd() // keep leading content, trim trailing whitespace only
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      if (current.uid && (current.dtstart || current.dtend)) {
        events.push(current as ICalEvent)
      }
      current = null
    } else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      // Key may have parameters: e.g. DTSTART;TZID=America/Anchorage:20260401
      const key = line.substring(0, colonIdx).split(';')[0].toUpperCase()
      const value = line.substring(colonIdx + 1).trim()
      switch (key) {
        case 'UID':
          current.uid = value
          break
        case 'SUMMARY':
          current.summary = value
          break
        case 'DESCRIPTION':
          current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';')
          break
        case 'LOCATION':
          current.location = value.replace(/\\,/g, ',')
          break
        case 'DTSTART':
          current.dtstart = parseIcalDate(line)
          break
        case 'DTEND':
          current.dtend = parseIcalDate(line)
          break
      }
    }
  }
  return events
}

function parseIcalDate(line: string): Date | null {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const value = line.substring(colonIdx + 1).trim()

  // All-day date: YYYYMMDD — treat as Alaska midnight (AKST = -09:00, AKDT = -08:00)
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8)
    // Use -08:00 (AKDT) as the standard offset for this app
    return new Date(`${y}-${m}-${d}T00:00:00-08:00`)
  }

  // UTC datetime: YYYYMMDDTHHmmssZ
  if (value.endsWith('Z')) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
  }

  // Floating or TZID datetime: YYYYMMDDTHHmmss
  const m2 = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/)
  if (m2) return new Date(`${m2[1]}-${m2[2]}-${m2[3]}T${m2[4]}:${m2[5]}:${m2[6]}-08:00`)

  return null
}

function extractGuestInfo(summary: string | null, description: string | null) {
  const text = `${summary || ''} ${description || ''}`
  const gm = text.match(/(\d+)\s*guest/i)
  const nm = text.match(/(?:guest|reserved for|booked by)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
  return {
    guests: gm ? parseInt(gm[1]) : null,
    guestName: nm ? nm[1] : null,
  }
}

export async function syncHostawayCalendar(calendarId: string) {
  const calendar = await prisma.hostawayCalendar.findUnique({ where: { id: calendarId } })
  if (!calendar) throw new Error('Calendar not found')

  const res = await fetch(calendar.icalUrl, { headers: { 'User-Agent': 'CleanSync/1.0' } })
  if (!res.ok) throw new Error(`Failed to fetch iCal: ${res.status}`)

  const icsText = await res.text()
  const events = parseIcal(icsText)

  // Filter: checkout in the future (or today), skip year-long availability blocks
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)

  const relevant = events.filter(e => {
    if (!e.dtend) return false
    const duration = e.dtstart
      ? (e.dtend.getTime() - e.dtstart.getTime()) / (1000 * 60 * 60 * 24)
      : 0
    if (duration > 180) return false // skip availability closures
    return e.dtend >= todayStart && e.dtend < future
  })

  let imported = 0
  let updated = 0

  for (const event of relevant) {
    const syntheticId = `hostaway-${calendar.listingId}-${event.uid}`

    const summary = event.summary || ''
    const isBlocked =
      summary.toLowerCase().includes('blocked') || summary.trim() === ''
    const displaySummary = isBlocked
      ? `${calendar.name} — Clean`
      : summary.replace(/\s*-\s*by Hostaway$/i, '').trim()

    const { guests, guestName } = extractGuestInfo(event.summary, event.description)
    const address = event.location || calendar.name

    const guestCountMatch = event.description?.match(/Number of Guests:\s*(\d+)/i)
    const guestCount = guestCountMatch ? parseInt(guestCountMatch[1]) : guests

    const channelMatch = event.description?.match(/Channel:\s*(\w+)/i)
    const channel = channelMatch ? channelMatch[1] : null

    const jobData = {
      platform: 'hostaway' as const,
      displayName: displaySummary || calendar.name,
      customerName: guestName,
      address,
      propertyLabel: calendar.name,
      checkoutTime: event.dtend!,
      checkinTime: null,
      nextGuests: null,
      nextGuestCount: guestCount,
      sqft: null,
      beds: null,
      baths: null,
      worth: null,
      notes: channel
        ? `Channel: ${channel}${event.description ? '\n' + event.description : ''}`
        : (event.description || ''),
      cleanerIds: '[]',
      duties: '[]',
      gmailMessageId: syntheticId,
      gmailAccountId: null,
      jobberVisitId: null,
      jobberAccountId: null,
    }

    try {
      // upsert: update if syntheticId already exists, create if not
      // This prevents duplicates regardless of DB unique constraints
      const existing = await prisma.job.findFirst({
        where: { gmailMessageId: syntheticId },
        select: { id: true },
      })

      if (existing) {
        // Only update fields that come from the iCal (don't overwrite manual edits to cleanerIds/duties)
        await prisma.job.update({
          where: { id: existing.id },
          data: {
            displayName: jobData.displayName,
            customerName: jobData.customerName,
            address: jobData.address,
            propertyLabel: jobData.propertyLabel,
            checkoutTime: jobData.checkoutTime,
            nextGuestCount: jobData.nextGuestCount,
            notes: jobData.notes,
          },
        })
        updated++
      } else {
        await prisma.job.create({ data: jobData })
        imported++
      }
    } catch (e) {
      console.error(`Hostaway upsert failed for ${syntheticId}:`, String(e).slice(0, 200))
    }
  }

  await prisma.hostawayCalendar.update({
    where: { id: calendarId },
    data: { lastSynced: new Date() },
  })

  console.log(`Hostaway sync [${calendar.name}]: ${imported} new, ${updated} updated, ${relevant.length} total in iCal`)
  return {
    listingId: calendar.listingId,
    name: calendar.name,
    imported,
    updated,
    total: relevant.length,
  }
}

export async function syncAllHostawayCalendars() {
  const calendars = await prisma.hostawayCalendar.findMany()
  const results = []
  for (const cal of calendars) {
    try {
      const r = await syncHostawayCalendar(cal.id)
      results.push(r)
    } catch (e) {
      console.error(`Hostaway calendar error [${cal.name}]:`, String(e))
      results.push({ listingId: cal.listingId, name: cal.name, error: String(e), imported: 0, updated: 0 })
    }
  }
  return results
}
