// app/api/invoices/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { from: true, to: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(invoice)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await req.json()
    const update: Record<string, any> = {}

    if (data.status !== undefined) update.status = data.status
    if (data.amount !== undefined) update.amount = parseFloat(String(data.amount))
    if (data.tax !== undefined) update.tax = parseFloat(String(data.tax))
    if (data.lineItems !== undefined) update.lineItems = data.lineItems
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.paidAt !== undefined) update.paidAt = data.paidAt ? new Date(data.paidAt) : null
    if (data.notes !== undefined) update.notes = data.notes
    if (data.stripePaymentIntentId !== undefined) update.stripePaymentIntentId = data.stripePaymentIntentId

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: update,
    })
    return NextResponse.json(invoice)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.invoice.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
