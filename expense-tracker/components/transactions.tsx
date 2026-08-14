'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { formatDate, formatEtb } from '@/lib/format'
import { StatCard } from '@/components/stat-card'

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

const EMPTY_FORM = { provider: '', type: 'Debit', merchant: '', amount: '', tag: '', occurredAt: '' }

const PERIODS = [
  { label: 'All', value: 'All' },
  { label: 'Daily', value: 'Day' },
  { label: 'Weekly', value: 'Week' },
  { label: 'Monthly', value: 'Month' },
]

function TransactionsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [totalDebitCents, setTotalDebitCents] = useState(0)
  const [totalCreditCents, setTotalCreditCents] = useState(0)
  const [type, setType] = useState('All')
  const [period, setPeriod] = useState('All')
  const [provider, setProvider] = useState('All')
  const [tag, setTag] = useState('All')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const providers = ['CBE', 'Telebirr', 'BOA', 'Awash', 'M-Pesa']

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (type !== 'All') params.set('type', type)
    if (period !== 'All') params.set('period', period)
    if (provider !== 'All') params.set('provider', provider)
    if (tag !== 'All') params.set('tag', tag)
    if (search) params.set('search', search)
    params.set('limit', '50')
    if (offset) params.set('offset', String(offset))
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setTransactions(d.transactions)
        setTags(d.tags)
        setTotal(d.total)
        setTotalDebitCents(d.totalDebitCents ?? 0)
        setTotalCreditCents(d.totalCreditCents ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => { cancelled = true }
  }, [type, period, provider, tag, search, offset])

  const resetFilters = () => {
    setType('All'); setPeriod('All'); setProvider('All'); setTag('All'); setSearch(''); setOffset(0)
    router.replace('/transactions')
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, occurredAt: new Date().toISOString().slice(0, 10) })
    setModal(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setForm({ provider: t.provider, type: t.type, merchant: t.merchant ?? '', amount: (t.amountCents / 100).toFixed(2), tag: t.tag ?? '', occurredAt: t.occurredAt.slice(0, 10) })
    setModal(true)
  }

  const save = async () => {
    if (saving) return
    const amount = Number(form.amount)
    if (!form.provider.trim() || !Number.isFinite(amount) || amount <= 0) return
    setSaving(true)
    const payload = {
      provider: form.provider.trim(),
      type: form.type,
      amountCents: Math.round(amount * 100),
      merchant: form.merchant.trim(),
      tag: form.tag.trim(),
      occurredAt: form.occurredAt,
      ...(editing ? {} : { referenceId: `MANUAL-${Date.now()}` }),
    }
    const res = await fetch(editing ? `/api/transactions/${editing.id}` : '/api/transactions', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setModal(false)
      setOffset(0)
      const params = new URLSearchParams()
      if (type !== 'All') params.set('type', type)
      if (period !== 'All') params.set('period', period)
      if (provider !== 'All') params.set('provider', provider)
      if (tag !== 'All') params.set('tag', tag)
      if (search) params.set('search', search)
      const d = await fetch(`/api/transactions?${params}`).then((r) => r.json())
      setTransactions(d.transactions)
      setTags(d.tags)
      setTotal(d.total)
      setTotalDebitCents(d.totalDebitCents ?? 0)
      setTotalCreditCents(d.totalCreditCents ?? 0)
    }
    setSaving(false)
  }

  const updateTag = async (id: string, newTag: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: newTag }) })
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, tag: newTag || null } : t)))
  }

  const remove = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    setTotal((n) => n - 1)
  }

  const showMore = () => setOffset((o) => o + 50)

  return (
    <>
      <p className="text-sm font-medium text-primary">Transactions</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">All transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} records across your accounts</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Add transaction</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total debits" icon={ArrowUpRight} accent="rose" value={formatEtb(totalDebitCents)} caption={`${total} records`} />
        <StatCard label="Total credits" icon={ArrowDownLeft} accent="emerald" value={formatEtb(totalCreditCents)} caption="Money in" />
        <StatCard
          label="Net flow"
          icon={Plus}
          accent={totalCreditCents - totalDebitCents >= 0 ? 'emerald' : 'rose'}
          value={`${totalCreditCents - totalDebitCents >= 0 ? '+' : '-'}${formatEtb(Math.abs(totalCreditCents - totalDebitCents))}`}
          valueClassName={totalCreditCents - totalDebitCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
          caption="In − Out"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
            placeholder="Search merchant, tag or reference…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          {['All', 'Debit', 'Credit'].map((o) => (
            <button
              key={o}
              onClick={() => { setType(o); setOffset(0) }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                type === o
                  ? o === 'Debit'
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                    : o === 'Credit'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          {PERIODS.map((o) => (
            <button
              key={o.value}
              onClick={() => { setPeriod(o.value); setOffset(0) }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === o.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setOffset(0) }} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50">
          <option>All</option>
          {providers.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={tag} onChange={(e) => { setTag(e.target.value); setOffset(0) }} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50">
          <option>All</option>
          {tags.map((t) => <option key={t}>{t}</option>)}
        </select>
        {(type !== 'All' || period !== 'All' || provider !== 'All' || tag !== 'All' || search) && (
          <button onClick={resetFilters} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><X className="size-3.5" /> Clear</button>
        )}
      </div>

      <section className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{['Transaction', 'Provider', 'Type', 'Amount', 'Reference', 'Tag', ''].map((h, i) => <th key={i} className="px-5 py-4 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Loading transactions…</td></tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No transactions match your filters.</td></tr>
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
                <td className="px-5 py-4">
                  <select
                    value={t.tag ?? ''}
                    onChange={(e) => updateTag(t.id, e.target.value)}
                    className={`rounded-md border border-transparent bg-secondary px-2 py-1 text-xs outline-none focus:border-primary/50 ${t.tag ? '' : 'text-muted-foreground'}`}
                  >
                    <option value="">None</option>
                    {tags.map((tg) => <option key={tg}>{tg}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(t)} aria-label="Edit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(t.id)} aria-label="Delete" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {transactions.length > 0 && offset + 50 < total && (
        <div className="mt-4 text-center">
          <button onClick={showMore} className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground">Show more ({total - offset - 50} remaining)</button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Edit transaction' : 'Add transaction'}</h2>
              <button onClick={() => setModal(false)} aria-label="Close"><X className="size-5" /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="col-span-1 text-xs font-medium text-muted-foreground">Provider
                <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="e.g. CBE" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="col-span-1 text-xs font-medium text-muted-foreground">Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50">
                  <option>Debit</option><option>Credit</option>
                </select>
              </label>
              <label className="col-span-2 text-xs font-medium text-muted-foreground">Merchant
                <input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="e.g. Wegagen Supermarket" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="col-span-1 text-xs font-medium text-muted-foreground">Amount (ETB)
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" step="0.01" min="0" placeholder="0.00" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="col-span-1 text-xs font-medium text-muted-foreground">Date
                <input value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} type="date" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="col-span-2 text-xs font-medium text-muted-foreground">Tag
                <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. Groceries" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.provider.trim() || !Number(form.amount)} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading transactions…</div>}>
      <TransactionsInner />
    </Suspense>
  )
}