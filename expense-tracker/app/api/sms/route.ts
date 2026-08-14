import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppSetting, getDemoUser } from '@/lib/data'

const SENDERS: Record<string, string> = {
  cbe: 'CBE',
  cbebirr: 'CBE',
  'commercial bank': 'CBE',
  telebirr: 'Telebirr',
  '127': 'Telebirr',
  boa: 'Bank of Abyssinia',
  abyssinia: 'Bank of Abyssinia',
  awash: 'Awash Bank',
  dashen: 'Dashen Bank',
  nib: 'NIB',
  wegagen: 'Wegagen Bank',
  abay: 'Abay Bank',
  cooperative: 'Cooperative Bank',
}

const DEBIT_WORDS = /\b(debited?|paid|payment|withdrawn|withdrawal|sent|transferred?\s+(?:to|out)|purchase(?:d)?|spent|fee|charge|drafted|bank\s*transfer)\b/i
const CREDIT_WORDS = /\b(credited?|received|receiving|deposit(?:ed)?|salary|income|transferred?\s+(?:from|to\s*you)|added|refund(?:ed)?|cashback)\b/i
const AMOUNT_RE = /(?:ETB|Birr|Br)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br)/gi
const DATE_RE = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/
const BALANCE_HINT_RE = /(?:avail(?:able)?|bal(?:ance)?|new\s+bal(?:ance)?|after)\s+ETB|ETB\s+(?:avail(?:able)?|bal(?:ance)?|new)/i

function toCents(raw: string): number | null {
  const n = Number(raw.replaceAll(',', ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

function parseAmount(payload: string): number | null {
  const matches: { start: number; end: number; cents: number }[] = []
  let m: RegExpExecArray | null
  AMOUNT_RE.lastIndex = 0
  while ((m = AMOUNT_RE.exec(payload)) !== null) {
    const raw = m[1] ?? m[2]
    const cents = toCents(raw)
    if (cents !== null) matches.push({ start: m.index, end: m.index + m[0].length, cents })
  }
  if (matches.length === 0) return null

  const firstKw = (re: RegExp): number => {
    const k = re.exec(payload)
    re.lastIndex = 0
    return k?.index ?? -1
  }
  const creditIdx = firstKw(CREDIT_WORDS)
  const debitIdx = firstKw(DEBIT_WORDS)
  const kws: number[] = [creditIdx, debitIdx].filter((i) => i !== -1)

  if (kws.length > 0) {
    const first = Math.min(...kws)
    const after = matches.filter((x) => x.start > first)
    const chosen = after.length > 0 ? after[0] : matches.reduce((a, b) => (Math.abs(a.start - first) < Math.abs(b.start - first) ? a : b))
    return chosen.cents
  }

  const unBalanced = matches.filter((x) => {
    const window = payload.slice(Math.max(0, x.start - 20), x.end + 5)
    return !BALANCE_HINT_RE.test(window)
  })
  return (unBalanced.length > 0 ? unBalanced[0] : matches[0]).cents
}

function detectType(payload: string): 'Credit' | 'Debit' {
  const creditIdx = CREDIT_WORDS.exec(payload)?.index ?? -1
  CREDIT_WORDS.lastIndex = 0
  const debitIdx = DEBIT_WORDS.exec(payload)?.index ?? -1
  DEBIT_WORDS.lastIndex = 0
  if (creditIdx === -1) return 'Debit'
  if (debitIdx === -1) return 'Credit'
  return creditIdx < debitIdx ? 'Credit' : 'Debit'
}

function parseDate(payload: string): Date | null {
  const m = payload.match(DATE_RE)
  if (!m) return null
  if (m[1]) {
    const [y, mo, d] = m[1].split('-').map(Number)
    const dt = new Date(y, mo - 1, d)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  const [d, mo, y] = m[2].split('/').map(Number)
  const dt = new Date(y, mo - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function extractMerchant(payload: string, provider: string): string | null {
  const patterns = [
    /(?:at|from|to)\s+([A-Z][A-Za-z0-9 .&'-]{2,40})/,
    /merchant:\s*([A-Za-z0-9 .&'-]{2,40})/,
    /(?:purchase\s+(?:of\s+)?|paid\s+to|payment\s+to|transfer\s+to)\s+([A-Z][A-Za-z0-9 .&'-]{2,40})/,
  ]
  for (const re of patterns) {
    const m = payload.match(re)
    if (m && !/ETB|Birr|Br|account|balance/i.test(m[1])) return m[1].trim()
  }
  return provider
}

function resolveProvider(sender?: string, provider?: string): string {
  const raw = (sender || provider || '').toLowerCase().replace(/[^a-z0-9 ]/g, '')
  for (const [key, canonical] of Object.entries(SENDERS)) {
    if (raw.includes(key)) return canonical
  }
  return (provider || sender || 'SMS').trim() || 'SMS'
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { provider?: string; sender?: string; payload?: string }
  const payload = body.payload?.trim()
  if (!payload) return NextResponse.json({ error: 'payload is required' }, { status: 400 })

  const user = await getDemoUser()
  const provider = resolveProvider(body.sender, body.provider)
  const amountCents = parseAmount(payload)
  const referenceId = `SMS-${createHash('sha1').update(payload.trim()).digest('hex').slice(0, 16)}`
  const log = await prisma.smsLog.create({ data: { provider, sender: body.sender?.trim() || null, payload, userId: user.id } })

  const setting = await getAppSetting(user.id)
  if (!amountCents || !setting.smsListener) {
    return NextResponse.json({ accepted: true, parsed: false, listenerPaused: !setting.smsListener, amountCents, smsLogId: log.id })
  }

  const type = detectType(payload)
  const existing = await prisma.transaction.findUnique({ where: { referenceId } })
  const transaction = existing ?? await prisma.transaction.create({
    data: {
      provider,
      type,
      amountCents,
      referenceId,
      merchant: extractMerchant(payload, provider),
      tag: 'SMS import',
      occurredAt: parseDate(payload) ?? new Date(),
      userId: user.id,
    },
  })
  await prisma.smsLog.update({ where: { id: log.id }, data: { parsed: true } })
  return NextResponse.json({ accepted: true, parsed: true, duplicate: Boolean(existing), transaction })
}
