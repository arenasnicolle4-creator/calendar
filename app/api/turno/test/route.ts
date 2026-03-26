// app/api/turno/test/route.ts — test Turno schedule and contractor-data endpoints
import { NextResponse } from 'next/server'

async function turnoFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json, */*',
      'Referer': 'https://app.turno.com/',
    },
  })
  const text = await res.text()
  let parsed = null
  try { parsed = JSON.parse(text) } catch {}
  return { status: res.status, parsed, raw: text.slice(0, 2000) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || '944608' // arenasnicolle user ID

  const results: Record<string, any> = {}

  // The schedule endpoint — this is the main one
  results.schedule = await turnoFetch(
    `https://app.turno.com/contractor/schedule?user_id=${userId}`
  )

  // Try with the other user ID (akcleaningsucasa)
  results.scheduleAlt = await turnoFetch(
    `https://app.turno.com/contractor/schedule?user_id=483831`
  )

  // Contractor data endpoint
  results.contractorData = await turnoFetch(
    `https://app.turno.com/contractor/instant-payouts/contractor-data`
  )

  // Try the schedule as a page with JSON accept
  results.scheduleView = await turnoFetch(
    `https://app.turno.com/view/contractor/schedule`
  )

  // Try schedule with no params
  results.schedulePlain = await turnoFetch(
    `https://app.turno.com/contractor/schedule`
  )

  return NextResponse.json(results)
}
