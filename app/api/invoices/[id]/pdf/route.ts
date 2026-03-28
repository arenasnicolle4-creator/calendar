// app/api/invoices/[id]/pdf/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { from: true, to: true },
    })
    if (!invoice) return new NextResponse('Invoice not found', { status: 404 })

    // Try to find the client from notes (we store clientId there)
    let clientName = 'Client'
    let clientEmail = ''
    let clientAddress = ''
    const clientIdMatch = invoice.notes?.match(/Client:\s*(\S+)/)
    const quoteMatch = invoice.notes?.match(/Quote\s*→\s*(.+)/)
    if (quoteMatch) {
      clientName = quoteMatch[1]
    }
    if (clientIdMatch) {
      const client = await prisma.quoteClient.findUnique({ where: { id: clientIdMatch[1] } })
      if (client) {
        clientName = `${client.firstName} ${client.lastName}`.trim()
        clientEmail = client.email
        clientAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(', ')
      }
    }

    let lineItems: { description: string; quantity: number; amount: number }[] = []
    try { lineItems = JSON.parse(invoice.lineItems) } catch {}

    const subtotal = lineItems.reduce((s, li) => s + (li.amount || 0) * (li.quantity || 1), 0)
    const statusLabel = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled' }[invoice.status] || invoice.status
    const statusColor = { draft: '#64748b', sent: '#d97706', paid: '#059669', overdue: '#dc2626', cancelled: '#6b7280' }[invoice.status] || '#64748b'

    const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
    const fmtMoney = (n: number) => `$${n.toFixed(2)}`

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Invoice #${invoice.id.slice(-6)} — Cleaning Su Casa</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; color: #1a1a2e; background: #fff; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none !important; }
    @page { margin: 0.6in; size: letter; }
  }
  .container { max-width: 680px; margin: 0 auto; padding: 48px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 22px; font-weight: 700; color: #0891b2; letter-spacing: -0.3px; }
  .brand-sub { font-size: 10px; color: #94a3b8; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }
  .inv-label { font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: right; letter-spacing: -0.5px; }
  .inv-num { font-size: 13px; color: #64748b; margin-top: 4px; text-align: right; }
  .status { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #fff; margin-top: 6px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 36px; }
  .meta-box h4 { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 8px; }
  .meta-box p { font-size: 13px; color: #334155; line-height: 1.6; }
  .meta-box .name { font-weight: 600; font-size: 14px; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; border-bottom: 2px solid #e2e8f0; text-align: left; }
  thead th:last-child, thead th:nth-child(2) { text-align: right; }
  tbody td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
  tbody td:last-child, tbody td:nth-child(2) { text-align: right; }
  .total-row { border-top: 2px solid #0891b2; }
  .total-row td { padding-top: 14px; font-weight: 700; font-size: 15px; color: #1a1a2e; }
  .total-row td:last-child { font-size: 20px; color: #0891b2; letter-spacing: -0.5px; }
  .tax-row td { color: #64748b; font-size: 12px; }
  .notes { padding: 14px 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; margin-bottom: 32px; line-height: 1.6; }
  .footer { text-align: center; padding-top: 32px; border-top: 1px solid #e2e8f0; }
  .footer p { font-size: 11px; color: #94a3b8; }
  .footer .company { font-weight: 600; color: #64748b; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #0891b2; color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(8,145,178,0.3); }
  .print-btn:hover { opacity: 0.9; }
</style>
</head><body>

<button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>

<div class="container">
  <div class="header">
    <div>
      <div class="brand">Cleaning Su Casa</div>
      <div class="brand-sub">Professional Cleaning Services</div>
    </div>
    <div>
      <div class="inv-label">Invoice</div>
      <div class="inv-num">#${invoice.id.slice(-6)}</div>
      <div style="text-align:right;margin-top:6px;">
        <span class="status" style="background:${statusColor}">${statusLabel}</span>
      </div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>Bill To</h4>
      <p class="name">${clientName}</p>
      ${clientEmail ? `<p>${clientEmail}</p>` : ''}
      ${clientAddress ? `<p>${clientAddress}</p>` : ''}
    </div>
    <div class="meta-box" style="text-align:right">
      <h4>Invoice Details</h4>
      <p><strong>Date:</strong> ${fmtDate(invoice.createdAt)}</p>
      ${invoice.dueDate ? `<p><strong>Due:</strong> ${fmtDate(invoice.dueDate)}</p>` : ''}
      ${invoice.paidAt ? `<p style="color:#059669"><strong>Paid:</strong> ${fmtDate(invoice.paidAt)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${lineItems.map(li => `
        <tr>
          <td>${li.description || '—'}</td>
          <td style="text-align:right">${li.quantity || 1}</td>
          <td>${fmtMoney((li.amount || 0) * (li.quantity || 1))}</td>
        </tr>
      `).join('')}
      ${invoice.tax > 0 ? `
        <tr class="tax-row">
          <td>Subtotal</td><td></td><td>${fmtMoney(subtotal)}</td>
        </tr>
        <tr class="tax-row">
          <td>Tax</td><td></td><td>${fmtMoney(invoice.tax)}</td>
        </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total</td><td></td><td>${fmtMoney(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ''}

  <div class="footer">
    <p class="company">Cleaning Su Casa</p>
    <p>Anchorage, Alaska · Professional Cleaning Services</p>
    <p style="margin-top:8px">Thank you for your business!</p>
  </div>
</div>

</body></html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (e) {
    console.error('Invoice PDF error:', e)
    return new NextResponse(String(e), { status: 500 })
  }
}
