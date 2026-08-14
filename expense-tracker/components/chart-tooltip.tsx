'use client'

import { formatEtb } from '@/lib/format'

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  payload?: { fill?: string }
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur">
      {label !== undefined && label !== '' && <p className="mb-1.5 font-semibold text-foreground">{label}</p>}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill || 'var(--color-primary)' }} />
              {entry.name}
            </span>
            <b className="font-mono text-foreground">{typeof entry.value === 'number' ? formatEtb(entry.value) : entry.value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}