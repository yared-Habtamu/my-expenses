import { prisma } from '@/lib/prisma'

export const DEMO_USER_HANDLE = 'demo'
export const DEMO_USER_EMAIL = 'tewodros@example.com'
export const DEMO_USER_NAME = 'Tewodros Abebe'

export async function getDemoUser() {
  const existing = await prisma.user.findUnique({ where: { handle: DEMO_USER_HANDLE } })
  if (existing) return existing
  return prisma.user.create({
    data: { handle: DEMO_USER_HANDLE, name: DEMO_USER_NAME, email: DEMO_USER_EMAIL },
  })
}

export async function getAppSetting(userId: string) {
  return prisma.appSetting.upsert({
    where: { userId },
    update: {},
    create: { userId, smsListener: true },
  })
}

export interface Analytics {
  monthSpendCents: number
  monthIncomeCents: number
  monthCount: number
  month: string
  daily: { date: string; spend: number }[]
  categories: { tag: string; amount: number }[]
  providers: { provider: string; amount: number }[]
  accountTotals: { provider: string; balanceCents: number; count: number }[]
  totalBalanceCents: number
}

export async function buildAnalytics(userId: string): Promise<Analytics> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [transactions, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: monthStart, lt: nextMonth } },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.account.findMany({ where: { userId } }),
  ])

  const dailyMap = new Map<string, number>()
  const categoryMap = new Map<string, number>()
  const providerMap = new Map<string, number>()
  let monthSpendCents = 0
  let monthIncomeCents = 0

  for (const tx of transactions) {
    const day = tx.occurredAt.toISOString().slice(0, 10)
    if (tx.type === 'Credit') {
      monthIncomeCents += tx.amountCents
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amountCents)
    } else {
      monthSpendCents += tx.amountCents
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amountCents)
      categoryMap.set(tx.tag ?? 'Other', (categoryMap.get(tx.tag ?? 'Other') ?? 0) + tx.amountCents)
      providerMap.set(tx.provider, (providerMap.get(tx.provider) ?? 0) + tx.amountCents)
    }
  }

  return {
    monthSpendCents,
    monthIncomeCents,
    monthCount: transactions.length,
    month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    daily: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, spend]) => ({ date, spend })),
    categories: [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, amount]) => ({ tag, amount })),
    providers: [...providerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([provider, amount]) => ({ provider, amount })),
    accountTotals: accounts.map((a) => ({
      provider: a.provider,
      balanceCents: a.balanceCents,
      count: transactions.filter((t) => t.accountId === a.id && t.type === 'Debit').length,
    })),
    totalBalanceCents: accounts.reduce((sum, a) => sum + a.balanceCents, 0),
  }
}
