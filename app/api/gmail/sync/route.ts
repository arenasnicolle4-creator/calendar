// app/api/gmail/sync/route.ts
// Gmail OAuth is connected for future use (notifications, email parsing, etc.)
// No active sync logic at this time.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, message: 'Gmail sync not active', imported: 0 })
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Gmail sync not active', imported: 0 })
}
