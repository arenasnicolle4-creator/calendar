// app/api/connections/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { managerId: user.id },
        { providerId: user.id },
      ],
    },
    include: {
      manager:  { select: { id: true, name: true, email: true, company: true, avatarUrl: true, role: true } },
      provider: { select: { id: true, name: true, email: true, company: true, avatarUrl: true, role: true, serviceCategory: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(connections)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { providerId, type } = await req.json()

  if (!providerId || !type) {
    return NextResponse.json({ error: 'providerId and type required' }, { status: 400 })
  }

  // Only managers can send invites
  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Only property managers can send invites' }, { status: 403 })
  }

  // Check target exists
  const target = await prisma.user.findUnique({ where: { id: providerId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check not already connected
  const existing = await prisma.connection.findUnique({
    where: { managerId_providerId: { managerId: user.id, providerId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Connection already exists', status: existing.status }, { status: 409 })
  }

  const connection = await prisma.connection.create({
    data: { managerId: user.id, providerId, type, status: 'pending' },
    include: {
      manager:  { select: { id: true, name: true, email: true, company: true } },
      provider: { select: { id: true, name: true, email: true, company: true } },
    },
  })

  // Create notification for the invited provider
  await prisma.notification.create({
    data: {
      userId: providerId,
      type: 'connection_request',
      title: 'New connection request',
      body: `${user.name}${user.company ? ` (${user.company})` : ''} wants to connect with you`,
      linkUrl: '/dashboard/cleaner?tab=connections',
    },
  })

  return NextResponse.json(connection, { status: 201 })
}
