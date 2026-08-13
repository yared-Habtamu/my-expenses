'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone } from 'lucide-react'
import { formatDate, formatEtb } from '@/lib/format'

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

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/transactions?limit=6').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
      .then(([a, acct, txn, s]) => {
        setAnalytics(a.analytics)
        setAccounts(acct.accounts)
        setTransactions(txn.transactions)
        setName(s.settings?.name ?? '')
      })
      .catch(() => {})
  }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const firstName = name.split(' ')[0] || 'there'

  return (
    <>
      <p className="text-sm font-medium text-primary">{today}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Good morning, {firstName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Here is your financial overview for {analytics?.month ?? 'this month'}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Monthly spend</span><ArrowDownLeft className="size-4 text-primary" /></div>
          <p className="mt-5 font-mono text-xl font-semibold">{analytics ? formatEtb(analytics.monthSpendCents) : '…'}</p>
          <p className="mt-2 text-xs text-primary">{analytics ? `${analytics.monthCount} transactions` : ''}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Income</span><ArrowUpRight className="size-4 text-primary" /></div>
          <p className="mt-5 font-mono text-xl font-semibold">{analytics ? formatEtb(analytics.monthIncomeCents) : '…'}</p>
          <p className="mt-2 text-xs text-primary">{analytics && analytics.monthIncomeCents > 0 ? 'Credits this month' : 'No income yet'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Total balance</span><Smartphone className="size-4 text-primary" /></div>
          <p className="mt-5 font-mono text-xl font-semibold">{analytics ? formatEtb(analytics.totalBalanceCents) : '…'}</p>
          <p className="mt-2 text-xs text-primary">Across {accounts.length} accounts</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Top category</span><CreditCard className="size-4 text-primary" /></div>
          <p className="mt-5 font-mono text-xl font-semibold">{analytics?.categories[0]?.tag ?? '—'}</p>
          <p className="mt-2 text-xs text-primary">{analytics?.categories[0] ? formatEtb(analytics.categories[0].amount) : ''}</p>
        </div>
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
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity=".25" />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatEtb(Number(v))} />
                <Area type="monotone" dataKey="spend" stroke="var(--color-primary)" fill="url(#fill)" strokeWidth={2.5} />
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
          <Link href="/transactions" className="text-sm text-primary">View all</Link>
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
                <td className="px-5 py-4 text-xs">{t.type === 'Credit' ? <ArrowDownLeft className="mr-1 inline size-3 text-primary" /> : <ArrowUpRight className="mr-1 inline size-3 text-muted-foreground" />}{t.type}</td>
                <td className={`px-5 py-4 text-right font-mono text-xs ${t.type === 'Credit' ? 'text-primary' : ''}`}>{t.type === 'Credit' ? '+' : '-'}{formatEtb(t.amountCents)}</td>
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