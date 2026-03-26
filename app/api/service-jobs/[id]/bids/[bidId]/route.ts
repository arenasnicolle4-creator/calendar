// app/api/service-jobs/[id]/bids/[bidId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; bidId: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bid = await prisma.bid.findUnique({
    where: { id: params.bidId },
    include: { job: true },
  })
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

  const { status } = await req.json()

  // Manager accepts or rejects
  if (user.role === 'manager') {
    if (bid.job.postedById !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be accepted or rejected' }, { status: 400 })
    }

    const updated = await prisma.bid.update({
      where: { id: params.bidId },
      data: { status },
      include: { provider: { select: { id: true, name: true, email: true } } },
    })

    if (status === 'accepted') {
      // Award the job — update job, reject all other bids
      await prisma.serviceJob.update({
        where: { id: params.id },
        data: { status: 'awarded', assignedToId: bid.providerId },
      })

      await prisma.bid.updateMany({
        where: { jobId: params.id, id: { not: params.bidId } },
        data: { status: 'rejected' },
      })

      // Notify the winning provider
      await prisma.notification.create({
        data: {
          userId: bid.providerId,
          type: 'bid_accepted',
          title: 'Your bid was accepted!',
          body: `${user.name} accepted your bid of $${bid.amount.toFixed(2)} for "${bid.job.title}"`,
          linkUrl: '/dashboard/provider?tab=schedule',
        },
      })

      // Notify rejected providers
      const rejectedBids = await prisma.bid.findMany({
        where: { jobId: params.id, id: { not: params.bidId }, status: 'rejected' },
        select: { providerId: true },
      })
      if (rejectedBids.length > 0) {
        await prisma.notification.createMany({
          data: rejectedBids.map(b => ({
            userId: b.providerId,
            type: 'bid_rejected',
            title: 'Bid not selected',
            body: `Another provider was selected for "${bid.job.title}"`,
            linkUrl: '/dashboard/provider?tab=marketplace',
          })),
        })
      }
    } else {
      // Rejected — notify the provider
      await prisma.notification.create({
        data: {
          userId: bid.providerId,
          type: 'bid_rejected',
          title: 'Bid not selected',
          body: `Your bid for "${bid.job.title}" was not selected`,
          linkUrl: '/dashboard/provider?tab=marketplace',
        },
      })
    }

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; bidId: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bid = await prisma.bid.findUnique({ where: { id: params.bidId } })
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

  // Only the bidder can withdraw, and only if still pending
  if (bid.providerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (bid.status !== 'pending') {
    return NextResponse.json({ error: 'Cannot withdraw a bid that has already been decided' }, { status: 400 })
  }

  await prisma.bid.delete({ where: { id: params.bidId } })
  return NextResponse.json({ ok: true })
}
