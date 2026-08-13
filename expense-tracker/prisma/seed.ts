import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({ where: { email: 'tewodros@example.com' }, update: {}, create: { name: 'Tewodros Abebe', email: 'tewodros@example.com' } })
  const cbe = await prisma.account.create({ data: { provider: 'CBE', label: 'Commercial Bank of Ethiopia', balanceCents: 5822025, userId: user.id } })
  const telebirr = await prisma.account.create({ data: { provider: 'Telebirr', label: 'Telebirr wallet', balanceCents: 684050, userId: user.id } })
  await prisma.transaction.createMany({ data: [
    { provider: 'CBE', type: 'Debit', amountCents: 124000, merchant: 'Wegagen Supermarket', referenceId: 'CBE-8F2A91', tag: 'Groceries', occurredAt: new Date('2026-08-12'), userId: user.id, accountId: cbe.id },
    { provider: 'Telebirr', type: 'Debit', amountCents: 28000, merchant: 'Ride Ethiopia', referenceId: 'TEL-3A8D12', tag: 'Transport', occurredAt: new Date('2026-08-11'), userId: user.id, accountId: telebirr.id },
  ] })
}

main().finally(() => prisma.$disconnect())
