import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPaymentGatewayConfig } from '@/lib/system-config'
import { getGatewayById } from '@/lib/payment-gateways'
import type { PaymentGatewayId } from '@/lib/payment-gateways/types'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { ensurePlanSchema, getPlanFlags } from '@/lib/plan-schema'
import { createPlanExpiryDate } from '@/lib/plan-utils'

export async function processPaymentWebhook(request: NextRequest, gatewayId: PaymentGatewayId) {
  await ensurePlanSchema()
  const gateway = getGatewayById(gatewayId)
  if (!gateway) {
    return NextResponse.json({ error: 'Gateway inválido' }, { status: 404 })
  }

  const config = await getPaymentGatewayConfig()
  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const result = await gateway.handleWebhook(request, config)

  if (result instanceof NextResponse) {
    return result
  }

  let payment = await prisma.payment.findUnique({
    where: { mpPaymentId: result.externalPaymentId },
    include: { subscription: true },
  })

  const externalSubscriptionId = typeof result.metadata?.externalId === 'string'
    ? result.metadata.externalId
    : null

  if (!payment && externalSubscriptionId) {
    payment = await prisma.payment.findFirst({
      where: { subscriptionId: externalSubscriptionId },
      include: { subscription: true },
    })
  }

  if (!payment) {
    return NextResponse.json({ received: true, ignored: true })
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      mpStatus: result.gatewayStatus,
      status: result.normalizedStatus,
      paidAt: result.normalizedStatus === 'APPROVED' ? new Date() : null,
    },
  })

  await logAuditEvent({
    action: 'payment.webhook.received',
    entityType: 'PAYMENT',
    entityId: payment.id,
    message: `Webhook do gateway ${gateway.label} recebido com status ${result.gatewayStatus}`,
    actor: { role: 'SYSTEM', email: `${gateway.id}@webhook.local` },
    ipAddress,
    userAgent,
    metadata: {
      gateway: gateway.id,
      externalPaymentId: result.externalPaymentId,
      status: result.gatewayStatus,
      normalizedStatus: result.normalizedStatus,
      subscriptionId: payment.subscriptionId,
      ...(result.metadata || {}),
    },
  })

  if (result.normalizedStatus === 'APPROVED' && payment.subscriptionId) {
    const plan = await prisma.plan.findUnique({ where: { id: payment.planId } })
    const planWithFlags = plan ? { ...plan, ...(await getPlanFlags(plan.id)) } : undefined
    const expiresAt = createPlanExpiryDate(planWithFlags)

    await prisma.subscription.updateMany({
      where: {
        userId: payment.userId,
        id: { not: payment.subscriptionId },
        status: { in: ['ACTIVE', 'TRIAL'] },
      },
      data: {
        status: 'EXPIRED',
      },
    })

    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: 'ACTIVE',
        startsAt: new Date(),
        expiresAt,
        autoRenew: !planWithFlags?.isUnlimited,
      },
    })

    await logAuditEvent({
      action: 'subscription.activated',
      entityType: 'SUBSCRIPTION',
      entityId: payment.subscriptionId,
      message: `Assinatura ativada automaticamente pelo gateway ${gateway.label}`,
      actor: { role: 'SYSTEM', email: `${gateway.id}@webhook.local` },
      ipAddress,
      userAgent,
      metadata: {
        gateway: gateway.id,
        paymentId: payment.id,
        resellerId: payment.resellerId,
        userId: payment.userId,
      },
    })

    if (payment.resellerId) {
      await prisma.affiliateClick.updateMany({
        where: {
          resellerId: payment.resellerId,
          converted: false,
        },
        data: { converted: true },
      })
    }
  }

  return NextResponse.json({ received: true, status: result.normalizedStatus, gateway: gateway.id })
}
