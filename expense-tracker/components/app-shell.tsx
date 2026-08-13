'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PieChart,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: CreditCard },
  { label: 'Analytics', href: '/analytics', icon: PieChart },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  provider?: string
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [smsListening, setSmsListening] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Good morning. I have your latest financial picture ready. What would you like to explore?' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setSmsListening(d.settings?.smsListener ?? true)
        setProfileName(d.settings?.name ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (profileName) {
      setMessages((prev) => prev.length === 1 && prev[0].content.startsWith('Good morning.')
        ? [{ role: 'assistant', content: `Good morning, ${profileName.split(' ')[0]}. I have your latest financial picture ready. What would you like to explore?` }]
        : prev)
    }
  }, [profileName])

  const initials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'TA'

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    router.push(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions')
    setSearch('')
  }

  const send = async () => {
    const q = input.trim()
    if (!q || sending) return
    setInput('')
    setSending(true)
    const next = [...messages, { role: 'user' as const, content: q }]
    setMessages(next)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.content ?? 'Sorry, something went wrong.', provider: data.provider }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, I could not reach the assistant right now.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar p-5 transition-transform lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Wallet className="size-5" /></div>
          <b className="font-mono text-lg">expense<span className="text-primary">_</span>tracker</b>
        </div>
        <nav className="mt-12 flex flex-col gap-2">
          {NAV.map(({ label, href, icon: I }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setNavOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${pathname === href ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              <I className="size-4" />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setChatOpen(true)}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${chatOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            <MessageSquare className="size-4" />
            AI Assistant
            <span className="ml-auto size-2 rounded-full bg-primary" />
          </button>
        </nav>
        <div className="mt-auto rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Smartphone className="size-4 text-primary" />
            SMS listener
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Bank messages are parsed securely in real time.</p>
          <p className="mt-4 text-xs font-medium text-primary">{smsListening ? '● Listening for SMS' : '○ SMS listener paused'}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setNavOpen(!navOpen)} aria-label="Open navigation"><Menu className="size-5" /></button>
            <form onSubmit={submitSearch} className="relative hidden w-72 md:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary/50"
                placeholder="Search transactions..."
              />
            </form>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary sm:block">
              {smsListening ? '● Listening for SMS' : '○ SMS paused'}
            </span>
            <button onClick={() => setChatOpen(!chatOpen)} className="flex size-10 items-center justify-center rounded-xl border border-border bg-card" aria-label="Toggle assistant"><Bot className="size-5" /></button>
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold">{initials}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 md:p-8">{children}</main>
      </div>

      {chatOpen && (
        <aside className="fixed bottom-4 right-4 z-50 flex h-[min(680px,calc(100vh-2rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-3 bg-primary p-4 text-primary-foreground">
            <Sparkles className="size-5" />
            <div className="flex-1">
              <b className="block text-sm">expense_tracker AI</b>
              <small className="text-xs opacity-70">Connected to your financial data</small>
            </div>
            <button onClick={() => setChatOpen(false)} aria-label="Close assistant" className="text-xl leading-none">×</button>
          </div>
          <div ref={chatRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className="flex max-w-[85%] flex-col gap-1">
                <div className={`rounded-2xl px-3 py-2 text-sm leading-6 ${m.role === 'user' ? 'self-end bg-primary text-primary-foreground' : 'bg-secondary'}`}>{m.content}</div>
                {m.role === 'assistant' && m.provider && <span className="self-start px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m.provider}</span>}
              </div>
            ))}
            {sending && <div className="max-w-[85%] rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Thinking…</div>}
            <div className="mt-auto rounded-xl border border-border p-3 text-xs text-muted-foreground">Try “How much did I spend this month?”</div>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex gap-2 rounded-xl border border-border p-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                placeholder="Ask about your finances..."
              />
              <button onClick={send} disabled={sending} className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send"><Send className="size-4" /></button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}