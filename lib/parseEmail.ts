// lib/parseEmail.ts
// Parses Turno notification emails into job objects

export interface ParsedJob {
  address: string
  hostName: string | null
  startTime: string | null
  endTime: string | null
  bedrooms: number | null
  bathrooms: number | null
  checklist: string | null
  gmailMessageId?: string
  gmailAccountEmail?: string
}

export function parseTurnoEmail(body: string, messageId?: string, accountEmail?: string): ParsedJob | null {
  // Must contain Turno cleaning project markers
  if (!body.toLowerCase().includes('cleaning') && !body.toLowerCase().includes('turno')) return null

  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Extract address - appears after "Cleaning" or in subject "at X"
  let address: string | null = null
  for (const line of lines) {
    const cleaningMatch = line.match(/^Cleaning\s+(.+)$/i)
    if (cleaningMatch) { address = cleaningMatch[1].trim(); break }
    const atMatch = line.match(/available at (.+)/i)
    if (atMatch) { address = atMatch[1].replace(/\.$/, '').trim(); break }
  }

  // Extract host
  let hostName: string | null = null
  for (const line of lines) {
    const m = line.match(/Host:\s*(.+)/i)
    if (m) { hostName = m[1].trim(); break }
  }

  // Extract start time
  let startTime: string | null = null
  for (const line of lines) {
    const m = line.match(/Start\s*Time:\s*(.+)/i)
    if (m) {
      const parsed = new Date(m[1].trim())
      if (!isNaN(parsed.getTime())) startTime = parsed.toISOString()
      break
    }
  }

  // Extract end time
  let endTime: string | null = null
  for (const line of lines) {
    const m = line.match(/End\s*Time:\s*(.+)/i)
    if (m) {
      const parsed = new Date(m[1].trim())
      if (!isNaN(parsed.getTime())) endTime = parsed.toISOString()
      break
    }
  }

  // Extract bedrooms
  let bedrooms: number | null = null
  for (const line of lines) {
    const m = line.match(/Bedroom[s]?:\s*(\d+)/i)
    if (m) { bedrooms = parseInt(m[1]); break }
  }

  // Extract bathrooms
  let bathrooms: number | null = null
  for (const line of lines) {
    const m = line.match(/Bathroom[s]?:\s*(\d+)/i)
    if (m) { bathrooms = parseInt(m[1]); break }
  }

  // Extract checklist
  let checklist: string | null = null
  for (const line of lines) {
    const m = line.match(/Checklist:\s*(.+)/i)
    if (m) { checklist = m[1].trim(); break }
  }

  if (!address) return null

  return {
    address,
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

const PROPERTY_SHORT_NAMES: Record<string, string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star Lodge - Top Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star Lodge - Entire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function getShortName(propertyLabel: string): string {
  if (PROPERTY_SHORT_NAMES[propertyLabel]) return PROPERTY_SHORT_NAMES[propertyLabel]
  return propertyLabel.split('|')[0].split('•')[0].trim()
}

export function jobFromParsed(parsed: ParsedJob) {
  const address = parsed.address
  const shortName = getShortName(address.split(',')[0].trim())
  const startTime = parsed.startTime ? new Date(parsed.startTime) : new Date()
  const endTime = parsed.endTime ? new Date(parsed.endTime) : new Date(startTime.getTime() + 3 * 3600000)

  return {
    platform: 'turno',
    displayName: shortName,
    customerName: parsed.hostName || 'Unknown Host',
    address,
    propertyLabel: address.split(',')[0].trim(),
    checkoutTime: startTime,
    checkinTime: endTime,
    nextGuests: null,
    nextGuestCount: null,
    sqft: null,
    beds: parsed.bedrooms,
    baths: parsed.bathrooms,
    worth: null,
    notes: parsed.checklist ? `Checklist: ${parsed.checklist}` : '',
    cleanerIds: '[]',
    duties: '[]',
    gmailMessageId: parsed.gmailMessageId || null,
  }
}
