// app/api/invoices/[id]/payment-link/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }

    // Try to find client info from notes
    let clientEmail: string | undefined
    let clientName = 'Client'
    const clientIdMatch = invoice.notes?.match(/Client:\s*(\S+)/)
    const quoteMatch = invoice.notes?.match(/Quote\s*→\s*(.+)/)
    if (quoteMatch) clientName = quoteMatch[1]
    if (clientIdMatch) {
      const client = await prisma.quoteClient.findUnique({ where: { id: clientIdMatch[1] } })
      if (client) {
        clientName = `${client.firstName} ${client.lastName}`.trim()
        clientEmail = client.email || undefined
      }
    }

    // Parse line items for Stripe description
    let lineItems: { description: string; quantity: number; amount: number }[] = []
    try { lineItems = JSON.parse(invoice.lineItems) } catch {}

    const description = lineItems.length > 0
      ? lineItems.map(li => li.description).filter(Boolean).join(', ')
      : `Invoice #${invoice.id.slice(-6)}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cleansync-beryl.vercel.app'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: clientEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(invoice.amount * 100),
            product_data: {
              name: `Cleaning Su Casa — Invoice #${invoice.id.slice(-6)}`,
              description: description.slice(0, 500),
              metadata: { invoiceId: invoice.id },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        type: 'invoice_payment',
      },
      success_url: `${appUrl}/dashboard/cleaner?paid=${invoice.id}`,
      cancel_url: `${appUrl}/dashboard/cleaner?cancelled=${invoice.id}`,
      payment_intent_data: {
        metadata: {
          invoiceId: invoice.id,
          clientName,
        },
        description: `Cleaning Su Casa — Invoice #${invoice.id.slice(-6)}`,
      },
    })

    // Update invoice with the Stripe payment intent ID if available
    if (session.payment_intent) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripePaymentIntentId: session.payment_intent as string,
          status: invoice.status === 'draft' ? 'sent' : invoice.status,
        },
      })
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    })
  } catch (e: any) {
    console.error('Stripe payment link error:', e)
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
