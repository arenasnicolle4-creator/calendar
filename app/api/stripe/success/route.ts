// app/api/stripe/success/route.ts
// Called by Stripe after successful payment
// Marks quote as paid, populates calendar with recurring dates, redirects to success page

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const quoteId   = searchParams.get('quote_id')

  try {
    if (!sessionId || !quoteId) throw new Error('Missing params')

    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cleansync-beryl.vercel.app'}/payment-failed?quote_id=${quoteId}`)
    }

    const meta = session.metadata || {}
    const bookingDate = meta.instantBookDate ? new Date(meta.instantBookDate + 'T12:00:00') : null
    const bookingTime = meta.instantBookTime || ''
    const frequency   = meta.frequency || 'one-time'

    // Update quote to paid + booked
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status:           'booked',
        instantBookDate:  bookingDate,
        instantBookTime:  bookingTime,
        notes: `Payment confirmed via Stripe. Session: ${sessionId}`,
      },
    })

    // Auto-populate calendar jobs for recurring bookings
    if (bookingDate && frequency !== 'one-time') {
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { client: true },
      })

      if (quote) {
        const intervalDays: Record<string,number> = {
          'every-week':    7,
          'bi-weekly':     14,
          'every-3-weeks': 21,
          'every-4-weeks': 28,
        }
        const interval = intervalDays[frequency]

        if (interval) {
          // Create 5 calendar jobs (first 5 bookings at instant book price)
          const jobsToCreate = []
          for (let i = 0; i < 5; i++) {
            const jobDate = new Date(bookingDate)
            jobDate.setDate(jobDate.getDate() + i * interval)

            // Parse time into hours/minutes
            const timeStr = bookingTime // e.g. "9:00 AM"
            const [timePart, ampm] = timeStr.split(' ')
            const [h, m] = timePart.split(':').map(Number)
            let hours = h
            if (ampm === 'PM' && hours !== 12) hours += 12
            if (ampm === 'AM' && hours === 12) hours = 0
            jobDate.setHours(hours, m || 0, 0, 0)

            // Checkin = checkout + 3 hours (default window)
            const checkinDate = new Date(jobDate.getTime() + 3 * 60 * 60 * 1000)

            jobsToCreate.push({
              platform:      'cleansync',
              displayName:   `${quote.serviceType} — ${quote.client.firstName} ${quote.client.lastName}`,
              customerName:  `${quote.client.firstName} ${quote.client.lastName}`,
              address:       quote.address,
              propertyLabel: quote.address || `${quote.client.firstName} ${quote.client.lastName}`,
              checkoutTime:  jobDate,
              checkinTime:   checkinDate,
              notes:         `Instant Book · Quote #${quoteId.slice(-8).toUpperCase()}${i === 0 ? '' : ` · Recurring ${frequency} (visit ${i+1} of 5)`}`,
              worth:         quote.totalPrice,
              cleanerIds:    '[]',
              duties:        '[]',
            })
          }

          await prisma.job.createMany({ data: jobsToCreate })
        }
      }
    } else if (bookingDate) {
      // One-time booking — create single job
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { client: true },
      })
      if (quote) {
        const [timePart, ampm] = bookingTime.split(' ')
        const [h, m] = (timePart || '9:0').split(':').map(Number)
        let hours = h
        if (ampm === 'PM' && hours !== 12) hours += 12
        if (ampm === 'AM' && hours === 12) hours = 0
        bookingDate.setHours(hours, m || 0, 0, 0)
        const checkin = new Date(bookingDate.getTime() + 3 * 60 * 60 * 1000)

        await prisma.job.create({
          data: {
            platform:      'cleansync',
            displayName:   `${quote.serviceType} — ${quote.client.firstName} ${quote.client.lastName}`,
            customerName:  `${quote.client.firstName} ${quote.client.lastName}`,
            address:       quote.address,
            propertyLabel: quote.address || `${quote.client.firstName} ${quote.client.lastName}`,
            checkoutTime:  bookingDate,
            checkinTime:   checkin,
            notes:         `Instant Book · One-Time · Quote #${quoteId.slice(-8).toUpperCase()}`,
            worth:         quote.totalPrice,
            cleanerIds:    '[]',
            duties:        '[]',
          },
        })
      }
    }

    // Redirect to a success page (or back to the booking form with success param)
    const FORM_URL = process.env.BOOKING_FORM_URL || 'https://csucasa.vercel.app'
    return NextResponse.redirect(`${FORM_URL}?booked=1&quote=${quoteId.slice(-8).toUpperCase()}`)
  } catch (e) {
    console.error('Stripe success handler error:', e)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cleansync-beryl.vercel.app'}/login`)
  }
}
