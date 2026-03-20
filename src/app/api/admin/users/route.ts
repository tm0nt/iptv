import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, type User as DbUser } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { getAdminPlaybackUsage } from '@/lib/account-playback'
import { ensurePlanSchema, getPlanFlags, getPlanFlagsMap } from '@/lib/plan-schema'
import { createPlanExpiryDate } from '@/lib/plan-utils'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

async function assignPlanToClient(tx: Prisma.TransactionClient, user: { id: string; email: string }, planId: string) {
  const plan = await tx.plan.findFirst({
    where: { id: planId, active: true },
    select: {
      id: true,
      name: true,
      durationDays: true,
      maxDevices: true,
    },
  })

  if (!plan) {
    throw new Error('Plano selecionado não foi encontrado.')
  }
  const flags = await getPlanFlags(plan.id)
  const planWithFlags = { ...plan, ...flags }

  await tx.subscription.updateMany({
    where: {
      userId: user.id,
      status: { in: ['ACTIVE', 'TRIAL', 'PENDING_PAYMENT'] },
    },
    data: {
      status: 'EXPIRED',
      autoRenew: false,
    },
  })

  const subscription = await tx.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(),
      expiresAt: createPlanExpiryDate(planWithFlags),
      autoRenew: !planWithFlags.isUnlimited,
      username: user.email,
      password: Math.random().toString(36).slice(2, 10),
    },
  })

  return { plan: planWithFlags, subscription }
}

export async function GET(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await ensurePlanSchema()

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const q = searchParams.get('q')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '20', 10)))

  const where: any = {
    ...(role ? { role } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        active: true, createdAt: true, referralCode: true, commissionRate: true,
        _count: { select: { subscriptions: true, clientsAsReseller: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  const userIds = users.map(user => user.id)
  const [playbackUsage, activeSubscriptions] = await Promise.all([
    getAdminPlaybackUsage(userIds),
    prisma.subscription.findMany({
      where: {
        userId: { in: userIds },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: {
        userId: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxDevices: true,
          },
        },
        expiresAt: true,
      },
      orderBy: { expiresAt: 'desc' },
    }),
  ])

  const usageMap = new Map(playbackUsage.map(item => [item.userId, item]))
  const activePlanMap = new Map<string, { name: string; maxDevices: number; isUnlimited: boolean }>()
  const planFlagsMap = await getPlanFlagsMap(activeSubscriptions.map(subscription => subscription.plan.id))

  for (const subscription of activeSubscriptions) {
    if (!activePlanMap.has(subscription.userId)) {
      const flags = planFlagsMap.get(subscription.plan.id) || { adminOnly: false, isUnlimited: false, id: subscription.plan.id }
      activePlanMap.set(subscription.userId, {
        name: subscription.plan.name,
        maxDevices: subscription.plan.maxDevices,
        isUnlimited: flags.isUnlimited,
      })
    }
  }

  return NextResponse.json({
    users: users.map(user => {
      const usage = usageMap.get(user.id)
      const activePlan = activePlanMap.get(user.id)
      return {
        ...user,
        profilesCount: usage?.profilesCount || 0,
        activeSessionsCount: usage?.activeSessionsCount || 0,
        activePlanName: activePlan?.name || null,
        activePlanMaxDevices: activePlan?.maxDevices || null,
        activePlanIsUnlimited: activePlan?.isUnlimited || false,
      }
    }),
    total,
    page,
    limit,
  })
}

export async function POST(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json()
  const hashed = await bcrypt.hash(body.password, 12)
  const shouldAssignPlan = body.role === 'CLIENT' && body.assignPlanNow && body.planId
  if (shouldAssignPlan) {
    await ensurePlanSchema()
  }

  let user: DbUser
  let assignedPlan: Awaited<ReturnType<typeof assignPlanToClient>> | null = null
  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashed,
          role: body.role || 'CLIENT',
          active: true,
          referralCode: body.role === 'RESELLER' ? generateCode(body.name) : undefined,
          commissionRate: body.role === 'RESELLER' ? (body.commissionRate || 0.20) : undefined,
          parentId: body.role === 'RESELLER' ? (session.user as any).id : undefined,
        },
      })

      const assigned = shouldAssignPlan
        ? await assignPlanToClient(tx, { id: createdUser.id, email: createdUser.email }, String(body.planId))
        : null

      return { user: createdUser, assignedPlan: assigned }
    })
    user = result.user
    assignedPlan = result.assignedPlan
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel criar o usuario.',
    }, { status: 400 })
  }

  await logAuditEvent({
    action: 'admin.user.created',
    entityType: 'USER',
    entityId: user.id,
    message: `Usuário ${user.email} criado pelo admin`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: {
      role: user.role,
      referralCode: user.referralCode || null,
      assignedPlanId: assignedPlan?.plan.id || null,
      assignedPlanName: assignedPlan?.plan.name || null,
      subscriptionId: assignedPlan?.subscription.id || null,
    },
  })

  return NextResponse.json({
    user: { ...user, password: undefined },
    subscription: assignedPlan?.subscription || null,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json()
  const data: any = {
    name: body.name,
    active: body.active,
    commissionRate: body.commissionRate,
  }
  const shouldAssignPlan = body.role === 'CLIENT' && body.assignPlanNow && body.planId
  if (shouldAssignPlan) {
    await ensurePlanSchema()
  }

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 12)
  }

  let user: DbUser
  let assignedPlan: Awaited<ReturnType<typeof assignPlanToClient>> | null = null
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({ where: { id: body.id }, data })
      const assigned = shouldAssignPlan
        ? await assignPlanToClient(tx, { id: updatedUser.id, email: updatedUser.email }, String(body.planId))
        : null

      return { user: updatedUser, assignedPlan: assigned }
    })
    user = result.user
    assignedPlan = result.assignedPlan
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel atualizar o usuario.',
    }, { status: 400 })
  }

  await logAuditEvent({
    action: 'admin.user.updated',
    entityType: 'USER',
    entityId: user.id,
    message: `Usuário ${user.email} atualizado pelo admin`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: {
      active: user.active,
      changedPassword: !!body.password,
      commissionRate: user.commissionRate,
      assignedPlanId: assignedPlan?.plan.id || null,
      assignedPlanName: assignedPlan?.plan.name || null,
      subscriptionId: assignedPlan?.subscription.id || null,
    },
  })

  return NextResponse.json({
    user: { ...user, password: undefined },
    subscription: assignedPlan?.subscription || null,
  })
}

function generateCode(name: string): string {
  const clean = name.toUpperCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${clean}${suffix}`
}
