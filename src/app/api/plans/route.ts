import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Public plans endpoint
export async function GET() {
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
