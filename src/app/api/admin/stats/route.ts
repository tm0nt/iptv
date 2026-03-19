import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAdminDashboardStats } from '@/lib/dashboard-stats'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role

  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const recentPage = Math.max(1, parseInt(searchParams.get('recentPage') || '1', 10))
  const recentLimit = Math.min(50, Math.max(5, parseInt(searchParams.get('recentLimit') || '10', 10)))

  return NextResponse.json(await getAdminDashboardStats({ recentPage, recentLimit }))
}
