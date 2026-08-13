import { prisma } from '@/lib/prisma'
import { getDemoUser } from '@/lib/data'
import { formatEtb } from '@/lib/format'
import { z } from 'zod'

const optional = {
  userId: z.string().optional(),
  month: z.string().optional(),
  limit: z.number().optional(),
  type: z.string().optional(),
  provider: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  offset: z.number().optional(),
}

export const TOOL_SCHEMAS: Record<string, z.ZodObject<any>> = {
  get_transactions: z.object({ userId: optional.userId, provider: optional.provider, type: optional.type, tag: optional.tag, search: optional.search, limit: optional.limit, offset: optional.offset }),
  get_account_balances: z.object({ userId: optional.userId }),
  get_spending_summary: z.object({ userId: optional.userId, month: optional.month }),
  get_spending_by_category: z.object({ userId: optional.userId, month: optional.month }),
  get_spending_trend: z.object({ userId: optional.userId, month: optional.month }),
  get_income_summary: z.object({ userId: optional.userId, month: optional.month }),
  get_top_merchants: z.object({ userId: optional.userId, month: optional.month, limit: optional.limit }),
  get_largest_transactions: z.object({ userId: optional.userId, type: optional.type, limit: optional.limit }),
  get_sms_logs: z.object({ userId: optional.userId, limit: optional.limit }),
  get_financial_projection: z.object({ userId: optional.userId }),
}

export interface McpTool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string }>
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_transactions',
    description: 'List transactions with optional filters by provider, type (Credit/Debit), tag, or free-text search.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      provider: { type: 'string', description: 'Filter by provider, e.g. CBE, Telebirr' },
      type: { type: 'string', description: 'Filter by type: Credit or Debit' },
      tag: { type: 'string', description: 'Filter by tag, e.g. Groceries, Transport' },
      search: { type: 'string', description: 'Free-text match on merchant, tag or reference' },
      limit: { type: 'number', description: 'Max results (default 20)' },
      offset: { type: 'number', description: 'Skip N results' },
    },
  },
  {
    name: 'get_account_balances',
    description: 'List all connected accounts with their current balances and currencies.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Aggregate spend, income, net flow, transaction count and top category for a month (defaults to current month).',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      month: { type: 'string', description: 'Month as YYYY-MM, e.g. 2026-08 (defaults to current month)' },
    },
  },
  {
    name: 'get_spending_by_category',
    description: 'Spend totals grouped by category/tag for a month, sorted from largest to smallest.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      month: { type: 'string', description: 'Month as YYYY-MM (defaults to current month)' },
    },
  },
  {
    name: 'get_spending_trend',
    description: 'Daily spend totals for a month, including average daily spend. Useful for spotting patterns, statistics, averages and spending habits over time.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      month: { type: 'string', description: 'Month as YYYY-MM (defaults to current month)' },
    },
  },
  {
    name: 'get_income_summary',
    description: 'Income/Credit totals for a month, including number of credits and their source providers.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      month: { type: 'string', description: 'Month as YYYY-MM (defaults to current month)' },
    },
  },
  {
    name: 'get_top_merchants',
    description: 'Most frequent or highest-spend merchants for a month.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      month: { type: 'string', description: 'Month as YYYY-MM (defaults to current month)' },
      limit: { type: 'number', description: 'Number of merchants to return (default 5)' },
    },
  },
  {
    name: 'get_largest_transactions',
    description: 'The largest transactions by amount, optionally filtered by type.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      type: { type: 'string', description: 'Credit or Debit (defaults to both)' },
      limit: { type: 'number', description: 'Number to return (default 5)' },
    },
  },
  {
    name: 'get_sms_logs',
    description: 'Recent SMS parsing activity, including whether each message was parsed into a transaction.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
      limit: { type: 'number', description: 'Number of logs to return (default 10)' },
    },
  },
  {
    name: 'get_financial_projection',
    description: 'Predict the user\'s financial status: projected month-end spend, income and net, projected balance, and how long the current balance will last (runway), based on recent spending and income trends.',
    parameters: {
      userId: { type: 'string', description: 'Optional user id (defaults to current user)' },
    },
  },
]

export interface McpResult {
  tool: string
  content: { type: 'text'; text: string }[]
  [key: string]: unknown
}

function monthRange(month?: string): { start: Date; end: Date; label: string } {
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth()
  if (month) {
    const [y, m] = month.split('-').map(Number)
    if (y && m >= 1 && m <= 12) {
      year = y
      monthIndex = m - 1
    }
  }
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 1)
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  return { start, end, label }
}

