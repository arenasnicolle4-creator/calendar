// app/api/quotes/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json()
    const quote = await prisma.quote.update({
      where: { id: params.id },
      data: {
        status:    data.status    ?? undefined,
        cleanerId: data.cleanerId ?? undefined,
        notes:     data.notes     ?? undefined,
      },
    })
    return NextResponse.json(quote)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.quote.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
