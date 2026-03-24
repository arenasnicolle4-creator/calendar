// app/api/jobber/sync/route.ts
import { NextResponse } from 'next/server'
import { syncJobberAccount, syncAllJobberAccounts } from '@/lib/jobberSync'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  try {
    if (id) {
      const result = await syncJobberAccount(id)
      return NextResponse.json(result)
    }
    const results = await syncAllJobberAccounts()
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const results = await syncAllJobberAccounts()
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
