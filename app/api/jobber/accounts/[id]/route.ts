// app/api/jobber/accounts/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.job.updateMany({
    where: { jobberAccountId: params.id },
    data: { jobberAccountId: null },
  })
  await prisma.jobberAccount.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
