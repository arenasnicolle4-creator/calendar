// app/api/properties/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const property = await prisma.property.findUnique({ where: { id: params.id } })
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (property.managerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await req.json()
  const updated = await prisma.property.update({
    where: { id: params.id },
    data: {
      name:       data.name       ?? property.name,
      address:    data.address    ?? property.address,
      platform:   data.platform   ?? property.platform,
      beds:       data.beds       !== undefined ? (data.beds ? parseInt(data.beds) : null) : property.beds,
      baths:      data.baths      !== undefined ? (data.baths ? parseFloat(data.baths) : null) : property.baths,
      sqft:       data.sqft       !== undefined ? (data.sqft ? parseInt(data.sqft) : null) : property.sqft,
      notes:      data.notes      !== undefined ? data.notes : property.notes,
      accessCode: data.accessCode !== undefined ? data.accessCode : property.accessCode,
      wifiName:   data.wifiName   !== undefined ? data.wifiName : property.wifiName,
      wifiPass:   data.wifiPass   !== undefined ? data.wifiPass : property.wifiPass,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const property = await prisma.property.findUnique({ where: { id: params.id } })
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (property.managerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.property.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
