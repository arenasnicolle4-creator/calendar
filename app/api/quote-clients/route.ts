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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, address, city, state, zip, notes } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if client already exists
    const existing = await prisma.quoteClient.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Client with this email already exists', id: existing.id }, { status: 409 })
    }

    const client = await prisma.quoteClient.create({
      data: {
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        address: address || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        notes: notes || null,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (e) {
    console.error('Client creation error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
