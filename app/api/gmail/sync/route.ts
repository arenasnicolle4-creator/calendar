// app/api/gmail/sync/route.ts
import { NextResponse } from 'next/server'
import { syncAllGmailAccounts } from '@/lib/gmailSync'

export async function POST() {
  const results = await syncAllGmailAccounts()
  return NextResponse.json(results)
}

export async function GET() {
  const results = await syncAllGmailAccounts()
  return NextResponse.json(results)
}
