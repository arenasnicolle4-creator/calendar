// app/api/service-jobs/[id]/bids/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.serviceJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the job poster can see all bids
  if (job.postedById !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bids = await prisma.bid.findMany({
    where: { jobId: params.id },
    include: {
      provider: { select: { id: true, name: true, email: true, company: true, serviceCategory: true, bio: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(bids)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'provider') {
    return NextResponse.json({ error: 'Only providers can submit bids' }, { status: 403 })
  }

  const job = await prisma.serviceJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!['open', 'bidding'].includes(job.status)) {
    return NextResponse.json({ error: 'This job is no longer accepting bids' }, { status: 400 })
  }

  // Verify provider is connected to this manager
  const conn = await prisma.connection.findUnique({
    where: { managerId_providerId: { managerId: job.postedById, providerId: user.id } },
  })
  if (!conn || conn.status !== 'active') {
    return NextResponse.json({ error: 'You must be connected to this manager to bid' }, { status: 403 })
  }

  // Check for existing bid
  const existing = await prisma.bid.findUnique({
    where: { jobId_providerId: { jobId: params.id, providerId: user.id } },
  })
  if (existing) {
    return NextResponse.json({ error: 'You have already submitted a bid for this job' }, { status: 409 })
  }

  const { amount, notes, estimatedDays } = await req.json()
  if (!amount || isNaN(parseFloat(amount))) {
    return NextResponse.json({ error: 'A valid bid amount is required' }, { status: 400 })
  }

  const bid = await prisma.bid.create({
    data: {
      jobId: params.id,
      providerId: user.id,
      amount: parseFloat(amount),
      notes: notes?.trim() || null,
      estimatedDays: estimatedDays ? parseInt(estimatedDays) : null,
      status: 'pending',
    },
    include: {
      provider: { select: { id: true, name: true, email: true, company: true } },
    },
  })

  // Move job to bidding status if still open
  if (job.status === 'open') {
    await prisma.serviceJob.update({ where: { id: params.id }, data: { status: 'bidding' } })
  }

  // Notify the manager
  await prisma.notification.create({
    data: {
      userId: job.postedById,
      type: 'bid_received',
      title: 'New bid received',
      body: `${user.name} bid $${parseFloat(amount).toFixed(2)} on "${job.title}"`,
      linkUrl: `/dashboard/manager?tab=jobs`,
    },
  })

  return NextResponse.json(bid, { status: 201 })
}
