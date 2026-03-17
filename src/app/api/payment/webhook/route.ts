import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────
// Validates the x-signature header sent by Mercado Pago
// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
// ─────────────────────────────────────────────────────────
function validateMPSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    // If secret not configured, skip validation (warn in logs)
    console.warn('[Webhook] MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature validation')
    return true
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  if (!xSignature) {
    console.warn('[Webhook] Missing x-signature header')
    return false
  }

  // Parse ts and v1 from "ts=...,v1=..."
  let ts: string | null = null
  let v1: string | null = null
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=')
    if (key?.trim() === 'ts') ts = value?.trim() ?? null
    if (key?.trim() === 'v1') v1 = value?.trim() ?? null
  }

  if (!ts || !v1) {
    console.warn('[Webhook] Malformed x-signature header:', xSignature)
    return false
  }

  // Build the signed template — omit missing fields per MP docs
  const parts: string[] = []
  if (dataId) parts.push(`id:${dataId}`)
  if (xRequestId) parts.push(`request-id:${xRequestId}`)
  if (ts) parts.push(`ts:${ts}`)
  const manifest = parts.join(';') + ';'

  const computed = createHmac('sha256', secret).update(manifest).digest('hex')

  if (computed !== v1) {
    console.error('[Webhook] Signature mismatch. Expected:', computed, 'Got:', v1)
    return false
  }

  return true
}

// ─────────────────────────────────────────────────────────
// POST /api/payment/webhook
// Mercado Pago calls this when a payment status changes
// ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Webhook] MP event received:', JSON.stringify(body, null, 2))

    // MP sends different event types
    const { type, data } = body

    if (type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const mpPaymentId = String(data?.id)
    if (!mpPaymentId) {
      return NextResponse.json({ error: 'No payment id' }, { status: 400 })
    }

    // Validate HMAC signature before processing
    if (!validateMPSignature(request, mpPaymentId)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Fetch the actual payment details from MP to verify status
    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!mpAccessToken) {
      console.error('[Webhook] MERCADOPAGO_ACCESS_TOKEN not set')
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    })

    if (!mpRes.ok) {
      console.error('[Webhook] Could not fetch payment from MP')
      return NextResponse.json({ error: 'MP fetch error' }, { status: 502 })
    }

    const mpPayment = await mpRes.json()
    const status: string = mpPayment.status // approved | rejected | pending | cancelled | expired

    console.log(`[Webhook] Payment ${mpPaymentId} status: ${status}`)

    // Find our payment record
    const payment = await prisma.payment.findUnique({
      where: { mpPaymentId },
      include: { subscription: true },
    })

    if (!payment) {
      console.warn('[Webhook] Payment not found in DB for mpPaymentId:', mpPaymentId)
      return NextResponse.json({ received: true })
    }

    // Map MP status to our status
    const ourStatus =
      status === 'approved'
        ? 'APPROVED'
        : status === 'rejected' || status === 'cancelled'
        ? 'REJECTED'
        : status === 'expired'
        ? 'EXPIRED'
        : 'PENDING'

    // Update payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        mpStatus: status,
        status: ourStatus as any,
        paidAt: status === 'approved' ? new Date() : null,
      },
    })

    // If approved, activate the subscription (guard against double-activation)
    if (status === 'approved' && payment.subscriptionId) {
      const alreadyActive = payment.subscription?.status === 'ACTIVE'
      if (alreadyActive) {
        console.log(`[Webhook] Subscription ${payment.subscriptionId} already ACTIVE — skipping`)
        return NextResponse.json({ received: true, status: ourStatus })
      }

      const plan = await prisma.plan.findUnique({ where: { id: payment.planId } })
      const expiresAt = new Date()
      if (plan) expiresAt.setDate(expiresAt.getDate() + plan.durationDays)

      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt,
        },
      })

      // If affiliated, mark click as converted
      if (payment.resellerId) {
        await prisma.affiliateClick.updateMany({
          where: {
            resellerId: payment.resellerId,
            converted: false,
          },
          data: { converted: true },
          // Only update the most recent click
        })
      }

      console.log(`[Webhook] ✅ Subscription ${payment.subscriptionId} ACTIVATED`)
    }

    // If expired, also mark the subscription as SUSPENDED
    if ((status === 'expired' || status === 'cancelled') && payment.subscriptionId) {
      const sub = payment.subscription
      if (sub && sub.status === 'PENDING_PAYMENT') {
        await prisma.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'SUSPENDED' },
        })
        console.log(`[Webhook] Subscription ${payment.subscriptionId} marked SUSPENDED (payment ${status})`)
      }
    }

    return NextResponse.json({ received: true, status: ourStatus })
  } catch (err) {
    console.error('[Webhook] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// MP might send GET to validate the webhook endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'StreamBox Webhook' })
}
