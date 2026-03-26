// app/api/service-jobs/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // optional filter

  if (user.role === 'manager') {
    // Managers see their own posted jobs
    const jobs = await prisma.serviceJob.findMany({
      where: {
        postedById: user.id,
        ...(status ? { status } : {}),
      },
      include: {
        property: { select: { id: true, name: true, address: true } },
        bids: {
          include: {
            provider: { select: { id: true, name: true, email: true, company: true, serviceCategory: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        assignedTo: { select: { id: true, name: true, email: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(jobs)
  }

  if (user.role === 'provider') {
    // Providers see open jobs from managers they're connected to
    const connections = await prisma.connection.findMany({
      where: { providerId: user.id, status: 'active' },
      select: { managerId: true },
    })
    const managerIds = connections.map(c => c.managerId)

    if (managerIds.length === 0) return NextResponse.json([])

    const jobs = await prisma.serviceJob.findMany({
      where: {
        postedById: { in: managerIds },
        status: status || 'open',
      },
      include: {
        property: { select: { id: true, name: true, address: true } },
        postedBy: { select: { id: true, name: true, email: true, company: true } },
        // Only include the current provider's own bid
        bids: {
          where: { providerId: user.id },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(jobs)
  }

  return NextResponse.json([])
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Only managers can post jobs' }, { status: 403 })
  }

  const { propertyId, category, title, description, scheduledDate, budget, urgency } = await req.json()

  if (!propertyId || !category || !title || !description) {
    return NextResponse.json({ error: 'propertyId, category, title and description are required' }, { status: 400 })
  }

  // Verify property belongs to this manager
  const property = await prisma.property.findUnique({ where: { id: propertyId } })
  if (!property || property.managerId !== user.id) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  const job = await prisma.serviceJob.create({
    data: {
      propertyId,
      postedById: user.id,
      category,
      title: title.trim(),
      description: description.trim(),
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      budget: budget ? parseFloat(budget) : null,
      urgency: urgency || 'normal',
      status: 'open',
    },
    include: {
      property: { select: { id: true, name: true, address: true } },
    },
  })

  // Notify all connected providers of matching category
  const connections = await prisma.connection.findMany({
    where: {
      managerId: user.id,
      status: 'active',
    },
    include: {
      provider: { select: { id: true, serviceCategory: true, role: true } },
    },
  })

  const notifyProviders = connections
    .map(c => c.provider)
    .filter(p => p.role === 'provider' && (p.serviceCategory === category || category === 'other'))

  if (notifyProviders.length > 0) {
    await prisma.notification.createMany({
      data: notifyProviders.map(p => ({
        userId: p.id,
        type: 'job_posted',
        title: 'New job posted',
        body: `${user.name || user.company} posted a new ${category} job: "${title}"`,
        linkUrl: '/dashboard/provider?tab=marketplace',
      })),
    })
  }

  return NextResponse.json(job, { status: 201 })
}
