// lib/parseEmail.ts

export interface ParsedJob {
  address: string
  propertyName?: string | null  // from email subject: "New Cleaning project available at X"
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

// Parse plain text Turno emails (direct or forwarded)
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
    if (/^(Subject|Date|From|To):/i.test(line)) continue

    if (!address && !line.startsWith('Cleaning') &&
        (line.includes('Anchorage') || line.includes(', AK'))) {
      const hostIdx = line.indexOf('Host:')
      address = (hostIdx > -1 ? line.substring(0, hostIdx) : line).trim()
      if (!hostName && hostIdx > -1) {
        hostName = line.substring(hostIdx).replace(/Host:\s*/i, '').replace(/\*/g, '').trim()
      }
      continue
    }

    if (!hostName) {
      const hm = line.match(/^Host:\s*\*?(.+?)\*?\s*$/i)
      if (hm) { hostName = hm[1].trim(); continue }
    }

    if (!startTime) {
      const sm = line.match(/Start\s*Time:\s*(.+)/i)
      if (sm) {
        const d = parseAlaskaTime(sm[1].trim())
        if (d) startTime = d.toISOString()
        continue
      }
    }

    if (!endTime) {
      const em = line.match(/End\s*Time:\s*(.+)/i)
      if (em) {
        const d = parseAlaskaTime(em[1].trim())
        if (d) endTime = d.toISOString()
        continue
      }
    }

    if (bedrooms === null) {
      const m = line.match(/Bedrooms?:\s*(\d+)/i)
      if (m) bedrooms = parseInt(m[1])
    }

    // Beds: match " Beds: N" or "Beds: N" at start — NOT "Bedrooms:"
    if (beds === null) {
      const m = line.match(/(?:^|\s)Beds:\s*(\d+)/i)
      if (m) beds = parseInt(m[1])
    }

    if (bathrooms === null) {
      const m = line.match(/Bathrooms?:\s*(\d+\.?\d*)/i)
      if (m) bathrooms = parseFloat(m[1])
    }

    if (!checklist) {
      const cm = line.match(/^Checklist:\s*(.+)/i)
      if (cm && !cm[1].toLowerCase().includes('too many')) checklist = cm[1].trim()
    }
  }

  if (!address) return null

  return { address, hostName, startTime, endTime, bedrooms, beds, bathrooms, checklist, gmailMessageId: messageId, gmailAccountEmail: accountEmail }
}

// Alaska time parser
function parseAlaskaTime(dateStr: string): Date | null {
  if (!dateStr) return null
  const stripped = dateStr.trim().replace(/^[A-Za-z]+,?\s*/, '').trim()
  let d = new Date(stripped.replace(/(AM|PM)\s*$/i, '$1 -08:00'))
  if (!isNaN(d.getTime())) return d
  d = new Date(stripped.replace(/(AM|PM)\s*$/i, '$1 -09:00'))
  if (!isNaN(d.getTime())) return d
  d = new Date(stripped)
  if (!isNaN(d.getTime())) return d
  return null
}

const PROPERTY_SHORT_NAMES: Record<string, string> = {
  'WildAboutAnchorage | HotTub | Patio | ChefsKitchen': 'WildAboutAnchorage',
  'Meridian Suite at North Star Lodge • HotTub • View': 'Meridian Suite',
  'North Star Lodge - TOP TWO UNITS': 'North Star Lodge - Top Two Units',
  'North Star Lodge - ENTIRE HOUSE': 'North Star Lodge - Entire House',
  'Polaris Suite at North Star Lodge • Hot Tub • View': 'Polaris Suite',
}

function getDisplayName(propertyName: string | null | undefined, address: string): string {
  // Property name from subject line takes priority — it's the cleanest form
  if (propertyName) {
    // Check our known short name map
    if (PROPERTY_SHORT_NAMES[propertyName]) return PROPERTY_SHORT_NAMES[propertyName]
    // Use it as-is — it's already the clean name from the subject
    return propertyName
  }
  // Fall back to address street portion
  const clean = address
    .replace(/^Subject:\s*/i, '')
    .replace(/^New Cleaning project available at\s*/i, '')
    .trim()
  const commaIdx = clean.indexOf(',')
  if (commaIdx > -1 && (clean.includes('Anchorage') || clean.includes(' AK'))) {
    return clean.substring(0, commaIdx).trim()
  }
  return clean.split('|')[0].split('•')[0].trim()
}

export function jobFromParsed(parsed: ParsedJob): object | null {
  if (!parsed.startTime) return null
  const startTime = new Date(parsed.startTime)
  if (isNaN(startTime.getTime())) return null
  const endTime = parsed.endTime ? new Date(parsed.endTime) : new Date(startTime.getTime() + 3 * 3600000)

  const address = parsed.address
    .replace(/^Subject:\s*/i, '')
    .replace(/^New Cleaning project available at\s*/i, '')
    .trim()

  // Property label = property name from subject (cleanest) or street address
  const propertyLabel = parsed.propertyName ||
    (address.split(',')[0].trim())

  const displayName = getDisplayName(parsed.propertyName, address)

  return {
    platform: 'turno',
    displayName,
    customerName: parsed.hostName || 'Unknown Host',
    address,
    propertyLabel,
    checkoutTime: startTime,
    checkinTime: endTime,
    nextGuests: null,
    nextGuestCount: null,
    sqft: null,
    // beds = number of bedrooms (rooms), baths = bathrooms
    // Store bedrooms in displayName context, beds as actual bed count
    beds: parsed.bedrooms ?? null,      // bedrooms (rooms)
    baths: parsed.bathrooms ?? null,
    worth: null,
    notes: [
      parsed.checklist ? `Checklist: ${parsed.checklist}` : '',
      parsed.beds != null ? `Beds: ${parsed.beds}` : '',
    ].filter(Boolean).join('\n'),
    cleanerIds: '[]',
    duties: '[]',
    gmailMessageId: parsed.gmailMessageId || null,
  }
}
