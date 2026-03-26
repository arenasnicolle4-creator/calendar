// lib/hostawaySync.ts — Hostaway iCal sync
import { prisma } from './prisma'

// iCal URLs stored as env vars:
// HOSTAWAY_ICAL_URLS = JSON array of {url, listingId, name} objects
// e.g. [{"url":"https://...203527.ics","listingId":"203527","name":"Listing 1"}]

interface HostawayCalendar {
  url: string
  listingId: string
  name: string
}

function getCalendars(): HostawayCalendar[] {
  try {
    const raw = process.env.HOSTAWAY_ICAL_URLS
    if (raw) return JSON.parse(raw)
  } catch {}
  // Fallback — hardcoded listing IDs, names set later
  return [
    { url: 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/203528.ics', listingId: '203528', name: 'Hostaway Listing 1' },
    { url: 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/203527.ics', listingId: '203527', name: 'Hostaway Listing 2' },
    { url: 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/204353.ics', listingId: '204353', name: 'Hostaway Listing 3' },
  ]
}

// Parse iCal (.ics) content into events
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
      if (current.uid && current.dtstart) {
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
        case 'DTSTART':
        case 'DTSTART': {
          current.dtstart = parseIcalDate(line)
          break
        }
        case 'DTEND': {
          current.dtend = parseIcalDate(line)
          break
        }
      }
    }
  }
  
  return events
}

function parseIcalDate(line: string): Date | null {
  // Handle: DTSTART;VALUE=DATE:20260328 or DTSTART:20260328T100000Z
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const value = line.substring(colonIdx + 1).trim()
  
  if (value.length === 8) {
    // DATE only: YYYYMMDD — treat as midnight Alaska time (UTC+8)
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8)
    return new Date(`${y}-${m}-${d}T00:00:00-08:00`)
  }
  if (value.endsWith('Z')) {
    // UTC datetime
    return new Date(value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'))
  }
  // Local datetime — assume Alaska (UTC-8)
  const m2 = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/)
  if (m2) {
    return new Date(`${m2[1]}-${m2[2]}-${m2[3]}T${m2[4]}:${m2[5]}:${m2[6]}-08:00`)
  }
  return null
}

function extractGuestInfo(summary: string | null, description: string | null): { guests: number | null, guestName: string | null } {
  let guests: number | null = null
  let guestName: string | null = null
  
  const text = `${summary || ''} ${description || ''}`
  
  // Guest count
  const gm = text.match(/(\d+)\s*guest/i)
  if (gm) guests = parseInt(gm[1])
  
  // Guest name — often in summary like "John Smith" or description
  const nm = text.match(/(?:guest|reserved for|booked by)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
  if (nm) guestName = nm[1]
  
  return { guests, guestName }
}

export async function syncHostawayCalendar(calendar: HostawayCalendar) {
  const { url, listingId, name } = calendar
  
  // Fetch iCal
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CleanSync/1.0' },
  })
  if (!res.ok) throw new Error(`Failed to fetch iCal for ${listingId}: ${res.status}`)
  
  const icsText = await res.text()
  const events = parseIcal(icsText)
  
  // Filter to future events only (within next 400 days)
  const now = new Date()
  const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)
  const relevant = events.filter(e => e.dtstart && e.dtstart > now && e.dtstart < future)
  
  // Get already-synced UIDs for this listing
  const existing = await prisma.job.findMany({
    where: { platform: 'hostaway', gmailMessageId: { startsWith: `hostaway-${listingId}-` } },
    select: { gmailMessageId: true },
  })
  const seenUids = new Set(existing.map(j => j.gmailMessageId))
  
  let imported = 0
  
  for (const event of relevant) {
    const syntheticId = `hostaway-${listingId}-${event.uid}`
    if (seenUids.has(syntheticId)) continue
    
    // Skip blocked dates (not actual bookings)
    const summary = event.summary || ''
    if (summary.toLowerCase().includes('not available') || 
        summary.toLowerCase().includes('blocked') ||
        summary.toLowerCase().includes('airbnb (not available)')) continue
    
    const { guests, guestName } = extractGuestInfo(event.summary, event.description)
    const address = event.location || name
    
    try {
      await prisma.job.create({
        data: {
          platform: 'hostaway',
          displayName: summary || name,
          customerName: guestName,
          address,
          propertyLabel: name,
          checkoutTime: event.dtstart!,
          checkinTime: event.dtend || null,
          nextGuests: null,
          nextGuestCount: guests,
          sqft: null,
          beds: null,
          baths: null,
          worth: null,
          notes: event.description || '',
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
  
  return { listingId, name, imported, total: relevant.length }
}

export async function syncAllHostawayCalendars() {
  const calendars = getCalendars()
  const results = []
  for (const cal of calendars) {
    try {
      const r = await syncHostawayCalendar(cal)
      results.push(r)
    } catch (e) {
      results.push({ listingId: cal.listingId, name: cal.name, error: String(e) })
    }
  }
  return results
}
