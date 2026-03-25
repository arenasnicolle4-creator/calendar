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

async function tryRefreshToken(accountId: string, refreshToken: string): Promise<string | null> {
  try {
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
    if (!res.ok) return null
    const tokens = await res.json()
    if (!tokens.access_token) return null
    // Save refreshed tokens
    await prisma.jobberAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + 55 * 60 * 1000),
      },
    })
    return tokens.access_token
  } catch {
    return null
  }
}

const VERSION = '2026-03-10'

async function jobberGQL(accessToken: string, query: string) {
  const res = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': VERSION,
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Jobber API error: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

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

function parseEventDescription(description: string | null) {
  if (!description) return { address: null, beds: null, baths: null }
  const parts = description.split('//').map(p => p.trim())
  const address = parts[0] || null
  const fullText = description.toLowerCase()
  const bedsMatch = fullText.match(/(\d+)\s*bed/)
  const bathsMatch = fullText.match(/(\d+\.?\d*)\s*bath/)
  return {
    address,
    beds: bedsMatch ? parseInt(bedsMatch[1]) : null,
    baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
  }
}

function scheduledItemToJob(item: any, jobberAccountId: string) {
  const type = item.__typename

  if (type === 'Event') {
    const { address, beds, baths } = parseEventDescription(item.description)
    // propertyLabel = title so calendar chips show the event name
    // address = parsed from description for the detail view
    const propertyLabel = item.title?.trim() || 'Jobber Event'
    return {
      platform: 'jobber' as const,
      displayName: item.title?.trim() || 'Jobber Event',
      customerName: null,
      address: address || item.title || 'Unknown',
      propertyLabel,
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null, nextGuestCount: null, sqft: null,
      beds, baths, worth: null,
      notes: item.description || '',
      cleanerIds: '[]', duties: '[]',
      gmailMessageId: null, gmailAccountId: null,
      jobberVisitId: item.id, jobberAccountId,
    }
  }

  if (type === 'Visit') {
    const addr = item.job?.property?.address
    const street = addr?.street || ''
    const city = addr?.city || 'Anchorage'
    const province = addr?.province || 'AK'
    const address = [street, city, province].filter(Boolean).join(', ') || 'Unknown Address'
    return {
      platform: 'jobber' as const,
      displayName: (item.job?.title || item.title || item.client?.name || `Job #${item.job?.jobNumber}` || 'Jobber Visit').trim(),
      customerName: item.client?.name || null,
      address,
      propertyLabel: street.trim() || item.client?.name || 'Jobber Visit',
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null, nextGuestCount: null, sqft: null,
      beds: null, baths: null, worth: null,
      notes: item.job?.jobNumber ? `Job #${item.job.jobNumber}` : '',
      cleanerIds: '[]', duties: '[]',
      gmailMessageId: null, gmailAccountId: null,
      jobberVisitId: item.id, jobberAccountId,
    }
  }

  if (type === 'Assessment') {
    const addr = item.property?.address
    const street = addr?.street || ''
    const city = addr?.city || 'Anchorage'
    return {
      platform: 'jobber' as const,
      displayName: item.title?.trim() || item.client?.name || 'Assessment',
      customerName: item.client?.name || null,
      address: [street, city].filter(Boolean).join(', ') || 'Unknown',
      propertyLabel: street || item.client?.name || 'Assessment',
      checkoutTime: new Date(item.startAt),
      checkinTime: item.endAt ? new Date(item.endAt) : null,
      nextGuests: null, nextGuestCount: null, sqft: null,
      beds: null, baths: null, worth: null,
      notes: '',
      cleanerIds: '[]', duties: '[]',
      gmailMessageId: null, gmailAccountId: null,
      jobberVisitId: item.id, jobberAccountId,
    }
  }

  return null
}

export async function syncJobberAccount(accountId: string) {
  const account = await prisma.jobberAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Jobber account not found')

  // Always try to refresh — Jobber tokens expire in 1 hour
  // Try refresh first, fall back to stored token if refresh fails
  let accessToken = account.accessToken
  const refreshed = await tryRefreshToken(accountId, account.refreshToken)
  if (refreshed) {
    accessToken = refreshed
    console.log('Jobber token refreshed successfully')
  } else {
    console.log('Token refresh failed, trying stored token')
    // Test the stored token
    const testRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': VERSION,
      },
      body: JSON.stringify({ query: '{ account { id } }' }),
    })
    const testJson = await testRes.json()
    if (testJson.message === 'Access token expired' || testJson.errors?.[0]?.message?.includes('expired')) {
      throw new Error('NEEDS_RECONNECT: Jobber token expired and refresh failed. Please reconnect Jobber in Integrations.')
    }
  }

  // Get already-synced IDs
  const existing = await prisma.job.findMany({
    where: { jobberAccountId: accountId, jobberVisitId: { not: null } },
    select: { jobberVisitId: true },
  })
  const seen = new Set(existing.map(j => j.jobberVisitId))

  const startAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const endAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString()

  let cursor: string | null = null
  let imported = 0
  let total = 0

  do {
    const query = scheduledItemsQuery(startAt, endAt, cursor || undefined)
    const data = await jobberGQL(accessToken, query)
    const { nodes, pageInfo } = data.scheduledItems

    for (const item of nodes) {
      total++
      if (seen.has(item.id)) continue
      if (!item.startAt) continue

      const jobData = scheduledItemToJob(item, accountId)
      if (!jobData) continue

      try {
        await prisma.job.create({ data: jobData })
        imported++
        seen.add(item.id)
      } catch (e) {
        console.error(`Jobber insert failed for ${item.id} (${item.__typename}):`, String(e).slice(0, 150))
      }
    }

    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
  } while (cursor)

  await prisma.jobberAccount.update({
    where: { id: accountId },
    data: { lastSynced: new Date() },
  })

  console.log(`Jobber sync complete: ${imported} imported of ${total} total`)
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
      console.error('Jobber account sync error:', String(e))
      results.push({ email: account.email, error: String(e), imported: 0, total: 0 })
    }
  }
  return results
}
