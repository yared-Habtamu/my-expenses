import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { label?: string; balanceCents?: number; provider?: string }

  const data: Record<string, string | number> = {}
  if ('label' in body && body.label !== undefined) data.label = body.label.trim() || data.provider
  if ('provider' in body && body.provider !== undefined) data.provider = body.provider.trim()
  if ('balanceCents' in body) data.balanceCents = Math.round(Number(body.balanceCents))

  try {
    const account = await prisma.account.update({ where: { id }, data })
    return NextResponse.json({ account })
  } catch {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.account.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
}
