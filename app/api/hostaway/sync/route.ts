// app/api/hostaway/sync/route.ts
import { NextResponse } from 'next/server'
import { syncAllHostawayCalendars } from '@/lib/hostawaySync'

export async function POST() {
  try {
    const results = await syncAllHostawayCalendars()
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const results = await syncAllHostawayCalendars()
    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
