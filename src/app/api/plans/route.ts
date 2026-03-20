import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePlanSchema, getPlanFlagsMap } from '@/lib/plan-schema'

export const dynamic = 'force-dynamic'

// Public plans endpoint
export async function GET() {
  await ensurePlanSchema()
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

  const flagsMap = await getPlanFlagsMap(plans.map(plan => plan.id))
  const publicPlans = plans
    .map(plan => ({
      ...plan,
      ...(flagsMap.get(plan.id) || { adminOnly: false, isUnlimited: false }),
    }))
    .filter(plan => !plan.adminOnly)

  return NextResponse.json({ plans: publicPlans })
}
