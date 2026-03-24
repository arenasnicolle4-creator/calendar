// app/api/jobber/debug/route.ts
// Temporary debug endpoint — shows raw Jobber API response
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshJobberToken } from '@/lib/jobberSync'

export async function GET() {
  try {
    const accounts = await prisma.jobberAccount.findMany()
    if (!accounts.length) return NextResponse.json({ error: 'No Jobber accounts connected' })

    const account = accounts[0]
    let accessToken = account.accessToken

    // Refresh if expired
    if (new Date(account.expiresAt) < new Date()) {
      const tokens = await refreshJobberToken(account.refreshToken)
      accessToken = tokens.access_token
    }

    // Test 1: simple account query
    const accountRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
      },
      body: JSON.stringify({ query: `query { account { id name } }` }),
    })
    const accountData = await accountRes.json()

    // Test 2: visits query
    const visitsRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
      },
      body: JSON.stringify({
        query: `query {
          visits(first: 5) {
            nodes {
              id
              title
              startAt
              endAt
              client { name }
            }
            pageInfo { hasNextPage }
          }
        }`
      }),
    })
    const visitsData = await visitsRes.json()

    // Test 3: jobs query as fallback
    const jobsRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
      },
      body: JSON.stringify({
        query: `query {
          jobs(first: 5) {
            nodes {
              id
              jobNumber
              title
              startAt
              endAt
              client { name }
            }
          }
        }`
      }),
    })
    const jobsData = await jobsRes.json()

    return NextResponse.json({
      account: accountData,
      visits: visitsData,
      jobs: jobsData,
      tokenExpiry: account.expiresAt,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
