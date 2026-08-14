'use client'

import type { LucideIcon } from 'lucide-react'

type Accent = 'rose' | 'emerald' | 'sky' | 'violet' | 'amber'

const ACCENTS: Record<Accent, { bar: string; chip: string; text: string }> = {
  rose: { bar: 'from-rose-500 to-rose-400', chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400' },
  emerald: { bar: 'from-emerald-500 to-emerald-400', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
  sky: { bar: 'from-sky-500 to-sky-400', chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', text: 'text-sky-600 dark:text-sky-400' },
  violet: { bar: 'from-violet-500 to-violet-400', chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', text: 'text-violet-600 dark:text-violet-400' },
  amber: { bar: 'from-amber-500 to-amber-400', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400' },
}

export function StatCard({
  label,
  icon: Icon,
  value,
  caption,
  accent = 'violet',
  valueClassName,
}: {
  label: string
  icon: LucideIcon
  value: string
  caption?: string
  accent?: Accent
  valueClassName?: string
}) {
  const a = ACCENTS[accent]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.bar}`} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg ${a.chip}`}><Icon className="size-4" /></span>
      </div>
      <p className={`mt-5 font-mono text-xl font-semibold ${valueClassName ?? ''}`}>{value}</p>
      {caption && <p className={`mt-2 text-xs font-medium ${a.text}`}>{caption}</p>}
    </div>
  )
}