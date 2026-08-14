import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { generateObject, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAppSetting, getDemoUser } from '@/lib/data'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || undefined })
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || undefined })
const gateway = createGateway({ apiKey: process.env.VERCEL_API_KEY || undefined })

const SmsParseSchema = z.object({
  type: z.enum(['Credit', 'Debit']).describe('Transaction type: Credit for money received/income/salary/deposit, Debit for spent/transferred/withdrawn/purchase/payment'),
  amount: z.number().describe('Primary transaction amount in ETB/Birr (excluding fees)'),
  fee: z.number().nullable().describe('Service fee, VAT, or extra charges in ETB/Birr if explicitly mentioned, otherwise null'),
  merchant: z.string().nullable().describe('Merchant, store, recipient, or sender name if mentioned in text, otherwise null'),
  date: z.string().nullable().describe('Transaction date in YYYY-MM-DD or readable format if present in text, otherwise null'),
  referenceId: z.string().nullable().describe('Transaction reference ID, Txn ID, or Ref string if present in text, otherwise null'),
})

interface LlmParsedSms {
  type: 'Credit' | 'Debit'
  amountCents: number
  merchant: string | null
  date: Date | null
  referenceId: string | null
}

async function parseSmsWithLlm(payload: string): Promise<LlmParsedSms | null> {
  const providers: { name: string; model: LanguageModel }[] = []
  if (process.env.GEMINI_API_KEY) providers.push({ name: 'gemini', model: google('gemini-3.5-flash') })
  if (process.env.OPENAI_API_KEY) providers.push({ name: 'openai', model: openai('gpt-4o-mini') })
  if (process.env.VERCEL_API_KEY) providers.push({ name: 'vercel-gateway', model: gateway('openai/gpt-4o-mini') })

  for (const provider of providers) {
    try {
      const { object } = await generateObject({
        model: provider.model,
        schema: SmsParseSchema,
        prompt: `Extract structured financial transaction details from this SMS text payload:\n\n"${payload}"`,
        maxRetries: 0,
      })

      if (object && typeof object.amount === 'number' && object.amount > 0) {
        const totalAmount = object.type === 'Debit' ? object.amount + (object.fee || 0) : object.amount
        const amountCents = Math.round(totalAmount * 100)

        let parsedDate: Date | null = null
        if (object.date) {
          const dt = new Date(object.date)
          if (!Number.isNaN(dt.getTime())) parsedDate = dt
        }

        return {
          type: object.type,
          amountCents,
          merchant: object.merchant?.trim() || null,
          date: parsedDate,
          referenceId: object.referenceId?.trim() || null,
        }
      }
    } catch (err) {
      console.error(`[sms-llm] provider ${provider.name} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return null
}

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

const DEBIT_WORDS = /\b(debited?|paid|payment|withdrawn|withdrawal|sent|transfer(?:red)?|purchase(?:d)?|spent|fee|charge|drafted)\b/i
const CREDIT_WORDS = /\b(credited?|received|receiving|deposit(?:ed)?|salary|income|transfer(?:red)?\s+(?:from|to\s*you)|added|refund(?:ed)?|cashback)\b/i
const FEE_RE = /\b(?:fee|vat|tax|charge|commission)\b/i
const BALANCE_RE = /\b(?:avail(?:able)?|bal(?:ance)?|current|new|after)\b/i
const REFERENCE_RE = /(?:ref(?:erence)?|transaction\s*(?:number|no|id)|trx|txn)\s*(?:is|:)?\s*([A-Z0-9-]{5,})/i
const AMOUNT_RE = /(?:ETB|Birr|Br)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br)/gi
const DATE_RE = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/

function toCents(raw: string): number | null {
  const n = Number(raw.replaceAll(',', ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

function collectAmounts(payload: string): { start: number; cents: number }[] {
  const matches: { start: number; cents: number }[] = []
  let m: RegExpExecArray | null
  AMOUNT_RE.lastIndex = 0
  while ((m = AMOUNT_RE.exec(payload)) !== null) {
    const cents = toCents(m[1] ?? m[2])
    if (cents !== null) matches.push({ start: m.index, cents })
  }
  return matches
}

function firstKeyword(payload: string, re: RegExp): number {
  const k = re.exec(payload)
  re.lastIndex = 0
  return k?.index ?? -1
}

function parseAmount(payload: string, type: 'Credit' | 'Debit'): number | null {
  const matches = collectAmounts(payload)
  if (matches.length === 0) return null

  const isFee = (a: { start: number }) => FEE_RE.test(payload.slice(Math.max(0, a.start - 80), a.start))
  const isBalance = (a: { start: number }) => BALANCE_RE.test(payload.slice(Math.max(0, a.start - 30), a.start))

  const kws = [firstKeyword(payload, CREDIT_WORDS), firstKeyword(payload, DEBIT_WORDS)].filter((i) => i !== -1)

  let primary: { start: number; cents: number }
  if (kws.length > 0) {
    const first = Math.min(...kws)
    const after = matches.filter((a) => a.start > first && !isFee(a) && !isBalance(a))
    primary = after.length > 0
      ? after[0]
      : matches.reduce((a, b) => (Math.abs(a.start - first) < Math.abs(b.start - first) ? a : b))
  } else {
    const unBalanced = matches.filter((a) => !isBalance(a))
    primary = unBalanced.length > 0 ? unBalanced[0] : matches[0]
  }

  let total = primary.cents
  if (type === 'Debit') {
    for (const a of matches) {
      if (a.start > primary.start && isFee(a) && !isBalance(a)) total += a.cents
    }
  }
  return total
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
  const body = await request.json().catch(() => ({})) as { provider?: string; sender?: string; payload?: string; occurredAt?: string }
  const payload = body.payload?.trim()
  if (!payload) return NextResponse.json({ error: 'payload is required' }, { status: 400 })

  const user = await getDemoUser()
  const provider = resolveProvider(body.sender, body.provider)
  const smsDate = body.occurredAt ? new Date(body.occurredAt) : null
  const fallbackDate = smsDate && !Number.isNaN(smsDate.getTime()) ? smsDate : null

  // 1. Attempt LLM parsing first
  const llmResult = await parseSmsWithLlm(payload)

  let type: 'Credit' | 'Debit'
  let amountCents: number | null
  let merchant: string | null
  let occurredAt: Date
  let referenceId: string
  let parsedBy: 'llm' | 'regex'

  if (llmResult) {
    type = llmResult.type
    amountCents = llmResult.amountCents
    merchant = llmResult.merchant ?? extractMerchant(payload, provider)
    occurredAt = llmResult.date ?? parseDate(payload) ?? fallbackDate ?? new Date()
    referenceId = llmResult.referenceId
      ? `REF-${llmResult.referenceId.replace(/^REF-?/i, '')}`
      : (payload.match(REFERENCE_RE)?.[1] ? `REF-${payload.match(REFERENCE_RE)![1]}` : `SMS-${createHash('sha1').update(payload).digest('hex').slice(0, 16)}`)
    parsedBy = 'llm'
  } else {
    // 2. Fallback to Regex parsing if LLM is offline or fails
    type = detectType(payload)
    amountCents = parseAmount(payload, type)
    merchant = extractMerchant(payload, provider)
    occurredAt = parseDate(payload) ?? fallbackDate ?? new Date()
    const refMatch = payload.match(REFERENCE_RE)
    referenceId = refMatch
      ? `REF-${refMatch[1]}`
      : `SMS-${createHash('sha1').update(payload).digest('hex').slice(0, 16)}`
    parsedBy = 'regex'
  }

  const log = await prisma.smsLog.create({
    data: { provider, sender: body.sender?.trim() || null, payload, userId: user.id }
  })

  const setting = await getAppSetting(user.id)
  if (!amountCents || !setting.smsListener) {
    return NextResponse.json({
      accepted: true,
      parsed: false,
      listenerPaused: !setting.smsListener,
      amountCents,
      smsLogId: log.id,
      parsedBy
    })
  }

  const existing = await prisma.transaction.findUnique({ where: { referenceId } })
  const transaction = existing ?? await prisma.transaction.create({
    data: {
      provider,
      type,
      amountCents,
      referenceId,
      merchant,
      tag: 'SMS import',
      occurredAt,
      userId: user.id,
    },
  })

  await prisma.smsLog.update({ where: { id: log.id }, data: { parsed: true } })

  return NextResponse.json({
    accepted: true,
    parsed: true,
    duplicate: Boolean(existing),
    parsedBy,
    transaction
  })
}

