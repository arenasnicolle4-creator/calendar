// app/api/jobs/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({ orderBy: { checkoutTime: 'asc' } })
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const job = await prisma.job.create({ data })
    return NextResponse.json(job)
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
