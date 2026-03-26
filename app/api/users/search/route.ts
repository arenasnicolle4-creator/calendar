// app/api/users/search/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const role = searchParams.get('role') || undefined // 'cleaner' | 'provider'
  const category = searchParams.get('category') || undefined

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: user.id } }, // exclude self
        { isActive: true },
        role ? { role } : {},
        category ? { serviceCategory: category } : {},
        {
          OR: [
            { name:    { contains: q, mode: 'insensitive' } },
            { email:   { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true, name: true, email: true,
      role: true, company: true, phone: true,
      avatarUrl: true, serviceCategory: true, bio: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  })

  // Also return existing connection status for each result
  const connectionIds = users.map(u => u.id)
  const existingConnections = await prisma.connection.findMany({
    where: {
      OR: [
        { managerId: user.id, providerId: { in: connectionIds } },
        { providerId: user.id, managerId: { in: connectionIds } },
      ],
    },
    select: { managerId: true, providerId: true, status: true },
  })

  const connMap: Record<string, string> = {}
  for (const c of existingConnections) {
    const otherId = c.managerId === user.id ? c.providerId : c.managerId
    connMap[otherId] = c.status
  }

  const results = users.map(u => ({
    ...u,
    connectionStatus: connMap[u.id] || null,
  }))

  return NextResponse.json(results)
}
