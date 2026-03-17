import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const status: string = mpPayment.status // approved | rejected | pending | cancelled
    const metadata = mpPayment.metadata || {}

    console.log(`[Webhook] Payment ${mpPaymentId} status: ${status}`)

    // Find our payment record
    const payment = await prisma.payment.findUnique({
      where: { mpPaymentId },
      include: { subscription: true },
    })

    if (!payment) {
      // Try to find by metadata
      console.warn('[Webhook] Payment not found in DB for mpPaymentId:', mpPaymentId)
      return NextResponse.json({ received: true })
    }

    // Map MP status to our status
    const ourStatus = status === 'approved'
      ? 'APPROVED'
      : status === 'rejected' || status === 'cancelled'
      ? 'REJECTED'
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

    // If approved, activate the subscription
    if (status === 'approved' && payment.subscriptionId) {
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
