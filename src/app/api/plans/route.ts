import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Public plans endpoint — accessible by any authenticated user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      interval: true,
      durationDays: true,
      maxDevices: true,
      featured: true,
    },
  })

  return NextResponse.json({ plans })
}
