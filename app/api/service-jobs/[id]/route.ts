// app/api/service-jobs/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: {
      property: { select: { id: true, name: true, address: true, beds: true, baths: true } },
      postedBy: { select: { id: true, name: true, email: true, company: true } },
      assignedTo: { select: { id: true, name: true, email: true, company: true } },
      bids: {
        include: {
          provider: { select: { id: true, name: true, email: true, company: true, serviceCategory: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access check — only poster or connected providers can view
  if (job.postedById !== user.id) {
    if (user.role === 'provider') {
      const conn = await prisma.connection.findUnique({
        where: { managerId_providerId: { managerId: job.postedById, providerId: user.id } },
      })
      if (!conn || conn.status !== 'active') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json(job)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.serviceJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.postedById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await req.json()
  const updated = await prisma.serviceJob.update({
    where: { id: params.id },
    data: {
      title:         data.title         ?? job.title,
      description:   data.description   ?? job.description,
      category:      data.category      ?? job.category,
      scheduledDate: data.scheduledDate !== undefined ? (data.scheduledDate ? new Date(data.scheduledDate) : null) : job.scheduledDate,
      budget:        data.budget        !== undefined ? (data.budget ? parseFloat(data.budget) : null) : job.budget,
      urgency:       data.urgency       ?? job.urgency,
      status:        data.status        ?? job.status,
      completedAt:   data.status === 'completed' ? new Date() : job.completedAt,
    },
    include: {
      property: { select: { id: true, name: true, address: true } },
      bids: { include: { provider: { select: { id: true, name: true, email: true, company: true } } } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.serviceJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.postedById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only allow deletion if not in progress or completed
  if (['in_progress', 'completed'].includes(job.status)) {
    return NextResponse.json({ error: 'Cannot delete a job that is in progress or completed' }, { status: 400 })
  }

  await prisma.serviceJob.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
