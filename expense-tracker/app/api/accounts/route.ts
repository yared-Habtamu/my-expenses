import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDemoUser } from '@/lib/data'

export async function GET() {
  const user = await getDemoUser()
  const accounts = await prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ accounts })
}

export async function POST(request: Request) {
  const user = await getDemoUser()
  const body = await request.json() as { provider?: string; label?: string; balanceCents?: number; currency?: string }
  const provider = body.provider?.trim()
  const label = body.label?.trim()
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 })
  const account = await prisma.account.create({
    data: {
      provider,
      label: label || provider,
      balanceCents: Math.round(Number(body.balanceCents ?? 0)),
      currency: body.currency || 'ETB',
      userId: user.id,
    },
  })
  return NextResponse.json({ account }, { status: 201 })
}
