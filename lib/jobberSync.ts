// lib/jobberSync.ts — Jobber OAuth + GraphQL API sync
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

async function jobberGQL(accessToken: string, query: string, variables = {}) {
  const res = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Jobber API error: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

const VISITS_QUERY = `
  query CleanSyncVisits($cursor: String) {
    visits(first: 50, after: $cursor) {
      nodes {
        id
        title
        startAt
        endAt
        client { id name }
        job {
          id
          jobNumber
          title
          property {
            address { street city province postalCode }
          }
        }
        assignedUsers {
          nodes { id name { full } }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`

interface JobberVisit {
  id: string
  title: string | null
  startAt: string
  endAt: string | null
  client: { id: string; name: string } | null
  job: {
    id: string
    jobNumber: number
    title: string | null
    property: { address: { street: string | null; city: string | null; province: string | null; postalCode: string | null } | null } | null
  } | null
  assignedUsers: { nodes: { id: string; name: { full: string } }[] }
}

function visitToJob(visit: JobberVisit, jobberAccountId: string) {
  const addr = visit.job?.property?.address
  const street = addr?.street || ''
  const city = addr?.city || 'Anchorage'
  const province = addr?.province || 'AK'
  const address = [street, city, province].filter(Boolean).join(', ') || 'Unknown Address'
  const propertyLabel = street.trim() || visit.client?.name || 'Jobber Job'
  const displayName = visit.job?.title || visit.title || visit.client?.name || `Job #${visit.job?.jobNumber}`
  const assignedNames = visit.assignedUsers.nodes.map(u => u.name.full).join(', ')

  return {
    platform: 'jobber' as const,
    displayName: (displayName || 'Jobber Job').trim(),
    customerName: visit.client?.name || null,
    address,
    propertyLabel,
    checkoutTime: new Date(visit.startAt),
    checkinTime: visit.endAt ? new Date(visit.endAt) : null,
    nextGuests: null,
    nextGuestCount: null,
    sqft: null,
    beds: null,
    baths: null,
    worth: null,
    notes: assignedNames ? `Assigned: ${assignedNames}` : '',
    cleanerIds: '[]',
    duties: '[]',
    gmailMessageId: null,
    gmailAccountId: null,
    jobberVisitId: visit.id,
    jobberAccountId,
  }
}

export async function syncJobberAccount(accountId: string) {
  const account = await prisma.jobberAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Jobber account not found')

  let accessToken = account.accessToken

  // Refresh if expired
  if (new Date(account.expiresAt) < new Date()) {
    const tokens = await refreshJobberToken(account.refreshToken)
    accessToken = tokens.access_token
    const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600
    await prisma.jobberAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    })
  }

  // Get already-synced visit IDs
  const existing = await prisma.job.findMany({
    where: { jobberAccountId: accountId, jobberVisitId: { not: null } },
    select: { jobberVisitId: true },
  })
  const seen = new Set(existing.map(j => j.jobberVisitId))

  let cursor: string | null = null
  let imported = 0
  let total = 0

  do {
    const data = await jobberGQL(accessToken, VISITS_QUERY, cursor ? { cursor } : {})
    const { nodes, pageInfo } = data.visits

    for (const visit of nodes as JobberVisit[]) {
      total++
      if (seen.has(visit.id)) continue
      const jobData = visitToJob(visit, accountId)
      try {
        await prisma.job.create({ data: jobData })
        imported++
      } catch { /* skip duplicates */ }
    }

    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
  } while (cursor)

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
