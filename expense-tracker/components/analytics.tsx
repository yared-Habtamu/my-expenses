'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet } from 'lucide-react'
import { formatDate, formatEtb } from '@/lib/format'
import { ChartTooltip } from '@/components/chart-tooltip'
import { StatCard } from '@/components/stat-card'

interface Analytics {
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

const COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)']

const TICK = { fill: 'var(--color-muted-foreground)', fontSize: 12 }

export default function Analytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => setAnalytics(d.analytics))
      .catch(() => {})
  }, [])

  if (!analytics) return <p className="p-8 text-sm text-muted-foreground">Loading analytics…</p>

  const net = analytics.monthIncomeCents - analytics.monthSpendCents
  const daily = analytics.daily.map((d) => ({ ...d, label: formatDate(d.date) }))
  const categories = analytics.categories.map((c, i) => ({ ...c, fill: COLORS[i % COLORS.length] }))

  return (
    <>
      <p className="text-sm font-medium text-primary">Analytics</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{analytics.month}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Spending and income across your linked accounts.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Spend" icon={ArrowDownLeft} accent="rose" value={formatEtb(analytics.monthSpendCents)} caption={`${analytics.monthCount} transactions`} />
        <StatCard label="Income" icon={ArrowUpRight} accent="emerald" value={formatEtb(analytics.monthIncomeCents)} caption="Credits this month" />
        <StatCard
          label="Net flow"
          icon={TrendingUp}
          accent={net >= 0 ? 'emerald' : 'rose'}
          value={`${net >= 0 ? '+' : '-'}${formatEtb(Math.abs(net))}`}
          valueClassName={net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
          caption={net >= 0 ? 'Positive cash flow' : 'Spending exceeded income'}
        />
        <StatCard label="Total balance" icon={Wallet} accent="violet" value={formatEtb(analytics.totalBalanceCents)} caption="Across all accounts" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Daily spending trend</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cash out each day in {analytics.month}</p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity=".3" />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK} />
                <YAxis axisLine={false} tickLine={false} tick={TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="spend" stroke="var(--color-chart-2)" fill="url(#analyticsFill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Spend by category</h2>
          <p className="mt-1 text-sm text-muted-foreground">Where your money went in {analytics.month}</p>
          {categories.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">No spending recorded yet this month.</p>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {analytics.categories.map((c, i) => (
                <div key={c.tag}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.tag}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatEtb(c.amount)} · {((c.amount / analytics.monthSpendCents) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full" style={{ width: `${(c.amount / analytics.monthSpendCents) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Provider mix</h2>
          <p className="mt-1 text-sm text-muted-foreground">Spending split by provider</p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.providers} dataKey="amount" nameKey="provider" innerRadius="55%" outerRadius="80%" paddingAngle={3}>
                  {analytics.providers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Provider totals</h2>
          <p className="mt-1 text-sm text-muted-foreground">Debits processed by each provider</p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.providers} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="provider" axisLine={false} tickLine={false} tick={TICK} width={70} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-secondary)' }} />
                <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
                  {analytics.providers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  )
}