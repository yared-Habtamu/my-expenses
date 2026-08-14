import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDemoUser } from '@/lib/data'

export async function GET(request: Request) {
  const user = await getDemoUser()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const provider = searchParams.get('provider')
  const tag = searchParams.get('tag')
  const search = searchParams.get('search')?.trim()
  const period = searchParams.get('period')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0)

  const now = new Date()
  const periodWhere =
    period === 'Day'
      ? { occurredAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }
      : period === 'Week'
        ? { occurredAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
        : period === 'Month'
          ? { occurredAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }
          : {}

  const where = {
    userId: user.id,
    ...periodWhere,
    ...(type && type !== 'All' ? { type } : {}),
    ...(provider && provider !== 'All' ? { provider } : {}),
    ...(tag && tag !== 'All' ? { tag } : {}),
    ...(search
      ? {
          OR: [
            { merchant: { contains: search, mode: 'insensitive' as const } },
            { tag: { contains: search, mode: 'insensitive' as const } },
            { referenceId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [transactions, total, tags, debitAgg, creditAgg] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], skip: offset, take: limit }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where: { userId: user.id, tag: { not: null } },
      select: { tag: true },
      distinct: ['tag'],
    }),
    prisma.transaction.aggregate({ where: { ...where, type: 'Debit' }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: 'Credit' }, _sum: { amountCents: true } }),
  ])

  const totalDebitCents = debitAgg._sum.amountCents ?? 0
  const totalCreditCents = creditAgg._sum.amountCents ?? 0

  return NextResponse.json({
    transactions,
    total,
    tags: tags.map((t) => t.tag).filter(Boolean),
    totalDebitCents,
    totalCreditCents,
  })
}

export async function POST(request: Request) {
  const user = await getDemoUser()
  const body = await request.json() as {
    provider?: string
    type?: string
    amountCents?: number
    merchant?: string
    tag?: string
    referenceId?: string
    occurredAt?: string
    accountId?: string
  }
  const provider = body.provider?.trim()
  const type = body.type === 'Credit' ? 'Credit' : 'Debit'
  const amountCents = Number(body.amountCents)
  if (!provider || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'provider and a positive amount are required' }, { status: 400 })
  }
  const transaction = await prisma.transaction.create({
    data: {
      provider,
      type,
      amountCents: Math.round(amountCents),
      merchant: body.merchant?.trim() || null,
      tag: body.tag?.trim() || null,
      referenceId: body.referenceId?.trim() || `MANUAL-${Date.now()}`,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      userId: user.id,
      accountId: body.accountId || null,
    },
  })
  return NextResponse.json({ transaction }, { status: 201 })
}
