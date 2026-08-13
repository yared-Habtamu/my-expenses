import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppSetting, getDemoUser } from '@/lib/data'

const amountPattern = /(?:ETB|Birr)\s*([\d,]+(?:\.\d{1,2})?)/i
const referencePattern = /(?:ref|reference|tx(?:n|id)?)[\s:#-]*([A-Z0-9-]{5,})/i

export async function POST(request: Request) {
  const body = await request.json() as { provider?: string; payload?: string }
  const provider = body.provider?.trim()
  const payload = body.payload?.trim()
  if (!provider || !payload) return NextResponse.json({ error: 'provider and payload are required' }, { status: 400 })

  const user = await getDemoUser()
  const amountMatch = payload.match(amountPattern)
  const amountCents = amountMatch ? Math.round(Number(amountMatch[1].replaceAll(',', '')) * 100) : null
  const referenceId = payload.match(referencePattern)?.[1] ?? `SMS-${Date.now()}`
  const log = await prisma.smsLog.create({ data: { provider, payload, userId: user.id } })

  const setting = await getAppSetting(user.id)
  if (!amountCents || !setting.smsListener) {
    return NextResponse.json({ accepted: true, parsed: false, listenerPaused: !setting.smsListener, smsLogId: log.id })
  }

  const type = /received|credited|deposit|salary/i.test(payload) ? 'Credit' : 'Debit'
  const transaction = await prisma.transaction.create({
    data: { provider, type, amountCents, referenceId, occurredAt: new Date(), userId: user.id, merchant: provider, tag: 'SMS import' },
  })
  await prisma.smsLog.update({ where: { id: log.id }, data: { parsed: true } })
  return NextResponse.json({ accepted: true, parsed: true, transaction })
}