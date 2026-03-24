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

    // Test events query — calendar events/blocked time
    const eventsData = await gql(accessToken, `query {
      events(first: 5) {
        nodes {
          id
          title
          startAt
          endAt
        }
        pageInfo { hasNextPage }
      }
    }`)

    // Test scheduledItems — the unified calendar feed
    const scheduledData = await gql(accessToken, `query {
      scheduledItems(first: 5) {
        nodes {
          ... on Visit {
            id
            title
            startAt
            endAt
            client { name }
          }
          ... on Event {
            id
            title
            startAt
            endAt
          }
        }
        pageInfo { hasNextPage }
      }
    }`)

    // Test visits
    const visitsData = await gql(accessToken, `query {
      visits(first: 3) {
        nodes { id title startAt endAt client { name } }
      }
    }`)

    // Test jobs
    const jobsData = await gql(accessToken, `query {
      jobs(first: 3) {
        nodes { id jobNumber title startAt endAt client { name } }
      }
    }`)

    return NextResponse.json({
      events: eventsData,
      scheduledItems: scheduledData,
      visits: visitsData,
      jobs: jobsData,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
