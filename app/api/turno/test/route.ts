// app/api/turno/test/route.ts — scan for assignments near known IDs
import { NextResponse } from 'next/server'

async function fetchAssignment(id: number) {
  const res = await fetch(`https://app.turno.com/contractor/assignments/${id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
      'Referer': 'https://app.turno.com/',
    },
  })
  if (!res.ok) return null
  try {
    const d = await res.json()
    if (!d?.project?.id) return null
    return {
      assignmentId: id,
      projectId: d.project.id,
      property: d.project?.property?.alias,
      address: d.project?.property?.short_address,
      date: d.project?.start_date,
      customer: d.customer_name,
    }
  } catch { return null }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') || 'scan'

  if (mode === 'scan') {
    // Scan outward from known assignment 18287601 in steps of 1000
    // to find other assignments belonging to this contractor
    const base = 18287601
    const probes: number[] = []
    for (let i = 1; i <= 20; i++) {
      probes.push(base + i * 1000)  // forward
      probes.push(base + i * 5000)  // further forward
    }
    const results = (await Promise.all(probes.map(fetchAssignment))).filter(Boolean)
    return NextResponse.json({ mode: 'scan', base, found: results })
  }

  if (mode === 'single') {
    const id = parseInt(searchParams.get('id') || '18287601')
    const result = await fetchAssignment(id)
    return NextResponse.json(result)
  }

  // mode === 'project' — scan for a specific project ID
  const targetProject = parseInt(searchParams.get('projectId') || '32623827')
  // Scan a wide range around both known assignments
  const probes: number[] = []
  for (let id = 18280000; id <= 18450000; id += 2000) {
    probes.push(id)
  }
  const results = (await Promise.all(probes.map(fetchAssignment))).filter(Boolean)
  const exact = results.find(r => r!.projectId === targetProject)
  return NextResponse.json({ targetProject, exact, allFound: results })
}
