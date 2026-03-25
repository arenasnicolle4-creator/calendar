// app/api/turno/test/route.ts
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cookie = searchParams.get('cookie') || ''
  
  // Test the assignments endpoint directly with assignment ID from network tab
  const assignmentId = '18042718'
  const url = `https://app.turno.com/contractor/assignments/${assignmentId}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://app.turno.com/',
      },
      redirect: 'follow',
    })

    const contentType = res.headers.get('content-type') || ''
    const finalUrl = res.url
    const text = await res.text()
    
    let parsed = null
    try { parsed = JSON.parse(text) } catch {}

    return NextResponse.json({
      status: res.status,
      finalUrl,
      contentType,
      parsed,
      rawSlice: text.slice(0, 2000),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
