'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, ChevronDown, Plus, RefreshCw, Shield, Trash2, User, Wallet, X } from 'lucide-react'
import { formatEtb } from '@/lib/format'

interface Account {
  id: string
  provider: string
  label: string
  balanceCents: number
  currency: string
}

export default function Settings() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [smsListener, setSmsListener] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [accountModal, setAccountModal] = useState(false)
  const [accountForm, setAccountForm] = useState({ provider: '', label: '', balance: '' })

  const [smsOpen, setSmsOpen] = useState(false)
  const [smsProvider, setSmsProvider] = useState('CBE')
  const [smsPayload, setSmsPayload] = useState('')
  const [smsResult, setSmsResult] = useState<{ parsed: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setName(d.settings.name)
        setEmail(d.settings.email)
        setSmsListener(d.settings.smsListener)
        setAccounts(d.accounts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const toggleSms = async (v: boolean) => {
    setSmsListener(v)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsListener: v }),
    })
  }

  const addAccount = async () => {
    if (!accountForm.provider.trim()) return
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: accountForm.provider.trim(),
        label: accountForm.label.trim() || accountForm.provider.trim(),
        balanceCents: Math.round(Number(accountForm.balance || 0) * 100),
      }),
    })
    if (res.ok) {
      const d = await res.json()
      setAccounts([...accounts, d.account])
      setAccountModal(false)
      setAccountForm({ provider: '', label: '', balance: '' })
    }
  }

  const updateBalance = async (id: string, balanceCents: number) => {
    await fetch(`/api/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balanceCents }) })
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, balanceCents } : a)))
  }

  const deleteAccount = async (id: string) => {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  const testSms = async () => {
    if (!smsPayload.trim()) return
    setSmsResult(null)
    const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: smsProvider, payload: smsPayload }) })
    const d = await res.json()
    if (d.parsed) {
      setSmsResult({ parsed: true, message: `Parsed ${d.transaction.type} of ${formatEtb(d.transaction.amountCents)} and added it to your transactions.` })
    } else {
      setSmsResult({ parsed: false, message: d.listenerPaused ? 'SMS listener is paused — message logged but no transaction created. Enable the listener to parse incoming SMS.' : 'Could not parse an amount from this message. Include something like "ETB 1,240.00".' })
    }
  }

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Loading settings…</p>

  return (
    <>
      <p className="text-sm font-medium text-primary">Settings</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your profile, connected accounts, and SMS listener.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><User className="size-5" /></div>
            <div>
              <h2 className="font-semibold">Profile</h2>
              <p className="text-xs text-muted-foreground">Your personal details</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <label className="text-xs font-medium text-muted-foreground">Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
            </label>
            <button onClick={saveProfile} className="flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              {saved ? <><Check className="size-4" /> Saved</> : 'Save changes'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="size-5" /></div>
            <div>
              <h2 className="font-semibold">SMS listener</h2>
              <p className="text-xs text-muted-foreground">Auto-import bank messages as transactions</p>
            </div>
            <button
              onClick={() => toggleSms(!smsListener)}
              className={`relative ml-auto h-7 w-12 rounded-full transition-colors ${smsListener ? 'bg-primary' : 'bg-secondary'}`}
              aria-label="Toggle SMS listener"
            >
              <span className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${smsListener ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{smsListener ? 'Your listener is on. Incoming bank SMS are parsed and saved as transactions.' : 'Your listener is paused. Incoming SMS are logged but not turned into transactions.'}</p>

          <button onClick={() => setSmsOpen(!smsOpen)} className="mt-6 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
            <span className="flex items-center gap-2"><RefreshCw className="size-4 text-muted-foreground" /> Simulate an incoming SMS</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${smsOpen ? 'rotate-180' : ''}`} />
          </button>
          {smsOpen && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border p-4">
              <label className="text-xs font-medium text-muted-foreground">Provider
                <select value={smsProvider} onChange={(e) => setSmsProvider(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50">
                  <option>CBE</option><option>Telebirr</option><option>Awash</option><option>BOA</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">Message body
                <textarea value={smsPayload} onChange={(e) => setSmsPayload(e.target.value)} rows={3} placeholder="Your purchase of ETB 1,240.00 at Wegagen Supermarket. Ref: CBE-8F2A91" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <button onClick={testSms} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Send test SMS</button>
              {smsResult && <p className={`rounded-xl px-3 py-2 text-xs ${smsResult.parsed ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>{smsResult.message}</p>}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="size-5" /></div>
          <div>
            <h2 className="font-semibold">Connected accounts</h2>
            <p className="text-xs text-muted-foreground">{accounts.length} linked account{accounts.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={() => setAccountModal(true)} className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Connect account</button>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected yet. Connect your first bank or wallet.</p>}
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{a.provider.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <input value={a.label} onChange={(e) => setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)))} className="w-full max-w-xs rounded-lg bg-transparent text-sm font-semibold outline-none focus:bg-background focus:px-2" />
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{a.provider}</span>
                  <span>·</span>
                  <label className="flex items-center gap-1">Balance
                    <input
                      type="number"
                      step="0.01"
                      value={(a.balanceCents / 100).toFixed(2)}
                      onChange={(e) => updateBalance(a.id, Math.round(Number(e.target.value || 0) * 100))}
                      className="w-28 rounded-lg bg-transparent font-mono text-xs text-muted-foreground outline-none focus:bg-background focus:px-2"
                    />
                    <span className="font-mono">{a.currency}</span>
                  </label>
                </div>
              </div>
              <button onClick={() => deleteAccount(a.id)} aria-label="Remove account" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Shield className="size-5 text-primary" />
        Your financial data is stored locally and never shared with third parties. The AI assistant only reads account balances and transaction history.
      </div>

      {accountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAccountModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Connect account</h2>
              <button onClick={() => setAccountModal(false)} aria-label="Close"><X className="size-5" /></button>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground">Provider
                <input value={accountForm.provider} onChange={(e) => setAccountForm({ ...accountForm, provider: e.target.value })} placeholder="e.g. CBE, Telebirr" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">Label
                <input value={accountForm.label} onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })} placeholder="e.g. Commercial Bank of Ethiopia" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">Opening balance (ETB)
                <input value={accountForm.balance} onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })} type="number" step="0.01" min="0" placeholder="0.00" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setAccountModal(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={addAccount} disabled={!accountForm.provider.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Connect</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}