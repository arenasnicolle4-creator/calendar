// app/api/turno/test/route.ts — find assignment ID for a given project ID
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
      startTime: d.project?.start_time,
      endTime: d.project?.end_time,
      customer: d.customer_name,
      beds: d.project?.property?.beds,
      bedrooms: d.project?.property?.bedrooms,
      bathrooms: d.project?.property?.bathrooms,
    }
  } catch { return null }
}

// Known calibration: project 32026127 → assignment 18042718
//                   project 32532925 → assignment 18287601
const RATIO = (18287601 - 18042718) / (32532925 - 32026127) // 0.4832

async function findAssignment(targetProjectId: number, knownAssignId = 18042718, knownProjId = 32026127) {
  const estimate = Math.round(knownAssignId + (targetProjectId - knownProjId) * RATIO)
  
  // Probe in steps of 3000 across a ±20000 window
  const step = 3000
  const window = 20000
  const probes: number[] = []
  for (let offset = -window; offset <= window; offset += step) {
    probes.push(estimate + offset)
  }
  
  const results = await Promise.all(probes.map(fetchAssignment))
  const found = results.filter(Boolean)
  const exact = found.find(r => r!.projectId === targetProjectId)
  
  return { targetProjectId, estimate, exact, nearby: found.slice(0, 5) }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = parseInt(searchParams.get('projectId') || '32623827')
  const result = await findAssignment(projectId)
  return NextResponse.json(result)
}
