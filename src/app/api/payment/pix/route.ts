import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPublicSystemConfig } from '@/lib/system-config'
import { resolvePixGateway } from '@/lib/payment-gateways/service'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { ensurePlanSchema, getPlanFlags } from '@/lib/plan-schema'
import { createPlanExpiryDate, isAdminOnlyPlan } from '@/lib/plan-utils'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const userId = session.user.id
  const body = await request.json()
  const { planId, resellerId, referralCode, clientUserId, customerDocument } = body
  const normalizedDocument = typeof customerDocument === 'string'
    ? customerDocument.replace(/\D/g, '').slice(0, 14)
    : ''

  const requesterRole = session.user.role
  const targetUserId = clientUserId || userId
  const actingForAnotherUser = targetUserId !== userId

  if (actingForAnotherUser && !['ADMIN', 'RESELLER'].includes(requesterRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensurePlanSchema()
  const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } })
  if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  const planWithFlags = { ...plan, ...(await getPlanFlags(plan.id)) }
  if (isAdminOnlyPlan(planWithFlags) && requesterRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Este plano só pode ser entregue pelo admin.' }, { status: 403 })
  }

  const resolvedReseller = await resolveReseller({ resellerId, referralCode })
  if (actingForAnotherUser && requesterRole === 'RESELLER' && resolvedReseller?.id !== userId) {
    return NextResponse.json({ error: 'Revendedor inválido para esta cobrança.' }, { status: 403 })
  }

  if (normalizedDocument && !isValidCpf(normalizedDocument)) {
    return NextResponse.json({ error: 'CPF inválido para gerar o PIX.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  let userPhone: string | null = null
  try {
    const phoneRows = await prisma.$queryRaw<Array<{ phone: string | null }>>`
      SELECT "phone"
      FROM "users"
      WHERE "id" = ${targetUserId}
      LIMIT 1
    `
    userPhone = phoneRows[0]?.phone || null
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2010') {
      throw error
    }

    const rawMessage = typeof error.meta?.message === 'string' ? error.meta.message : ''
    if (!rawMessage.includes('column "phone"')) {
      throw error
    }
  }

  await prisma.payment.updateMany({
    where: { userId: targetUserId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })

  const expiresAt = createPlanExpiryDate(planWithFlags)

  const subscription = await prisma.subscription.create({
    data: {
      userId: targetUserId,
      planId,
      status: 'PENDING_PAYMENT',
      expiresAt,
      autoRenew: !planWithFlags.isUnlimited,
      resellerId: resolvedReseller?.id || null,
      username: user.email,
      password: Math.random().toString(36).slice(2, 10),
    },
  })

  try {
    const { gateway, gatewayId, config } = await resolvePixGateway()
    const branding = await getPublicSystemConfig()
    const pixExpiresAt = new Date()
    pixExpiresAt.setHours(pixExpiresAt.getHours() + 24)

    const charge = await gateway.createPixCharge({
      amount: plan.price,
      description: `${branding.siteName} — Plano ${plan.name}`,
      customer: {
        name: user.name,
        email: user.email,
        phone: userPhone,
        document: normalizedDocument || null,
      },
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/payment/webhook/${gatewayId}`,
      expiresAt: pixExpiresAt,
      metadata: {
        gateway: gatewayId,
        subscription_id: subscription.id,
        user_id: targetUserId,
        plan_id: planId,
        reseller_id: resolvedReseller?.id || null,
      },
      idempotencyKey: `${gatewayId}-sub-${subscription.id}-${Date.now()}`,
    }, config)

    const payment = await prisma.payment.create({
      data: {
        userId: targetUserId,
        planId,
        subscriptionId: subscription.id,
        resellerId: resolvedReseller?.id || null,
        mpPaymentId: charge.externalPaymentId,
        mpStatus: charge.gatewayStatus,
        pixCode: charge.pixCode,
        pixQRCode: charge.pixQRCode,
        amount: plan.price,
        status: 'PENDING',
        expiresAt: charge.expiresAt,
      },
    })

    await logAuditEvent({
      action: 'payment.pix.created',
      entityType: 'PAYMENT',
      entityId: payment.id,
      message: `Pagamento PIX criado via ${gateway.label} para o plano ${plan.name}`,
      actor: session.user,
      ipAddress,
      userAgent,
      metadata: {
        gateway: gatewayId,
        planId: plan.id,
        subscriptionId: subscription.id,
        resellerId: resolvedReseller?.id || null,
        amount: plan.price,
        externalPaymentId: charge.externalPaymentId,
        targetUserId,
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      pixCode: charge.pixCode,
      pixQRCode: charge.pixQRCode,
      amount: plan.price,
      planName: plan.name,
      expiresAt: charge.expiresAt.toISOString(),
      subscriptionId: subscription.id,
      gateway: gatewayId,
      gatewayLabel: gateway.label,
    })
  } catch (error) {
    await prisma.subscription.delete({ where: { id: subscription.id } }).catch(() => {})
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao gerar PIX. Tente novamente.',
    }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const paymentId = request.nextUrl.searchParams.get('paymentId')
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: { select: { status: true } } },
  })

  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: payment.status,
    mpStatus: payment.mpStatus,
    subscriptionActive: payment.subscription?.status === 'ACTIVE',
    paidAt: payment.paidAt,
  })
}

async function resolveReseller({
  resellerId,
  referralCode,
}: {
  resellerId?: string | null
  referralCode?: string | null
}) {
  const normalizedCode = referralCode?.trim().toUpperCase()
  const normalizedId = resellerId?.trim()

  if (normalizedId) {
    const byId = await prisma.user.findFirst({
      where: { id: normalizedId, role: 'RESELLER', active: true },
      select: { id: true, referralCode: true, name: true },
    })
    if (byId) return byId

    const byCode = await prisma.user.findFirst({
      where: { referralCode: normalizedId.toUpperCase(), role: 'RESELLER', active: true },
      select: { id: true, referralCode: true, name: true },
    })
    if (byCode) return byCode
  }

  if (normalizedCode) {
    return prisma.user.findFirst({
      where: { referralCode: normalizedCode, role: 'RESELLER', active: true },
      select: { id: true, referralCode: true, name: true },
    })
  }

  return null
}

function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '').slice(0, 11)

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index)
  }

  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index)
  }

  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}
