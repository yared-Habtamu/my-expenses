import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { tag?: string | null; merchant?: string; type?: string; amountCents?: number }

  const data: Record<string, string | number | null> = {}
  if ('tag' in body) data.tag = body.tag?.trim() || null
  if ('merchant' in body) data.merchant = body.merchant?.trim() || null
  if ('type' in body && (body.type === 'Credit' || body.type === 'Debit')) data.type = body.type
  if ('amountCents' in body) data.amountCents = Math.round(Number(body.amountCents))

  try {
    const transaction = await prisma.transaction.update({ where: { id }, data })
    return NextResponse.json({ transaction })
  } catch {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.transaction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }
}
