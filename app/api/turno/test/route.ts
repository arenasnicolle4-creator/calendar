// app/api/turno/test/route.ts
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
  return { status: res.status, parsed, raw: text.slice(0, 1000) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || '483831'
  const projectId = searchParams.get('projectId') || '32623827'

  const results: Record<string, any> = {}

  // Try all plausible endpoints to find assignments by user or project
  results.userAssignments = await turnoFetch(
    `https://app.turno.com/contractor/users/${userId}/assignments`
  )
  results.userAssignmentsFiltered = await turnoFetch(
    `https://app.turno.com/contractor/users/${userId}/assignments?project_id=${projectId}`
  )
  results.contractorSchedule = await turnoFetch(
    `https://app.turno.com/contractor/schedule?user_id=${userId}`
  )
  results.projectLookup = await turnoFetch(
    `https://app.turno.com/contractor/projects/${projectId}?user_id=${userId}`
  )
  results.assignmentByProject = await turnoFetch(
    `https://app.turno.com/contractor/assignments?project_id=${projectId}&user_id=${userId}`
  )
  results.tIdLink = await turnoFetch(
    `https://app.turno.com/api/v1/contractor/projects/${projectId}?tUserId=${userId}&tId=KeWzf3cAo5LIthgO00483831`
  )

  return NextResponse.json(results)
}
