// lib/parseEmail.ts

export interface ParsedJob {
  address: string
  hostName: string | null
  startTime: string | null
  endTime: string | null
  bedrooms: number | null
  beds: number | null
  bathrooms: number | null
  checklist: string | null
  gmailMessageId?: string
  gmailAccountEmail?: string
}

// Parse plain text Turno emails (noreply@turno.com format)
export function parseTurnoEmail(body: string, messageId?: string, accountEmail?: string): ParsedJob | null {
  if (!body.toLowerCase().includes('cleaning') && !body.toLowerCase().includes('turno')) return null

  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  let address: string | null = null
  let hostName: string | null = null
  let startTime: string | null = null
  let endTime: string | null = null
  let bedrooms: number | null = null
  let beds: number | null = null
  let bathrooms: number | null = null
  let checklist: string | null = null

  for (const line of lines) {
    const cleaningMatch = line.match(/^Cleaning\s+(.+)$/i)
    if (!address && cleaningMatch && !line.toLowerCase().includes('project')) {
      address = cleaningMatch[1].trim(); continue
    }
    const atMatch = line.match(/available at (.+)/i)
    if (!address && atMatch) { address = atMatch[1].replace(/\.$/, '').trim(); continue }

    const hm = line.match(/Host:\s*\*?(.+?)\*?\s*$/i)
    if (!hostName && hm) { hostName = hm[1].trim(); continue }

    const sm = line.match(/Start\s*Time:\s*(.+)/i)
    if (!startTime && sm) {
      const d = parseAlaskaTime(sm[1].trim())
      if (d) startTime = d.toISOString()
      continue
    }

    const em = line.match(/End\s*Time:\s*(.+)/i)
    if (!endTime && em) {
      const d = parseAlaskaTime(em[1].trim())
      if (d) endTime = d.toISOString()
      continue
    }

    const brm = line.match(/Bedroom[s]?:\s*(\d+)/i)
    if (bedrooms === null && brm) bedrooms = parseInt(brm[1])

    const bdsm = line.match(/Beds?:\s*(\d+)/i)
    if (beds === null && bdsm) beds = parseInt(bdsm[1])

    const bam = line.match(/Bathroom[s]?:\s*(\d+\.?\d*)/i)
    if (bathrooms === null && bam) bathrooms = parseFloat(bam[1])

    const cm = line.match(/^Checklist:\s*(.+)/i)
    if (!checklist && cm && !cm[1].toLowerCase().includes('too many')) checklist = cm[1].trim()
  }

  if (!address) return null

  return { address, hostName, startTime, endTime, bedrooms, beds, bathrooms, checklist, gmailMessageId: messageId, gmailAccountEmail: accountEmail }
}

// Parse Alaska time — Turno shows times in Alaska local time
function parseAlaskaTime(dateStr: string): Date | null {
  if (!dateStr) return null
  // Strip day name: "Mon, Jun 8 2026 11:00 AM" -> "Jun 8 2026 11:00 AM"
  const stripped = dateStr.replace(/^[A-Za-z]+,?\s*/, '').trim()
  // Try parsing with AKST offset (-09:00)
  const withOffset = stripped.replace(/(AM|PM)\s*$/i, '$1 -09:00')
  let d = new Date(withOffset)
  if (!isNaN(d.getTime())) return d
  // Fallback: parse without TZ then add 9 hours (AKST offset)
  d = new Date(stripped)
  if (!isNaN(d.getTime())) return new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return null
}

const PROPERTY_SHORT_NAMES: Record<string, string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star Lodge\nTop Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star Lodge\nEntire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function getShortName(label: string): string {
  if (PROPERTY_SHORT_NAMES[label]) return PROPERTY_SHORT_NAMES[label]
  // Strip "Subject: New Cleaning project available at " prefix if present
  let clean = label
    .replace(/^Subject:\s*/i, '')
    .replace(/^New Cleaning project available at\s*/i, '')
    .replace(/^Fwd?:\s*/i, '')
  // For addresses, use just the street portion before the city
  const commaIdx = clean.indexOf(',')
  if (commaIdx > -1 && clean.includes('Anchorage')) {
    clean = clean.substring(0, commaIdx).trim()
  }
  return clean.split('|')[0].split('•')[0].trim()
}

export function jobFromParsed(parsed: ParsedJob): object | null {
  if (!parsed.startTime) return null
  const startTime = new Date(parsed.startTime)
  if (isNaN(startTime.getTime())) return null
  const endTime = parsed.endTime ? new Date(parsed.endTime) : new Date(startTime.getTime() + 3 * 3600000)

  const address = parsed.address
  // Clean up address — strip any "Subject:" or forwarding artifacts
  const cleanAddress = address
    .replace(/^Subject:\s*/i, '')
    .replace(/^New Cleaning project available at\s*/i, '')
    .replace(/^Fwd?:\s*/i, '')
    .trim()
  // Use street portion as property label (consistent across all jobs at same address)
  const streetOnly = cleanAddress.split(',')[0].trim()
  const propertyLabel = streetOnly
  const displayName = getShortName(streetOnly)

  return {
    platform: 'turno',
    displayName,
    customerName: parsed.hostName || 'Unknown Host',
    address: cleanAddress,
    propertyLabel,
    checkoutTime: startTime,
    checkinTime: endTime,
    nextGuests: null,
    nextGuestCount: null,
    sqft: null,
    beds: parsed.bedrooms ?? parsed.beds ?? null,
    baths: parsed.bathrooms ?? null,
    worth: null,
    notes: parsed.checklist ? `Checklist: ${parsed.checklist}` : '',
    cleanerIds: '[]',
    duties: '[]',
    gmailMessageId: parsed.gmailMessageId || null,
  }
}
