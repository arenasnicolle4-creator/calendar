// app/api/jobber/debug/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VERSION = '2026-03-10'

export async function GET() {
  try {
    const account = await prisma.jobberAccount.findFirst()
    if (!account) return NextResponse.json({ error: 'No Jobber account found' }, { status: 404 })

    // Try a basic GraphQL call
    const res = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': VERSION,
      },
      body: JSON.stringify({
        query: `query {
          scheduledItems(
            first: 5
            filter: { occursWithin: { startAt: "${new Date().toISOString()}", endAt: "${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}" } }
          ) {
            nodes {
              ... on Visit { __typename id title startAt endAt }
              ... on Event  { __typename id title startAt endAt }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`,
      }),
    })

    const scheduledData = await res.json()

    return NextResponse.json({
      storedExpiry: account.expiresAt,
      // FIX: expiresAt is nullable — guard before constructing Date
      tokenIsExpired: account.expiresAt ? new Date(account.expiresAt) < new Date() : null,
      scheduledItems: scheduledData,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