async function resolveUser(userId?: string): Promise<string> {
  if (userId) return userId
  const user = await getDemoUser()
  return user.id
}

function ok(tool: string, text: string, extra?: Record<string, unknown>): McpResult {
  return { tool, content: [{ type: 'text', text }], ...extra }
}

function err(tool: string, message: string): McpResult {
  return { tool, content: [{ type: 'text', text: `Error: ${message}` }], error: message }
}

export async function executeTool(tool: string, rawArgs: Record<string, unknown> = {}): Promise<McpResult> {
  const userId = await resolveUser(rawArgs.userId as string | undefined)

  switch (tool) {
    case 'list_tools':
      return ok('list_tools', MCP_TOOLS.map((t) => `${t.name}: ${t.description}`).join('\n'), { tools: MCP_TOOLS })

    case 'get_transactions': {
      const args = rawArgs as { provider?: string; type?: string; tag?: string; search?: string; limit?: number; offset?: number }
      const where: Record<string, unknown> = { userId }
      if (args.provider) where.provider = args.provider
      if (args.type) where.type = args.type
      if (args.tag) where.tag = args.tag
      if (args.search) {
        where.OR = [
          { merchant: { contains: args.search, mode: 'insensitive' } },
          { tag: { contains: args.search, mode: 'insensitive' } },
          { referenceId: { contains: args.search, mode: 'insensitive' } },
        ]
      }
      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: Math.min(args.limit ?? 20, 100),
        skip: Math.max(args.offset ?? 0, 0),
      })
      const total = await prisma.transaction.count({ where })
      const text = transactions.length === 0
        ? 'No transactions found.'
        : `${transactions.length} of ${total} transactions:\n` +
          transactions.map((t) => `${t.occurredAt.toISOString().slice(0, 10)} ${t.type} ${formatEtb(t.amountCents)} ${t.merchant ?? t.provider} ${t.tag ? `[${t.tag}]` : ''} (${t.referenceId})`).join('\n')
      return ok(tool, text, { transactions, total })
    }

    case 'get_account_balances': {
      const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
      const total = accounts.reduce((sum, a) => sum + a.balanceCents, 0)
      const text = accounts.length === 0
        ? 'No accounts connected.'
        : `${accounts.map((a) => `${a.label} (${a.provider}): ${formatEtb(a.balanceCents)}`).join('\n')}\nTotal: ${formatEtb(total)}`
      return ok(tool, text, { accounts, totalBalanceCents: total })
    }

    case 'get_spending_summary': {
      const { start, end, label } = monthRange(rawArgs.month as string | undefined)
      const [transactions, accounts] = await Promise.all([
        prisma.transaction.findMany({ where: { userId, occurredAt: { gte: start, lt: end } } }),
        prisma.account.findMany({ where: { userId } }),
      ])
      let spend = 0
      let income = 0
      const categoryMap = new Map<string, number>()
      for (const t of transactions) {
        if (t.type === 'Credit') income += t.amountCents
        else {
          spend += t.amountCents
          categoryMap.set(t.tag ?? 'Other', (categoryMap.get(t.tag ?? 'Other') ?? 0) + t.amountCents)
        }
      }
      const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0]
      const totalBalance = accounts.reduce((sum, a) => sum + a.balanceCents, 0)
      const text = `${label}: Spend ${formatEtb(spend)} | Income ${formatEtb(income)} | Net ${income - spend >= 0 ? '+' : '-'}${formatEtb(Math.abs(income - spend))} | ${transactions.length} transactions` +
        `${topCategory ? ` | Top category ${topCategory[0]} (${formatEtb(topCategory[1])})` : ''} | Total balance ${formatEtb(totalBalance)}`
      return ok(tool, text, { month: label, spendCents: spend, incomeCents: income, netCents: income - spend, transactionCount: transactions.length, totalBalanceCents: totalBalance })
    }

    case 'get_spending_by_category': {
      const { start, end, label } = monthRange(rawArgs.month as string | undefined)
      const transactions = await prisma.transaction.findMany({ where: { userId, type: 'Debit', occurredAt: { gte: start, lt: end } } })
      const categoryMap = new Map<string, number>()
      let spend = 0
      for (const t of transactions) {
        spend += t.amountCents
        categoryMap.set(t.tag ?? 'Other', (categoryMap.get(t.tag ?? 'Other') ?? 0) + t.amountCents)
      }
      const categories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]).map(([tag, amount]) => ({ tag, amountCents: amount }))
      const text = categories.length === 0
        ? `No spending recorded in ${label}.`
        : `${label} spend ${formatEtb(spend)}:\n${categories.map((c) => `${c.tag}: ${formatEtb(c.amountCents)} (${((c.amountCents / spend) * 100).toFixed(1)}%)`).join('\n')}`
      return ok(tool, text, { month: label, spendCents: spend, categories })
    }

    case 'get_spending_trend': {
      const { start, end, label } = monthRange(rawArgs.month as string | undefined)
      const transactions = await prisma.transaction.findMany({ where: { userId, type: 'Debit', occurredAt: { gte: start, lt: end } }, orderBy: { occurredAt: 'asc' } })
      const dailyMap = new Map<string, number>()
      for (const t of transactions) {
        const day = t.occurredAt.toISOString().slice(0, 10)
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + t.amountCents)
      }
      const daily = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amountCents]) => ({ date, amountCents }))
      const daysWithSpending = daily.length
      const avgDaily = daysWithSpending > 0 ? daily.reduce((s, d) => s + d.amountCents, 0) / daysWithSpending : 0
      const text = daily.length === 0
        ? `No spending recorded in ${label}.`
        : `${label} daily spending (avg ${formatEtb(Math.round(avgDaily))}/day across ${daysWithSpending} days):\n${daily.map((d) => `${d.date}: ${formatEtb(d.amountCents)}`).join('\n')}`
      return ok(tool, text, { month: label, daily, averageDailyCents: Math.round(avgDaily) })
    }

    case 'get_income_summary': {
      const { start, end, label } = monthRange(rawArgs.month as string | undefined)
      const credits = await prisma.transaction.findMany({ where: { userId, type: 'Credit', occurredAt: { gte: start, lt: end } } })
      const income = credits.reduce((sum, t) => sum + t.amountCents, 0)
      const providerMap = new Map<string, number>()
      for (const t of credits) providerMap.set(t.provider, (providerMap.get(t.provider) ?? 0) + t.amountCents)
      const text = credits.length === 0
        ? `No income recorded in ${label}.`
        : `${label} income: ${formatEtb(income)} from ${credits.length} credit${credits.length === 1 ? '' : 's'}.\n` +
          [...providerMap.entries()].map(([p, amt]) => `${p}: ${formatEtb(amt)}`).join('\n')
      return ok(tool, text, { month: label, incomeCents: income, credits })
    }

    case 'get_top_merchants': {
      const { start, end, label } = monthRange(rawArgs.month as string | undefined)
      const limit = Math.min(rawArgs.limit as number ?? 5, 20)
      const transactions = await prisma.transaction.findMany({ where: { userId, type: 'Debit', occurredAt: { gte: start, lt: end } } })
      const merchantMap = new Map<string, { count: number; amountCents: number }>()
      for (const t of transactions) {
        const key = t.merchant ?? t.provider
        const entry = merchantMap.get(key) ?? { count: 0, amountCents: 0 }
        entry.count += 1
        entry.amountCents += t.amountCents
        merchantMap.set(key, entry)
      }
      const bySpend = [...merchantMap.entries()].sort((a, b) => b[1].amountCents - a[1].amountCents).slice(0, limit)
      const byFrequency = [...merchantMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit)
      const text = bySpend.length === 0
        ? `No merchant spending in ${label}.`
        : `${label} top merchants by spend:\n${bySpend.map(([m, v]) => `${m}: ${formatEtb(v.amountCents)} (${v.count}x)`).join('\n')}`
      return ok(tool, text, { month: label, bySpend, byFrequency })
    }

    case 'get_largest_transactions': {
      const limit = Math.min(rawArgs.limit as number ?? 5, 50)
      const type = rawArgs.type as string | undefined
      const transactions = await prisma.transaction.findMany({
        where: { userId, ...(type === 'Credit' || type === 'Debit' ? { type } : {}) },
        orderBy: { amountCents: 'desc' },
        take: limit,
      })
      const text = transactions.length === 0
        ? 'No transactions found.'
        : `Largest transactions:\n${transactions.map((t) => `${t.type} ${formatEtb(t.amountCents)} ${t.merchant ?? t.provider} (${t.occurredAt.toISOString().slice(0, 10)})`).join('\n')}`
      return ok(tool, text, { transactions })
    }

    case 'get_sms_logs': {
      const limit = Math.min(rawArgs.limit as number ?? 10, 50)
      const logs = await prisma.smsLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
      const text = logs.length === 0
        ? 'No SMS logs yet.'
        : `Recent SMS activity:\n${logs.map((l) => `${l.createdAt.toISOString().slice(0, 10)} ${l.provider}: ${l.parsed ? 'parsed' : 'not parsed'} — ${l.payload.slice(0, 80)}`).join('\n')}`
      return ok(tool, text, { logs })
    }

    case 'get_financial_projection': {
      const now = new Date()
      const year = now.getFullYear()
      const monthIndex = now.getMonth()
      const dayOfMonth = now.getDate()
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
      const daysRemaining = daysInMonth - dayOfMonth
      const monthStart = new Date(year, monthIndex, 1)
      const nextMonthStart = new Date(year, monthIndex + 1, 1)
      const windowStart = new Date(year, monthIndex, Math.max(dayOfMonth, 1))
      windowStart.setDate(dayOfMonth - 29)

      const [accounts, monthTxs, rollingTxs] = await Promise.all([
        prisma.account.findMany({ where: { userId } }),
        prisma.transaction.findMany({ where: { userId, occurredAt: { gte: monthStart, lt: nextMonthStart } } }),
        prisma.transaction.findMany({ where: { userId, occurredAt: { gte: windowStart, lt: now } } }),
      ])

      const totalBalance = accounts.reduce((sum, a) => sum + a.balanceCents, 0)

      let monthSpend = 0
      let monthIncome = 0
      for (const t of monthTxs) {
        if (t.type === 'Credit') monthIncome += t.amountCents
        else monthSpend += t.amountCents
      }

      let rollingSpend = 0
      let rollingIncome = 0
      let spendDays = 0
      for (const t of rollingTxs) {
        if (t.type === 'Credit') rollingIncome += t.amountCents
        else {
          rollingSpend += t.amountCents
          spendDays += 1
        }
      }
      const daysTracked = Math.max(30, 1)
      const avgDailySpend = rollingSpend / daysTracked
      const avgDailyIncome = rollingIncome / daysTracked

      const projectedSpend = monthSpend + avgDailySpend * daysRemaining
      const projectedIncome = monthIncome + avgDailyIncome * daysRemaining
      const projectedNet = projectedIncome - projectedSpend
      const projectedEndBalance = totalBalance + projectedNet
      const runwayDays = avgDailySpend > 0 ? Math.floor(totalBalance / avgDailySpend) : null

      const fmt = (n: number) => (n >= 0 ? formatEtb(n) : `-${formatEtb(Math.abs(n))}`)
      const text =
        `Financial projection (as of ${now.toISOString().slice(0, 10)}):\n` +
        `- Current balance: ${formatEtb(totalBalance)}\n` +
        `- ${year}-${String(monthIndex + 1).padStart(2, '0')} so far (day ${dayOfMonth}/${daysInMonth}): spend ${formatEtb(monthSpend)}, income ${formatEtb(monthIncome)}, net ${fmt(monthIncome - monthSpend)}\n` +
        `- Last 30 days: avg daily spend ${formatEtb(Math.round(avgDailySpend))}, avg daily income ${formatEtb(Math.round(avgDailyIncome))}\n` +
        `- Projected month-end (${daysRemaining} days left): spend ~${formatEtb(Math.round(projectedSpend))}, income ~${formatEtb(Math.round(projectedIncome))}, net ~${fmt(Math.round(projectedNet))}\n` +
        `- Projected balance at month end: ~${formatEtb(Math.round(projectedEndBalance))}\n` +
        `- Runway: ${runwayDays === null ? 'unlimited (no spending detected)' : `~${runwayDays} days until the balance is depleted at the current spending rate`}`
      return ok(tool, text, {
        totalBalanceCents: totalBalance,
        monthSpendCents: monthSpend,
        monthIncomeCents: monthIncome,
        projectedSpendCents: Math.round(projectedSpend),
        projectedIncomeCents: Math.round(projectedIncome),
        projectedNetCents: Math.round(projectedNet),
        projectedEndBalanceCents: Math.round(projectedEndBalance),
        runwayDays,
      })
    }

    default:
      return err(tool, `Unknown tool "${tool}". Available tools: ${MCP_TOOLS.map((t) => t.name).join(', ')}`)
  }
}
