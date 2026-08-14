'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone } from 'lucide-react'
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

interface Account {
  id: string
  provider: string
  label: string
  balanceCents: number
  currency: string
}

interface Transaction {
  id: string
  provider: string
  type: string
  amountCents: number
  merchant: string | null
  referenceId: string
  tag: string | null
  occurredAt: string
}

const PERIODS = [
  { label: 'All', value: 'All' },
  { label: 'Daily', value: 'Day' },
  { label: 'Weekly', value: 'Week' },
  { label: 'Monthly', value: 'Month' },
]

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [period, setPeriod] = useState('All')
  const [name, setName] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
      .then(([a, acct, s]) => {
        setAnalytics(a.analytics)
        setAccounts(acct.accounts)
        setName(s.settings?.name ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('limit', '6')
    if (period !== 'All') params.set('period', period)
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions))
      .catch(() => {})
  }, [period])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const firstName = name.split(' ')[0] || 'there'

  return (
    <>
      <p className="text-sm font-medium text-primary">{today}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Good morning, {firstName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Here is your financial overview for {analytics?.month ?? 'this month'}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly spend" icon={ArrowDownLeft} accent="rose" value={analytics ? formatEtb(analytics.monthSpendCents) : '…'} caption={analytics ? `${analytics.monthCount} transactions` : ''} />
        <StatCard label="Income" icon={ArrowUpRight} accent="emerald" value={analytics ? formatEtb(analytics.monthIncomeCents) : '…'} caption={analytics && analytics.monthIncomeCents > 0 ? 'Credits this month' : 'No income yet'} />
        <StatCard label="Total balance" icon={Smartphone} accent="sky" value={analytics ? formatEtb(analytics.totalBalanceCents) : '…'} caption={`Across ${accounts.length} accounts`} />
        <StatCard label="Top category" icon={CreditCard} accent="violet" value={analytics?.categories[0]?.tag ?? '—'} caption={analytics?.categories[0] ? formatEtb(analytics.categories[0].amount) : ''} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Spending trend</h2>
          <p className="mt-1 text-sm text-muted-foreground">Daily activity across all accounts</p>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(analytics?.daily ?? []).map((d) => ({ ...d, label: formatDate(d.date) }))}>
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity=".3" />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="spend" stroke="var(--color-chart-1)" fill="url(#fill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-semibold">Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connected balances</p>
          <div className="mt-5 flex flex-col gap-3">
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected yet.</p>}
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{a.provider.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{a.label}</b>
                  <small className="text-xs text-muted-foreground">Synced just now</small>
                </span>
                <b className="font-mono text-xs">{formatEtb(a.balanceCents)}</b>
              </div>
            ))}
          </div>
          <Link href="/settings" className="mt-5 block w-full rounded-xl border border-dashed border-border py-3 text-center text-sm text-muted-foreground hover:text-foreground">+ Connect account</Link>
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-semibold">Recent transactions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your latest bank activity</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
              {PERIODS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPeriod(o.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    period === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Link href="/transactions" className="text-sm text-primary">View all</Link>
          </div>
        </div>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{['Transaction', 'Provider', 'Type', 'Amount', 'Reference', 'Tag'].map((h) => <th key={h} className="px-5 py-4 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No transactions yet.</td></tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-5 py-4"><b>{t.merchant ?? t.provider}</b><small className="mt-1 block text-xs text-muted-foreground">{formatDate(t.occurredAt)}</small></td>
                <td className="px-5 py-4 font-mono text-xs">{t.provider}</td>
                <td className="px-5 py-4">
                  {t.type === 'Credit'
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><ArrowDownLeft className="size-3" /> Credit</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400"><ArrowUpRight className="size-3" /> Debit</span>}
                </td>
                <td className={`px-5 py-4 text-right font-mono text-xs font-semibold ${t.type === 'Credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{t.type === 'Credit' ? '+' : '-'}{formatEtb(t.amountCents)}</td>
                <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{t.referenceId}</td>
                <td className="px-5 py-4">{t.tag && <span className="rounded-md bg-secondary px-2 py-1 text-xs">{t.tag}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}