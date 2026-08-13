import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppSetting, getDemoUser } from '@/lib/data'

export async function GET() {
  const user = await getDemoUser()
  const [setting, accounts] = await Promise.all([getAppSetting(user.id), prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })])
  return NextResponse.json({
    settings: { name: user.name, email: user.email, smsListener: setting.smsListener },
    accounts,
  })
}

export async function PATCH(request: Request) {
  const user = await getDemoUser()
  const body = await request.json() as { name?: string; email?: string; smsListener?: boolean }

  const userData: Record<string, string> = {}
  if ('name' in body && body.name !== undefined) userData.name = body.name.trim() || user.name
  if ('email' in body && body.email !== undefined) userData.email = body.email.trim() || user.email
  if (Object.keys(userData).length > 0) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: userData })
    } catch {
      return NextResponse.json({ error: 'Email is already in use or invalid' }, { status: 400 })
    }
  }

  if ('smsListener' in body) {
    await prisma.appSetting.upsert({
      where: { userId: user.id },
      update: { smsListener: Boolean(body.smsListener) },
      create: { userId: user.id, smsListener: Boolean(body.smsListener) },
    })
  }

  const [setting, accounts] = await Promise.all([getAppSetting(user.id), prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })])
  return NextResponse.json({ settings: { name: userData.name ?? user.name, email: userData.email ?? user.email, smsListener: setting.smsListener }, accounts })
}