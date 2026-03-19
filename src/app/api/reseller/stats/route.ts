import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getResellerDashboardStats } from '@/lib/dashboard-stats'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!session || !user || !user.role || !['ADMIN', 'RESELLER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(await getResellerDashboardStats(user.id))
}
