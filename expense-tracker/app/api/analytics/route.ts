import { NextResponse } from 'next/server'
import { buildAnalytics, getDemoUser } from '@/lib/data'

export async function GET() {
  const user = await getDemoUser()
  const analytics = await buildAnalytics(user.id)
  return NextResponse.json({ analytics })
}
