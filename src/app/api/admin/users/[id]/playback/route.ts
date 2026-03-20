import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAdminPlaybackDetails } from '@/lib/account-playback'
import { ensurePlanSchema, getPlanFlags } from '@/lib/plan-schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensurePlanSchema()

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      role: true,
      subscriptions: {
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'desc' },
        take: 1,
        select: {
          id: true,
          expiresAt: true,
          plan: {
            select: {
              id: true,
              name: true,
              maxDevices: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  if (user.role !== 'CLIENT') {
    return NextResponse.json({
      profiles: [],
      activeSessions: [],
      activePlan: null,
    })
  }

  const details = await getAdminPlaybackDetails(user.id)
  const activeSubscription = user.subscriptions[0] || null
  const activePlanFlags = await getPlanFlags(activeSubscription?.plan.id)

  return NextResponse.json({
    ...details,
    activePlan: activeSubscription ? {
      name: activeSubscription.plan.name,
      maxDevices: activeSubscription.plan.maxDevices,
      isUnlimited: activePlanFlags.isUnlimited,
      expiresAt: activeSubscription.expiresAt,
    } : null,
  })
}
