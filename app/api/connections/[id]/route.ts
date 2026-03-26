// app/api/connections/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  if (!['active', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'Status must be active or declined' }, { status: 400 })
  }

  const connection = await prisma.connection.findUnique({ where: { id: params.id } })
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the invited provider can accept/decline
  if (connection.providerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.connection.update({
    where: { id: params.id },
    data: { status },
    include: {
      manager:  { select: { id: true, name: true, email: true, company: true } },
      provider: { select: { id: true, name: true, email: true, company: true } },
    },
  })

  // Notify the manager
  await prisma.notification.create({
    data: {
      userId: connection.managerId,
      type: 'connection_request',
      title: status === 'active' ? 'Connection accepted' : 'Connection declined',
      body: status === 'active'
        ? `${user.name} accepted your connection request`
        : `${user.name} declined your connection request`,
      linkUrl: '/dashboard/manager?tab=team',
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.connection.findUnique({ where: { id: params.id } })
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (connection.managerId !== user.id && connection.providerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.connection.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
