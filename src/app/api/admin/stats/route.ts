import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role

  if (!session || session.user?.role !== 'ADMIN'.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    totalUsers,
    activeSubscriptions,
    newUsersThisMonth,
    totalResellers,
    plans,
    recentSubscriptions,
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
      where: { createdAt: { gte: startOfMonth } },
      include: { plan: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  // MRR calculation
  const activeWithPlan = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now } },
    include: { plan: true },
  })

  const mrr = activeWithPlan.reduce((sum, sub) => {
    const monthlyValue =
      sub.plan.interval === 'ANNUAL'
        ? sub.plan.price / 12
        : sub.plan.interval === 'QUARTERLY'
        ? sub.plan.price / 3
        : sub.plan.price
    return sum + monthlyValue
  }, 0)

  // Expired last month (churn)
  const churnedLastMonth = await prisma.subscription.count({
    where: {
      status: 'EXPIRED',
      expiresAt: { gte: startOfLastMonth, lte: endOfLastMonth },
    },
  })

  // Revenue by month (last 6 months)
  const revenueByMonth = await prisma.subscription.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      },
    },
    _count: { id: true },
  })

  return NextResponse.json({
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
  })
}
