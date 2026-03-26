// app/api/quote-clients/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clients = await prisma.quoteClient.findMany({
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(clients)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
