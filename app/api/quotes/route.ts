// app/api/quotes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { client: true },
    })
    return NextResponse.json(quotes, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      // Contact
      first_name, last_name, phone, email,
      // Address
      address, address2, city, state, zip,
      // Service
      service_type, frequency,
      // House
      sqft_range, bedrooms, house_bathrooms,
      // Airbnb
      airbnb_sqft, airbnb_laundry, airbnb_beds, airbnb_bathrooms, airbnb_units,
      // Add-ons
      addons_list,
      // Notes
      key_areas, additional_notes,
      preferred_date_1, preferred_date_2, preferred_times,
      // Pricing
      price_breakdown, subtotal, discount, discount_label, total_price,
      // Mode
      submission_type, // 'quote' | 'instant_book'
      instant_book_savings,
    } = body

    if (!email || !first_name || !total_price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert client by email
    let client = await prisma.quoteClient.findUnique({ where: { email } })
    if (!client) {
      client = await prisma.quoteClient.create({
        data: {
          email,
          firstName: first_name || '',
          lastName:  last_name  || '',
          phone:     phone      || '',
          address:   [address, address2].filter(Boolean).join(', ') || '',
          city:      city  || '',
          state:     state || '',
          zip:       zip   || '',
        },
      })
    }

    // Parse total amount
    const totalAmount = parseFloat(total_price?.replace('$', '') || '0')
    const subtotalAmount = parseFloat(subtotal?.replace('$', '') || '0')
    const discountAmount = parseFloat((discount || '0').replace(/[$-]/g, '') || '0')

    const isInstantBook = submission_type === 'instant_book'

    const quote = await prisma.quote.create({
      data: {
        clientId:       client.id,
        status:         isInstantBook ? 'booked' : 'pending',
        submissionType: submission_type || 'quote',
        serviceType:    service_type || '',
        frequency:      frequency    || '',
        address:        [address, address2, city, state, zip].filter(Boolean).join(', '),
        // House
        sqftRange:      sqft_range      || null,
        bedrooms:       bedrooms ? parseInt(bedrooms) : null,
        bathrooms:      house_bathrooms ? parseFloat(house_bathrooms) : (airbnb_bathrooms ? parseFloat(airbnb_bathrooms) : null),
        // Airbnb
        airbnbSqft:     airbnb_sqft     || null,
        airbnbLaundry:  airbnb_laundry  || null,
        airbnbBeds:     airbnb_beds     ? parseInt(airbnb_beds)  : null,
        airbnbUnits:    airbnb_units    || null,
        // Add-ons & notes
        addonsList:     addons_list     || '',
        keyAreas:       key_areas       || '',
        additionalNotes:additional_notes|| '',
        preferredDate1: preferred_date_1 && preferred_date_1 !== 'Not specified' ? new Date(preferred_date_1) : null,
        preferredDate2: preferred_date_2 && preferred_date_2 !== 'Not specified' ? new Date(preferred_date_2) : null,
        preferredTimes: preferred_times || '',
        // Pricing
        priceBreakdown: price_breakdown || '',
        subtotal:       subtotalAmount,
        discount:       discountAmount,
        discountLabel:  discount_label  || '',
        totalPrice:     totalAmount,
        instantBookSavings: instant_book_savings ? parseFloat(String(instant_book_savings)) : null,
      },
    })

    return NextResponse.json({ ok: true, quoteId: quote.id, clientId: client.id }, { status: 201, headers: CORS })
  } catch (e) {
    console.error('Quote creation error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
