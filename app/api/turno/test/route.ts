// app/api/turno/test/route.ts — test Turno API endpoints
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
  return { status: res.status, parsed, raw: text.slice(0, 500) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || '32623827'
  const userId = searchParams.get('userId') || '483831'

  // Try multiple endpoint patterns to find assignment from project ID
  const results: Record<string, any> = {}

  // Test 1: project details endpoint
  results.project = await turnoFetch(`https://app.turno.com/contractor/projects/${projectId}`)
  
  // Test 2: assignments list for this project
  results.projectAssignments = await turnoFetch(`https://app.turno.com/contractor/projects/${projectId}/assignments`)

  // Test 3: user assignments filtered by project
  results.userAssignments = await turnoFetch(`https://app.turno.com/contractor/users/${userId}/assignments?project_id=${projectId}`)

  // Test 4: direct project-details deep link as API
  results.deepLink = await turnoFetch(`https://app.turno.com/api/contractor/project-details/${projectId}`)

  return NextResponse.json(results)
}
