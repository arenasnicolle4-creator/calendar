// app/api/turno/test/route.ts — try user-based assignment listing
import { NextResponse } from 'next/server'

async function turnoFetch(url: string, cookie = '') {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, */*',
      'Referer': 'https://app.turno.com/',
      'X-Requested-With': 'XMLHttpRequest',
      ...(cookie ? { 'Cookie': cookie } : {}),
    },
  })
  const text = await res.text()
  let parsed = null
  try { parsed = JSON.parse(text) } catch {}
  return { status: res.status, url, parsed, raw: text.slice(0, 500) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cookie = searchParams.get('cookie') || ''
  // Your two user IDs from emails
  const userId1 = '944608'  // arenasnicolle4
  const userId2 = '483831'  // akcleaningsucasa

  const results: Record<string, any> = {}

  // Try listing upcoming assignments for your user
  results.upcoming1 = await turnoFetch(`https://app.turno.com/contractor/users/${userId1}/projects/upcoming`, cookie)
  results.upcoming2 = await turnoFetch(`https://app.turno.com/contractor/users/${userId2}/projects/upcoming`, cookie)
  results.schedule1 = await turnoFetch(`https://app.turno.com/contractor/users/${userId1}/schedule`, cookie)
  results.schedule2 = await turnoFetch(`https://app.turno.com/contractor/users/${userId2}/schedule`, cookie)
  results.assignments1 = await turnoFetch(`https://app.turno.com/contractor/users/${userId1}/assignments`, cookie)
  results.projects1 = await turnoFetch(`https://app.turno.com/contractor/users/${userId1}/projects`, cookie)

  return NextResponse.json(results)
}
