// app/api/quotes/[id]/email/route.ts
// Sends a branded Cleaning Su Casa quote email to the client

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: { client: true },
    })
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const { client } = quote
    const clientName = `${client.firstName} ${client.lastName}`.trim()
    const isInstantBook = quote.submissionType === 'instant_book'

    // Build line items from priceBreakdown string
    // Format stored: "1,200 sq ft.......................... $89.00\nBedrooms.......................... $32.00"
    const lineItems = quote.priceBreakdown
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const parts = line.split('$')
        const label = parts[0].replace(/\.*$/, '').trim()
        const amount = parts[1] ? parseFloat(parts[1]) : 0
        return { label, amount }
      })
      .filter(l => l.label && l.amount > 0)

    // Calculate final price
    const instantBookSavings = isInstantBook ? quote.totalPrice * 0.10 : 0
    const finalPrice = isInstantBook ? quote.totalPrice * 0.90 : quote.totalPrice

    // Build HTML email
    const html = buildQuoteEmail({
      clientName,
      email: client.email,
      quoteId: quote.id.slice(-8).toUpperCase(),
      serviceType: quote.serviceType,
      frequency: quote.frequency,
      address: quote.address,
      lineItems,
      subtotal: quote.subtotal,
      discount: quote.discount,
      discountLabel: quote.discountLabel,
      instantBookSavings,
      finalPrice,
      isInstantBook,
      preferredDate1: quote.preferredDate1?.toISOString() || null,
      preferredDate2: quote.preferredDate2?.toISOString() || null,
      preferredTimes: quote.preferredTimes,
      addonsList: quote.addonsList,
      createdAt: quote.createdAt.toISOString(),
    })

    // Send via EmailJS REST API
    const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || 'service_8bkln92'
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_QUOTE_TEMPLATE_ID || 'template_ss9j71d'
    const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || 'ZsAm6x2gjm0hFV69o'
    const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || ''

    const payload = {
      service_id:  EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id:     EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_name:     clientName,
        to_email:    client.email,
        quote_id:    `#${quote.id.slice(-8).toUpperCase()}`,
        service_type: quote.serviceType,
        total_price:  `$${finalPrice.toFixed(2)}`,
        html_content: html,
        // keep these for backward compat with existing template
        first_name:  client.firstName,
        last_name:   client.lastName,
        email:       client.email,
        price_breakdown: quote.priceBreakdown,
        subtotal:    `$${quote.subtotal.toFixed(2)}`,
        discount:    quote.discount > 0 ? `-$${quote.discount.toFixed(2)}` : 'None',
        total_price_label: `$${finalPrice.toFixed(2)}`,
      },
    }

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('EmailJS error:', errText)
      // Still mark as sent in our DB — email may have gone through
    }

    // Mark quote as reviewed + email sent timestamp
    await prisma.quote.update({
      where: { id: params.id },
      data: { status: quote.status === 'pending' ? 'reviewed' : quote.status },
    })

    return NextResponse.json({ ok: true, emailSent: emailRes.ok, html })
  } catch (e) {
    console.error('Quote email error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── HTML EMAIL BUILDER ────────────────────────────────────────────────────────
function buildQuoteEmail({
  clientName, email, quoteId, serviceType, frequency, address,
  lineItems, subtotal, discount, discountLabel, instantBookSavings,
  finalPrice, isInstantBook, preferredDate1, preferredDate2,
  preferredTimes, addonsList, createdAt,
}: {
  clientName: string; email: string; quoteId: string; serviceType: string
  frequency: string; address: string
  lineItems: {label:string;amount:number}[]
  subtotal: number; discount: number; discountLabel: string
  instantBookSavings: number; finalPrice: number; isInstantBook: boolean
  preferredDate1: string|null; preferredDate2: string|null
  preferredTimes: string; addonsList: string; createdAt: string
}) {
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '—'
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`
  const quoteDate = new Date(createdAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })

  const freqLabel: Record<string,string> = {
    'every-week':    'Weekly',
    'bi-weekly':     'Bi-Weekly',
    'every-3-weeks': 'Every 3 Weeks',
    'every-4-weeks': 'Every 4 Weeks',
    'one-time':      'One-Time',
    '1-3':  '1–3 cleanings/month',
    '4-6':  '4–6 cleanings/month',
    '7-9':  '7–9 cleanings/month',
    '10+':  '10+ cleanings/month',
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Quote from Cleaning Su Casa</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, -apple-system, sans-serif; background: #f0f9ff; color: #0c4a6e; }
</style>
</head>
<body style="background:#f0f9ff;padding:0;margin:0;">
<div style="max-width:620px;margin:0 auto;padding:20px 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#020c1f 0%,#051e45 50%,#0c4a6e 100%);border-radius:20px 20px 0 0;padding:36px 36px 28px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(93,235,241,0.05);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-20px;left:-20px;width:120px;height:120px;border-radius:50%;background:rgba(14,165,233,0.08);pointer-events:none;"></div>
    <!-- Logo area -->
    <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(6,182,212,0.4);">
        <span style="font-size:24px;">🧹</span>
      </div>
      <div style="text-align:left;">
        <div style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">Cleaning Su Casa</div>
        <div style="font-size:11px;color:rgba(93,235,241,0.8);font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Professional Cleaning Services</div>
      </div>
    </div>
    <div style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(93,235,241,0.3);border-radius:30px;padding:6px 18px;margin-bottom:16px;">
      <span style="font-size:12px;font-weight:700;color:rgba(93,235,241,0.9);letter-spacing:1px;text-transform:uppercase;">${isInstantBook ? '⚡ Booking Confirmation' : '📋 Service Quote'}</span>
    </div>
    <div style="font-size:13px;color:rgba(255,255,255,0.6);font-weight:500;">Quote #${quoteId} · ${quoteDate}</div>
  </div>

  <!-- Main card -->
  <div style="background:#ffffff;border:1px solid rgba(14,165,233,0.15);padding:32px 36px;">

    <!-- Greeting -->
    <div style="margin-bottom:28px;">
      <p style="font-size:18px;font-weight:700;color:#0c4a6e;margin-bottom:8px;">Hello, ${clientName}!</p>
      <p style="font-size:14px;color:#0369a1;line-height:1.7;font-weight:500;">
        ${isInstantBook
          ? 'Thank you for booking with Cleaning Su Casa! Your booking is confirmed. Here are your booking details:'
          : 'Thank you for requesting a quote from Cleaning Su Casa! We\'ve put together this detailed quote based on your selections. Please review the details below.'}
      </p>
    </div>

    <!-- Service summary -->
    <div style="background:linear-gradient(135deg,rgba(14,165,233,0.07),rgba(6,182,212,0.04));border:1px solid rgba(14,165,233,0.2);border-radius:14px;padding:20px 22px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#0284c7;margin-bottom:14px;">Service Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Service Type</div>
          <div style="font-size:14px;font-weight:700;color:#0c4a6e;">${serviceType}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Frequency</div>
          <div style="font-size:14px;font-weight:700;color:#0c4a6e;">${freqLabel[frequency] || frequency}</div>
        </div>
        ${address ? `<div style="grid-column:1/-1;">
          <div style="font-size:10px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Service Address</div>
          <div style="font-size:13px;font-weight:600;color:#0c4a6e;">${address}</div>
        </div>` : ''}
      </div>
    </div>

    ${!isInstantBook && (preferredDate1 || preferredDate2) ? `
    <!-- Scheduling -->
    <div style="background:rgba(14,165,233,0.05);border:1px solid rgba(14,165,233,0.15);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#0284c7;margin-bottom:12px;">Requested Schedule</div>
      ${preferredDate1 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(14,165,233,0.12);font-size:13px;"><span style="color:#0369a1;font-weight:600;">First Choice</span><span style="color:#0c4a6e;font-weight:700;">${fmtDate(preferredDate1)}</span></div>` : ''}
      ${preferredDate2 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(14,165,233,0.12);font-size:13px;"><span style="color:#0369a1;font-weight:600;">Second Choice</span><span style="color:#0c4a6e;font-weight:700;">${fmtDate(preferredDate2)}</span></div>` : ''}
      ${preferredTimes ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#0369a1;font-weight:600;">Preferred Times</span><span style="color:#0c4a6e;font-weight:700;">${preferredTimes}</span></div>` : ''}
    </div>` : ''}

    <!-- Price breakdown -->
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#0284c7;margin-bottom:14px;">Price Breakdown</div>

      <!-- Line items -->
      <div style="border:1px solid rgba(14,165,233,0.15);border-radius:12px;overflow:hidden;">
        ${lineItems.map((item, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;${i < lineItems.length - 1 ? 'border-bottom:1px solid rgba(14,165,233,0.1);' : ''}background:${i % 2 === 0 ? '#ffffff' : 'rgba(14,165,233,0.02)'};">
          <span style="font-size:13px;font-weight:600;color:#0369a1;">${item.label}</span>
          <span style="font-size:14px;font-weight:800;color:#0c4a6e;">${fmtMoney(item.amount)}</span>
        </div>`).join('')}
      </div>

      <!-- Totals -->
      <div style="margin-top:12px;padding:16px 18px;background:rgba(14,165,233,0.04);border:1px solid rgba(14,165,233,0.15);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid rgba(14,165,233,0.1);">
          <span style="color:#0369a1;font-weight:600;">Subtotal</span>
          <span style="color:#0c4a6e;font-weight:700;">${fmtMoney(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(14,165,233,0.1);">
          <span style="color:#059669;font-weight:700;">✓ ${discountLabel}</span>
          <span style="color:#059669;font-weight:800;">-${fmtMoney(discount)}</span>
        </div>` : ''}
        ${instantBookSavings > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;border-bottom:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.06);border-radius:8px;margin:4px 0;">
          <span style="color:#059669;font-weight:700;">⚡ Instant Book (10% off)</span>
          <span style="color:#059669;font-weight:800;">-${fmtMoney(instantBookSavings)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px;border-top:2px solid rgba(14,165,233,0.25);margin-top:4px;">
          <span style="font-size:15px;font-weight:800;color:#0c4a6e;">Total Per Visit</span>
          <span style="font-size:22px;font-weight:900;color:${instantBookSavings > 0 ? '#059669' : '#0284c7'};">${fmtMoney(finalPrice)}</span>
        </div>
        ${discount > 0 || instantBookSavings > 0 ? `
        <div style="text-align:right;font-size:11px;color:#059669;font-weight:700;margin-top:2px;">
          You're saving ${fmtMoney(discount + instantBookSavings)} per visit!
        </div>` : ''}
      </div>
    </div>

    ${addonsList && addonsList !== 'None selected' ? `
    <!-- Add-ons -->
    <div style="background:rgba(14,165,233,0.04);border:1px solid rgba(14,165,233,0.12);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#0284c7;margin-bottom:10px;">Add-On Services</div>
      <div style="font-size:13px;color:#0369a1;font-weight:600;line-height:1.9;">${addonsList.split('\n').join('<br/>')}</div>
    </div>` : ''}

    <!-- Next steps -->
    <div style="background:linear-gradient(135deg,rgba(14,165,233,0.1),rgba(6,182,212,0.07));border:1px solid rgba(14,165,233,0.25);border-radius:14px;padding:20px 22px;margin-bottom:28px;">
      <div style="font-size:14px;font-weight:800;color:#0c4a6e;margin-bottom:10px;">${isInstantBook ? '✅ What Happens Next' : '📞 Next Steps'}</div>
      ${isInstantBook ? `
      <ul style="list-style:none;padding:0;margin:0;">
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">1.</span> We'll reach out to confirm your appointment details within 24 hours.</li>
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">2.</span> Our team will arrive ready to deliver a spotless clean.</li>
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">3.</span> Your 10% Instant Book discount applies to your first 5 cleanings.</li>
      </ul>` : `
      <ul style="list-style:none;padding:0;margin:0;">
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">1.</span> Review this quote and reply to this email with any questions.</li>
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">2.</span> We'll contact you at <strong>${email}</strong> to confirm a date and time.</li>
        <li style="font-size:13px;color:#0369a1;font-weight:600;padding:5px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#0ea5e9;font-weight:800;flex-shrink:0;">3.</span> This quote is valid for 30 days from the date issued.</li>
      </ul>`}
    </div>

    <!-- Satisfaction guarantee -->
    <div style="text-align:center;padding:20px;background:rgba(14,165,233,0.04);border-radius:12px;border:1px solid rgba(14,165,233,0.12);">
      <div style="font-size:32px;margin-bottom:8px;">🛡️</div>
      <div style="font-size:13px;font-weight:800;color:#0c4a6e;letter-spacing:0.3px;">100% SATISFACTION GUARANTEED</div>
      <div style="font-size:12px;color:#0369a1;font-weight:500;margin-top:4px;">If you're not happy, we'll make it right.</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:linear-gradient(135deg,#020c1f,#051e45);border-radius:0 0 20px 20px;padding:24px 36px;text-align:center;">
    <p style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:8px;">
      Questions? Email us at
      <a href="mailto:AkCleaningSuCasa@gmail.com" style="color:#06b6d4;font-weight:800;text-decoration:none;">AkCleaningSuCasa@gmail.com</a>
    </p>
    <p style="font-size:11px;color:rgba(255,255,255,0.35);font-weight:500;margin-bottom:0;">
      Cleaning Su Casa · Anchorage, Alaska<br/>
      Quote #${quoteId} · Valid for 30 days
    </p>
  </div>

</div>
</body>
</html>`
}
