// app/api/jobber/accounts/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getJobberAuthUrl } from '@/lib/jobberSync'

export async function GET() {
  const accounts = await prisma.jobberAccount.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, companyName: true, lastSynced: true },
  })
  return NextResponse.json(accounts)
}

export async function POST() {
  const url = getJobberAuthUrl('cleansync')
  return NextResponse.json({ url })
}
