// app/api/invoices/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoices = await prisma.invoice.findMany({
      where: { fromId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { from: true, to: true },
    })
    return NextResponse.json(invoices)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { toClientId, amount, tax, lineItems, dueDate, notes, discount, discountType } = body

    if (amount == null && !lineItems) {
      return NextResponse.json({ error: 'Amount or line items required' }, { status: 400 })
    }

    // If toClientId is provided, we need to find or create a User for the invoice recipient
    // For now, the invoice toId can be the same as fromId (self) since QuoteClients aren't Users
    // In production you'd want a proper client→user mapping
    const invoice = await prisma.invoice.create({
      data: {
        fromId: user.id,
        toId: user.id, // TODO: map QuoteClient to User or create a lightweight recipient
        amount: parseFloat(String(amount || 0)),
        tax: parseFloat(String(tax || 0)),
        lineItems: lineItems || '[]',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || (toClientId ? `Client: ${toClientId}` : null),
        status: 'draft',
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e) {
    console.error('Invoice creation error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
