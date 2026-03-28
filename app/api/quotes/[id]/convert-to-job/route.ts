// app/api/quotes/[id]/convert-to-job/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: { client: true },
    })

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Build checkout time from preferred dates or default to now + 1 day
    let checkoutTime = new Date()
    checkoutTime.setDate(checkoutTime.getDate() + 1)
    checkoutTime.setHours(10, 0, 0, 0)

    if (quote.preferredDate1) {
      checkoutTime = new Date(quote.preferredDate1)
    } else if (quote.instantBookDate) {
      checkoutTime = new Date(quote.instantBookDate)
    }

    // Parse preferred times for a time hint
    if (quote.preferredTimes) {
      const timeMatch = quote.preferredTimes.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i)
      if (timeMatch) {
        let hour = parseInt(timeMatch[1])
        if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
        if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
        checkoutTime.setHours(hour, parseInt(timeMatch[2] || '0'), 0, 0)
      }
    }

    const clientName = `${quote.client.firstName} ${quote.client.lastName}`.trim()

    const job = await prisma.job.create({
      data: {
        platform: 'manual',
        displayName: `${quote.serviceType} — ${clientName}`,
        customerName: clientName,
        address: quote.address || [quote.client.address, quote.client.city, quote.client.state, quote.client.zip].filter(Boolean).join(', '),
        propertyLabel: quote.address?.split(',')[0] || clientName,
        checkoutTime,
        checkinTime: null,
        sqft: quote.sqftRange ? parseInt(quote.sqftRange.replace(/[^\d]/g, '')) || null : null,
        beds: quote.bedrooms,
        baths: quote.bathrooms,
        worth: quote.totalPrice,
        notes: [
          `Converted from quote #${quote.id.slice(-6)}`,
          quote.frequency !== 'One-Time' ? `Frequency: ${quote.frequency}` : '',
          quote.addonsList && quote.addonsList !== 'None selected' ? `Add-ons: ${quote.addonsList}` : '',
          quote.additionalNotes ? `Notes: ${quote.additionalNotes}` : '',
        ].filter(Boolean).join('\n'),
        cleanerIds: '[]',
        duties: '[]',
        assignedUserId: user.id,
      },
    })

    // Update quote status to completed if it was booked
    if (quote.status === 'booked') {
      await prisma.quote.update({
        where: { id: params.id },
        data: { status: 'completed' },
      })
    }

    return NextResponse.json({ ok: true, jobId: job.id, job })
  } catch (e) {
    console.error('Convert to job error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
