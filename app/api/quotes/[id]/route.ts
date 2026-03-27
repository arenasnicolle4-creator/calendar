// app/api/quotes/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: { client: true },
    })
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(quote)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json()

    // Build update object — only include fields that were sent
    const update: Record<string, any> = {}

    // Status & assignment
    if (data.status !== undefined) update.status = data.status
    if (data.cleanerId !== undefined) update.cleanerId = data.cleanerId
    if (data.notes !== undefined) update.notes = data.notes

    // Pricing fields (editable line items)
    if (data.totalPrice !== undefined) update.totalPrice = parseFloat(data.totalPrice)
    if (data.subtotal !== undefined) update.subtotal = parseFloat(data.subtotal)
    if (data.discount !== undefined) update.discount = parseFloat(data.discount)
    if (data.discountLabel !== undefined) update.discountLabel = data.discountLabel
    if (data.instantBookSavings !== undefined) update.instantBookSavings = data.instantBookSavings === null ? null : parseFloat(data.instantBookSavings)
    if (data.priceBreakdown !== undefined) update.priceBreakdown = data.priceBreakdown

    // Service details
    if (data.serviceType !== undefined) update.serviceType = data.serviceType
    if (data.frequency !== undefined) update.frequency = data.frequency
    if (data.address !== undefined) update.address = data.address
    if (data.sqftRange !== undefined) update.sqftRange = data.sqftRange
    if (data.bedrooms !== undefined) update.bedrooms = data.bedrooms === null ? null : parseInt(data.bedrooms)
    if (data.bathrooms !== undefined) update.bathrooms = data.bathrooms === null ? null : parseFloat(data.bathrooms)
    if (data.airbnbSqft !== undefined) update.airbnbSqft = data.airbnbSqft
    if (data.airbnbBeds !== undefined) update.airbnbBeds = data.airbnbBeds === null ? null : parseInt(data.airbnbBeds)
    if (data.airbnbUnits !== undefined) update.airbnbUnits = data.airbnbUnits

    // Add-ons and notes
    if (data.addonsList !== undefined) update.addonsList = data.addonsList
    if (data.keyAreas !== undefined) update.keyAreas = data.keyAreas
    if (data.additionalNotes !== undefined) update.additionalNotes = data.additionalNotes

    // Scheduling
    if (data.preferredDate1 !== undefined) update.preferredDate1 = data.preferredDate1 ? new Date(data.preferredDate1) : null
    if (data.preferredDate2 !== undefined) update.preferredDate2 = data.preferredDate2 ? new Date(data.preferredDate2) : null
    if (data.preferredTimes !== undefined) update.preferredTimes = data.preferredTimes

    const quote = await prisma.quote.update({
      where: { id: params.id },
      data: update,
      include: { client: true },
    })
    return NextResponse.json(quote)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.quote.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
