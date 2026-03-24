// app/api/jobber/debug/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshJobberToken } from '@/lib/jobberSync'

const VERSION = '2026-03-10'

async function gql(accessToken: string, query: string) {
  const res = await fetch('https://api.getjobber.com/api/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': VERSION,
    },
    body: JSON.stringify({ query }),
  })
  return res.json()
}

export async function GET() {
  try {
    const accounts = await prisma.jobberAccount.findMany()
    if (!accounts.length) return NextResponse.json({ error: 'No Jobber accounts connected' })

    const account = accounts[0]
    let accessToken = account.accessToken
    if (new Date(account.expiresAt) < new Date()) {
      const tokens = await refreshJobberToken(account.refreshToken)
      accessToken = tokens.access_token
    }

    const startAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const endAt = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString()

    const scheduledData = await gql(accessToken, `query {
      scheduledItems(
        first: 10
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
          }
          ... on Task {
            __typename
            id
            title
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`)

    return NextResponse.json({ scheduledItems: scheduledData })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
