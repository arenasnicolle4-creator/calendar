import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const listing = searchParams.get('listing') || '204353'
  const urls: Record<string,string> = {
    '203527': 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/203527.ics',
    '203528': 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/203528.ics',
    '204353': 'https://platform.hostaway.com/ical/VZwCY0WDxrXlHxeeUE3Og6DfMXJSGadnryQtFm8d1TZ97YL9njlc7upP64Bszvp5/listings/204353.ics',
  }
  const url = urls[listing]
  if (!url) return NextResponse.json({ error: 'Unknown listing' })
  const res = await fetch(url, { headers: { 'User-Agent': 'CleanSync/1.0' } })
  const text = await res.text()
  return new Response(text, { headers: { 'Content-Type': 'text/plain' } })
}
