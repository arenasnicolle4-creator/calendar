// lib/jobberSync.ts — Jobber OAuth + GraphQL sync via scheduledItems
import { prisma } from './prisma'

export function getJobberAuthUrl(state = '') {
  const clientId = process.env.JOBBER_CLIENT_ID!
  const callback = `${process.env.NEXTAUTH_URL}/api/auth/jobber/callback`
  return `https://api.getjobber.com/api/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(callback)}&state=${state}`
}

export async function exchangeJobberCode(code: string) {
  const res = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/jobber/callback`,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Token exchange failed ${res.status}: ${txt}`)
  }
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>
}

export async function refreshJobberToken(refreshToken: string) {
  const res = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>
}

const VERSION = '2026-03-10'

async function jobberGQL(accessToken: string, query: string, variables = {}) {
  const res = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': VERSION,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Jobber API error: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

// Scheduled items query — covers Events, Visits, Assessments, Tasks
// Max 1.5 year range, paginated
function scheduledItemsQuery(startAt: string, endAt: string, cursor?: string) {
  return `query {
    scheduledItems(
      first: 50
      ${cursor ? `after: "${cursor}"` : ''}
      filter: {
        occursWithin: { startAt: "${startAt}", endAt: "${endAt}" }
      }
    ) {
      nodes {
        ... on Visit {
          __typename
          id
          title
          startAt
          endAt
          client { name }
          job {
            jobNumber
            title
            property { address { street city province } }
          }
        }
        ... on Event {
          __typename
          id
          title
          startAt
          endAt
          description
        }
        ... on Assessment {
          __typename
          id
          title
          startAt
          endAt
          client { name }
          property { address { street city province } }
        }
        ... on Task {
          __typename
          id
          title
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`
}

// Parse Event description like:
// "1711 Crescent Cir // 3 beds / 3 baths / 2500 sq.ft. // Code for all doors: 5834"
function parseEventDescription(description: string | null) {
  if (!description) return { address: null, beds: null, baths: null, notes: description }

  const parts = description.split('//').map(p => p.trim())
  const address = parts[0] || null

  let beds: number | null = null
  let baths: number | null = null

  const fullText = description.toLowerCase()

  const bedsMatch = fullText.match(/(\d+)\s*bed/)
  if (bedsMatch) beds = parseInt(bedsMatch[1])

  const bathsMatch = fullText.match(/(\d+\.?\d*)\s*bath/)
  if (bathsMatch) baths = parseFloat(bathsMatch[1])

  return { address, beds, baths, notes: description }
}

function scheduledItemToJob(item: any, jobberAccountId: string) {
  const type = item.__typename

  if (type === 'Event') {
    const { address, beds, baths, notes } = parseEventDescription(item.description)
    const street = address || item.title
    const propertyLabel = street?.split(',')[0]?.trim() || item.title

    return {
      platform: 'jobber' as const,
      displayName: item.title?.trim() || 'Jobber Event',
      customerName: null,
      address: address || item.title || 'Unknown',
      propertyLabel,
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null,
      nextGuestCount: null,
      sqft: null,
      beds,
      baths,
      worth: null,
      notes: notes || '',
      cleanerIds: '[]',
      duties: '[]',
      gmailMessageId: null,
      gmailAccountId: null,
      jobberVisitId: item.id,
      jobberAccountId,
    }
  }

  if (type === 'Visit') {
    const addr = item.job?.property?.address
    const street = addr?.street || ''
    const city = addr?.city || 'Anchorage'
    const province = addr?.province || 'AK'
    const address = [street, city, province].filter(Boolean).join(', ') || 'Unknown Address'
    const propertyLabel = street.trim() || item.client?.name || 'Jobber Visit'
    const displayName = item.job?.title || item.title || item.client?.name || `Job #${item.job?.jobNumber}`

    return {
      platform: 'jobber' as const,
      displayName: (displayName || 'Jobber Visit').trim(),
      customerName: item.client?.name || null,
      address,
      propertyLabel,
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null,
      nextGuestCount: null,
      sqft: null,
      beds: null,
      baths: null,
      worth: null,
      notes: item.job?.jobNumber ? `Job #${item.job.jobNumber}` : '',
      cleanerIds: '[]',
      duties: '[]',
      gmailMessageId: null,
      gmailAccountId: null,
      jobberVisitId: item.id,
      jobberAccountId,
    }
  }

  if (type === 'Assessment') {
    const addr = item.property?.address
    const street = addr?.street || ''
    const city = addr?.city || 'Anchorage'
    const address = [street, city].filter(Boolean).join(', ') || 'Unknown'

    return {
      platform: 'jobber' as const,
      displayName: item.title?.trim() || item.client?.name || 'Assessment',
      customerName: item.client?.name || null,
      address,
      propertyLabel: street || item.client?.name || 'Assessment',
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null,
      nextGuestCount: null,
      sqft: null,
      beds: null,
      baths: null,
      worth: null,
      notes: '',
      cleanerIds: '[]',
      duties: '[]',
      gmailMessageId: null,
      gmailAccountId: null,
      jobberVisitId: item.id,
      jobberAccountId,
    }
  }

  return null // Task — skip, no time data
}

export async function syncJobberAccount(accountId: string) {
  const account = await prisma.jobberAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Jobber account not found')

  let accessToken = account.accessToken

  // Refresh if expired
  if (new Date(account.expiresAt) < new Date()) {
    const tokens = await refreshJobberToken(account.refreshToken)
    accessToken = tokens.access_token
    await prisma.jobberAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + 55 * 60 * 1000),
      },
    })
  }

  // Get already-synced IDs
  const existing = await prisma.job.findMany({
    where: { jobberAccountId: accountId, jobberVisitId: { not: null } },
    select: { jobberVisitId: true },
  })
  const seen = new Set(existing.map(j => j.jobberVisitId))

  // Query in two windows — past 90 days and next ~14 months (under 1.5yr limit)
  const windows = [
    {
      startAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  let imported = 0
  let total = 0

  for (const window of windows) {
    let cursor: string | null = null

    do {
      const query = scheduledItemsQuery(window.startAt, window.endAt, cursor || undefined)
      const data = await jobberGQL(accessToken, query)
      const { nodes, pageInfo } = data.scheduledItems

      for (const item of nodes) {
        total++
        if (seen.has(item.id)) continue
        if (!item.startAt) continue // skip Tasks with no time

        const jobData = scheduledItemToJob(item, accountId)
        if (!jobData) continue

        try {
          await prisma.job.create({ data: jobData })
          imported++
          seen.add(item.id)
        } catch (e) {
          console.error(`Failed to create job for ${item.id}:`, String(e).slice(0, 200))
        }
      }

      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (cursor)
  }

  await prisma.jobberAccount.update({
    where: { id: accountId },
    data: { lastSynced: new Date() },
  })

  return { imported, total }
}

export async function syncAllJobberAccounts() {
  const accounts = await prisma.jobberAccount.findMany()
  const results = []
  for (const account of accounts) {
    try {
      const r = await syncJobberAccount(account.id)
      results.push({ companyName: account.companyName, email: account.email, ...r })
    } catch (e) {
      results.push({ email: account.email, error: String(e) })
    }
  }
  return results
}
