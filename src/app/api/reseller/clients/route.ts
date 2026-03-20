import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { ensurePlanSchema, getPlanFlags } from '@/lib/plan-schema'
import { createPlanExpiryDate, isAdminOnlyPlan } from '@/lib/plan-utils'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!session || !user || !user.role || !['ADMIN', 'RESELLER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const page = parseInt(new URL(request.url).searchParams.get('page') || '1')
  const limit = 20
  const resellerId = user.id

  const [subs, total] = await Promise.all([
    prisma.subscription.findMany({
      where: { resellerId },
      include: {
        user: { select: { id: true, name: true, email: true, active: true } },
        plan: { select: { name: true, price: true, interval: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where: { resellerId } }),
  ])

  return NextResponse.json({ subscriptions: subs, total })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const reseller = session?.user
  if (!session || !reseller || !reseller.role || !['ADMIN', 'RESELLER'].includes(reseller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json()
  await ensurePlanSchema()

  // Create user + subscription
  const hashed = await bcrypt.hash(body.password || 'mudar123', 12)

  const newUser = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashed,
      role: 'CLIENT',
      active: true,
    },
  })

  const plan = await prisma.plan.findUnique({ where: { id: body.planId } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  const planWithFlags = { ...plan, ...(await getPlanFlags(plan.id)) }
  if (reseller.role === 'RESELLER' && isAdminOnlyPlan(planWithFlags)) {
    return NextResponse.json({ error: 'Este plano é exclusivo do admin.' }, { status: 403 })
  }
  const expiresAt = createPlanExpiryDate(planWithFlags)

  const sub = await prisma.subscription.create({
    data: {
      userId: newUser.id,
      planId: body.planId,
      status: 'ACTIVE',
      expiresAt,
      autoRenew: !planWithFlags.isUnlimited,
      resellerId: reseller.id,
      username: body.username || newUser.email,
      password: body.iptv_password || Math.random().toString(36).slice(2, 10),
    },
  })

  await logAuditEvent({
    action: 'reseller.client.created',
    entityType: 'USER',
    entityId: newUser.id,
    message: `Cliente ${newUser.email} criado pelo revendedor`,
    actor: reseller,
    ipAddress,
    userAgent,
    metadata: {
      subscriptionId: sub.id,
      planId: body.planId,
      resellerId: reseller.id,
    },
  })

  return NextResponse.json({ user: newUser, subscription: sub }, { status: 201 })
}
