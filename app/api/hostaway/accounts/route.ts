// app/api/hostaway/accounts/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const calendars = await prisma.hostawayCalendar.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(calendars)
}

export async function POST(req: Request) {
  const { listingId, name, icalUrl } = await req.json()
  if (!listingId || !name || !icalUrl) {
    return NextResponse.json({ error: 'listingId, name, and icalUrl required' }, { status: 400 })
  }
  try {
    const calendar = await prisma.hostawayCalendar.create({
      data: { listingId, name, icalUrl }
    })
    return NextResponse.json(calendar)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
