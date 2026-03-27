// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      quoteId,
      clientName,
      clientEmail,
      serviceType,
      frequency,
      address,
      finalPrice,       // post-discount, post-instant-book price
      instantBookDate,
      instantBookTime,
      originalPrice,    // pre-instant-book price (for display)
      savings,          // instant book savings amount
    } = body

    if (!quoteId || !clientEmail || !finalPrice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const freqLabel: Record<string,string> = {
      'every-week':    'Weekly',
      'bi-weekly':     'Bi-Weekly',
      'every-3-weeks': 'Every 3 Weeks',
      'every-4-weeks': 'Every 4 Weeks',
      'one-time':      'One-Time',
      '1-3': '1–3/month', '4-6': '4–6/month',
      '7-9': '7–9/month', '10+': '10+/month',
    }

    const dateDisplay = instantBookDate
      ? new Date(instantBookDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
      : ''

    const description = [
      serviceType,
      freqLabel[frequency] || frequency,
      address ? `· ${address}` : '',
      dateDisplay ? `· First clean: ${dateDisplay} @ ${instantBookTime}` : '',
    ].filter(Boolean).join(' ')

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: clientEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(finalPrice * 100), // Stripe uses cents
            product_data: {
              name: `${serviceType} — Instant Book`,
              description,
              images: [],
              metadata: { quoteId },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        quoteId,
        instantBookDate: instantBookDate || '',
        instantBookTime: instantBookTime || '',
        frequency,
        clientEmail,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cleansync-beryl.vercel.app'}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&quote_id=${quoteId}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL || 'https://cleansync-beryl.vercel.app'}/api/stripe/cancel?quote_id=${quoteId}`,
      payment_intent_data: {
        metadata: {
          quoteId,
          instantBookDate: instantBookDate || '',
          instantBookTime: instantBookTime || '',
          clientName: clientName || '',
          clientEmail,
        },
        description: `Cleaning Su Casa — ${serviceType} (Instant Book)`,
      },
      custom_text: {
        submit: {
          message: `⚡ You're locking in 10% off your first 5 cleanings. Saving $${savings?.toFixed(2) || '0'} per visit!`,
        },
      },
      allow_promotion_codes: false,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id }, { headers: CORS })
  } catch (e: any) {
    console.error('Stripe checkout error:', e)
    return NextResponse.json({ error: e.message || String(e) }, { status: 500, headers: CORS })
  }
}
