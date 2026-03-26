// app/api/properties/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role === 'manager') {
    // Manager sees their own properties
    const properties = await prisma.property.findMany({
      where: { managerId: user.id },
      include: { hostawayCalendars: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(properties)
  }

  if (user.role === 'cleaner' || user.role === 'provider') {
    // See properties from connected managers
    const connections = await prisma.connection.findMany({
      where: { providerId: user.id, status: 'active' },
      select: { managerId: true },
    })
    const managerIds = connections.map(c => c.managerId)
    const properties = await prisma.property.findMany({
      where: { managerId: { in: managerIds } },
      select: {
        id: true, name: true, address: true,
        platform: true, beds: true, baths: true,
        // Don't expose access codes/wifi to providers
        managerId: true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(properties)
  }

  return NextResponse.json([])
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Only managers can create properties' }, { status: 403 })
  }

  const data = await req.json()
  const { name, address, platform, beds, baths, sqft, notes, accessCode, wifiName, wifiPass } = data

  if (!name || !address) {
    return NextResponse.json({ error: 'Name and address are required' }, { status: 400 })
  }

  const property = await prisma.property.create({
    data: {
      managerId: user.id,
      name: name.trim(),
      address: address.trim(),
      platform: platform || 'manual',
      beds: beds ? parseInt(beds) : null,
      baths: baths ? parseFloat(baths) : null,
      sqft: sqft ? parseInt(sqft) : null,
      notes: notes || null,
      accessCode: accessCode || null,
      wifiName: wifiName || null,
      wifiPass: wifiPass || null,
    },
  })

  return NextResponse.json(property, { status: 201 })
}
