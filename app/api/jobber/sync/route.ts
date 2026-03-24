// app/api/jobber/sync/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncJobberAccount, syncAllJobberAccounts } from '@/lib/jobberSync'

// POST — sync one or all accounts
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  try {
    if (id) {
      const result = await syncJobberAccount(id, prisma)
      return NextResponse.json(result)
    }
    const results = await syncAllJobberAccounts(prisma)
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET — cron endpoint
export async function GET() {
  try {
    const results = await syncAllJobberAccounts(prisma)
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
