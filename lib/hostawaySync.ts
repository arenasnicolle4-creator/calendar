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
  const lines = icsText.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n|\r/)
  let current: Partial<ICalEvent> | null = null

  for (const line of lines) {
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
      const key = line.substring(0, colonIdx).split(';')[0].toUpperCase()
      const value = line.substring(colonIdx + 1).trim()
      switch (key) {
        case 'UID': current.uid = value; break
        case 'SUMMARY': current.summary = value; break
        case 'DESCRIPTION': current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ','); break
        case 'LOCATION': current.location = value; break
        case 'DTSTART': current.dtstart = parseIcalDate(line); break
        case 'DTEND': current.dtend = parseIcalDate(line); break
      }
    }
  }
  return events
}

function parseIcalDate(line: string): Date | null {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const value = line.substring(colonIdx + 1).trim()
  if (value.length === 8) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8)
    return new Date(`${y}-${m}-${d}T00:00:00-08:00`)
  }
  if (value.endsWith('Z')) {
    return new Date(value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'))
  }
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

  // Filter: checkout in future, skip year-long blocks
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)

  const relevant = events.filter(e => {
    if (!e.dtend) return false
    const duration = e.dtstart ? (e.dtend.getTime() - e.dtstart.getTime()) / (1000 * 60 * 60 * 24) : 0
    if (duration > 180) return false // skip year+ blocks
    return e.dtend >= todayStart && e.dtend < future
  })

  // Get already-synced UIDs for this listing
  const existing = await prisma.job.findMany({
    where: { platform: 'hostaway', gmailMessageId: { startsWith: `hostaway-${calendar.listingId}-` } },
    select: { gmailMessageId: true },
  })
  const seenUids = new Set(existing.map(j => j.gmailMessageId))

  let imported = 0

  for (const event of relevant) {
    const syntheticId = `hostaway-${calendar.listingId}-${event.uid}`
    if (seenUids.has(syntheticId)) continue

    const summary = event.summary || ''
    const isBlocked = summary.toLowerCase().includes('blocked') || summary.trim() === ''
    const displaySummary = isBlocked ? `${calendar.name} — Clean` : summary.replace(/\s*-\s*by Hostaway$/i, '').trim()

    const { guests, guestName } = extractGuestInfo(event.summary, event.description)
    const address = event.location || calendar.name

    // Parse guest count from description
    const guestCountMatch = event.description?.match(/Number of Guests:\s*(\d+)/i)
    const guestCount = guestCountMatch ? parseInt(guestCountMatch[1]) : guests

    // Parse channel from description
    const channelMatch = event.description?.match(/Channel:\s*(\w+)/i)
    const channel = channelMatch ? channelMatch[1] : null

    try {
      await prisma.job.create({
        data: {
          platform: 'hostaway',
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
          notes: channel ? `Channel: ${channel}${event.description ? '\n' + event.description : ''}` : (event.description || ''),
          cleanerIds: '[]',
          duties: '[]',
          gmailMessageId: syntheticId,
          gmailAccountId: null,
          jobberVisitId: null,
          jobberAccountId: null,
        },
      })
      imported++
    } catch { /* skip duplicates */ }
  }

  await prisma.hostawayCalendar.update({
    where: { id: calendarId },
    data: { lastSynced: new Date() },
  })

  return { listingId: calendar.listingId, name: calendar.name, imported, total: relevant.length }
}

export async function syncAllHostawayCalendars() {
  const calendars = await prisma.hostawayCalendar.findMany()
  const results = []
  for (const cal of calendars) {
    try {
      const r = await syncHostawayCalendar(cal.id)
      results.push(r)
    } catch (e) {
      results.push({ listingId: cal.listingId, name: cal.name, error: String(e), imported: 0 })
    }
  }
  return results
}
