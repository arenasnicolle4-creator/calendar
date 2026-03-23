// app/api/cleaners/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_CLEANERS = [
  { name: 'Maria G.', color: '#e07b5a' },
  { name: 'James K.', color: '#5a8fd4' },
  { name: 'Sofia R.', color: '#6dbf82' },
  { name: 'Tyler M.', color: '#c97fd4' },
  { name: 'Aisha B.', color: '#d4a843' },
  { name: 'Carlos V.', color: '#5abfbf' },
]

export async function GET() {
  let cleaners = await prisma.cleaner.findMany({ orderBy: { createdAt: 'asc' } })
  // Seed defaults if empty
  if (cleaners.length === 0) {
    await prisma.cleaner.createMany({ data: DEFAULT_CLEANERS })
    cleaners = await prisma.cleaner.findMany({ orderBy: { createdAt: 'asc' } })
  }
  return NextResponse.json(cleaners)
}

export async function POST(req: Request) {
  const { name, color } = await req.json()
  const cleaner = await prisma.cleaner.create({ data: { name, color } })
  return NextResponse.json(cleaner)
}
