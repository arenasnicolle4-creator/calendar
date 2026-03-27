// app/api/stripe/cancel/route.ts
// Called when user cancels Stripe checkout — marks quote back to pending

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const quoteId = searchParams.get('quote_id')

  if (quoteId) {
    try {
      // Reset to pending so cleaner can follow up
      await prisma.quote.update({
        where: { id: quoteId },
        data: { status: 'pending', notes: 'Payment cancelled by client.' },
      })
    } catch {}
  }

  const FORM_URL = process.env.BOOKING_FORM_URL || 'https://csucasa.vercel.app'
  return NextResponse.redirect(`${FORM_URL}?cancelled=1`)
}
