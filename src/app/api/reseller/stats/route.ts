import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!session || !['ADMIN', 'RESELLER'].includes(user?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resellerId = user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalClients, activeClients, newThisMonth, resellerData] = await Promise.all([
    prisma.subscription.count({ where: { resellerId } }),
    prisma.subscription.count({
      where: { resellerId, status: 'ACTIVE', expiresAt: { gt: now } },
    }),
    prisma.subscription.count({
      where: { resellerId, createdAt: { gte: startOfMonth } },
    }),
    prisma.user.findUnique({
      where: { id: resellerId },
      select: { commissionRate: true, referralCode: true },
    }),
  ])

  const activeSubs = await prisma.subscription.findMany({
    where: { resellerId, status: 'ACTIVE', expiresAt: { gt: now } },
    include: { plan: true },
  })

  const monthlyCommission = activeSubs.reduce((sum, sub) => {
    const monthlyValue =
      sub.plan.interval === 'ANNUAL'
        ? sub.plan.price / 12
        : sub.plan.interval === 'QUARTERLY'
        ? sub.plan.price / 3
        : sub.plan.price
    return sum + monthlyValue * (resellerData?.commissionRate || 0.2)
  }, 0)

  const clicks = await prisma.affiliateClick.count({ where: { resellerId } })
  const conversions = await prisma.affiliateClick.count({
    where: { resellerId, converted: true },
  })

  return NextResponse.json({
    totalClients,
    activeClients,
    newThisMonth,
    monthlyCommission,
    commissionRate: resellerData?.commissionRate || 0.2,
    referralCode: resellerData?.referralCode,
    affiliateClicks: clicks,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
  })
}
