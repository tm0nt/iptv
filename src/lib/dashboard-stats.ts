import { prisma } from '@/lib/prisma'

export async function getAdminDashboardStats(options?: { recentPage?: number; recentLimit?: number }) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const recentPage = Math.max(1, options?.recentPage || 1)
  const recentLimit = Math.min(50, Math.max(5, options?.recentLimit || 10))
  const recentWhere = { createdAt: { gte: startOfMonth } }

  const [
    totalUsers,
    activeSubscriptions,
    newUsersThisMonth,
    totalResellers,
    plans,
    recentSubscriptions,
    totalRecentSubscriptions,
    activeWithPlan,
    churnedLastMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.subscription.count({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
    }),
    prisma.user.count({
      where: { role: 'CLIENT', createdAt: { gte: startOfMonth } },
    }),
    prisma.user.count({ where: { role: 'RESELLER' } }),
    prisma.plan.findMany({
      where: { active: true },
      include: {
        _count: { select: { subscriptions: true } },
      },
    }),
    prisma.subscription.findMany({
      where: recentWhere,
      include: { plan: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (recentPage - 1) * recentLimit,
      take: recentLimit,
    }),
    prisma.subscription.count({
      where: recentWhere,
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
      include: { plan: true },
    }),
    prisma.subscription.count({
      where: {
        status: 'EXPIRED',
        expiresAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
  ])

  const mrr = activeWithPlan.reduce((sum, sub) => {
    const monthlyValue =
      sub.plan.interval === 'ANNUAL'
        ? sub.plan.price / 12
        : sub.plan.interval === 'QUARTERLY'
          ? sub.plan.price / 3
          : sub.plan.price
    return sum + monthlyValue
  }, 0)

  return {
    totalUsers,
    activeSubscriptions,
    newUsersThisMonth,
    totalResellers,
    mrr,
    churnRate: activeSubscriptions > 0 ? (churnedLastMonth / activeSubscriptions) * 100 : 0,
    plans: plans.map(p => ({
      ...p,
      subscriberCount: p._count.subscriptions,
    })),
    recentSubscriptions,
    recentSubscriptionsTotal: totalRecentSubscriptions,
    recentSubscriptionsPage: recentPage,
    recentSubscriptionsLimit: recentLimit,
    generatedAt: new Date().toISOString(),
  }
}

export async function getResellerDashboardStats(resellerId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalClients, activeClients, newThisMonth, resellerData, activeSubs, clicks, conversions] = await Promise.all([
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
    prisma.subscription.findMany({
      where: { resellerId, status: 'ACTIVE', expiresAt: { gt: now } },
      include: { plan: true },
    }),
    prisma.affiliateClick.count({ where: { resellerId } }),
    prisma.affiliateClick.count({
      where: { resellerId, converted: true },
    }),
  ])

  const monthlyCommission = activeSubs.reduce((sum, sub) => {
    const monthlyValue =
      sub.plan.interval === 'ANNUAL'
        ? sub.plan.price / 12
        : sub.plan.interval === 'QUARTERLY'
          ? sub.plan.price / 3
          : sub.plan.price
    return sum + monthlyValue * (resellerData?.commissionRate || 0.2)
  }, 0)

  return {
    totalClients,
    activeClients,
    newThisMonth,
    monthlyCommission,
    commissionRate: resellerData?.commissionRate || 0.2,
    referralCode: resellerData?.referralCode,
    affiliateClicks: clicks,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    generatedAt: new Date().toISOString(),
  }
}
