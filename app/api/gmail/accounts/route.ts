// app/api/gmail/accounts/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGmailAuthUrl } from '@/lib/gmailSync'

export async function GET() {
  const accounts = await prisma.gmailAccount.findMany({
    select: { id: true, email: true, lastSynced: true, createdAt: true }
  })
  return NextResponse.json(accounts)
}

// Returns the Google OAuth URL to connect a new Gmail account
export async function POST() {
  const url = getGmailAuthUrl()
  return NextResponse.json({ url })
}
