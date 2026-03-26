// app/api/hostaway/sync/route.ts
import { NextResponse } from 'next/server'
import { syncHostawayCalendar, syncAllHostawayCalendars } from '@/lib/hostawaySync'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  try {
    if (id) {
      const result = await syncHostawayCalendar(id)
      return NextResponse.json(result)
    }
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
