import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { ensurePlanSchema, getPlanFlagsMap } from '@/lib/plan-schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  await ensurePlanSchema()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          plan: true,
          payment: { select: { status: true, paidAt: true, amount: true } },
        },
      },
    },
  })
  const planFlagsMap = await getPlanFlagsMap(user?.subscriptions.map(subscription => subscription.plan.id) || [])

  return NextResponse.json({
    user: user ? {
      ...user,
      subscriptions: user.subscriptions.map(subscription => ({
        ...subscription,
        plan: {
          ...subscription.plan,
          ...(planFlagsMap.get(subscription.plan.id) || { adminOnly: false, isUnlimited: false }),
        },
      })),
    } : null,
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body   = await request.json()

  const data: any = {}
  if (body.name?.trim()) data.name = body.name.trim()

  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: 'Senha atual obrigatória' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const ok   = await bcrypt.compare(body.currentPassword, user!.password)
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    if (body.newPassword.length < 6) {
      return NextResponse.json({ error: 'Nova senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }
    data.password = await bcrypt.hash(body.newPassword, 12)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nenhuma alteração enviada' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true },
  })

  await logAuditEvent({
    action: 'user.profile.updated',
    entityType: 'USER',
    entityId: updated.id,
    message: 'Usuário atualizou o próprio perfil',
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: {
      changedName: !!data.name,
      changedPassword: !!data.password,
    },
  })

  return NextResponse.json({ user: updated })
}
