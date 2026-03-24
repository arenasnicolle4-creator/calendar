// app/api/jobber/sync/route.ts
import { NextResponse } from 'next/server'
import { syncJobberAccount, syncAllJobberAccounts } from '@/lib/jobberSync'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  try {
    if (id) {
      const result = await syncJobberAccount(id)
      console.log('Jobber sync result:', JSON.stringify(result))
      return NextResponse.json(result)
    }
    const results = await syncAllJobberAccounts()
    console.log('Jobber sync all results:', JSON.stringify(results))
    return NextResponse.json(results)
  } catch (e) {
    console.error('Jobber sync error:', String(e))
    return NextResponse.json({ error: String(e), imported: 0 }, { status: 500 })
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
