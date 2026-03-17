import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────
// POST /api/payment/pix
// Body: { planId, resellerId? }  — creates a PIX charge via Mercado Pago
// ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const body = await request.json()
  const { planId, resellerId } = body

  // Validate plan
  const plan = await prisma.plan.findUnique({ where: { id: planId, active: true } })
  if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Expire any old pending payments for this user/plan
  await prisma.payment.updateMany({
    where: { userId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })

  // Create a PENDING subscription (activated on webhook)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + plan.durationDays)

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: 'PENDING_PAYMENT',
      expiresAt,
      resellerId: resellerId || null,
      username: user.email,
      password: Math.random().toString(36).slice(2, 10),
    },
  })

  // ── Call Mercado Pago PIX API ──────────────────────────
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!mpAccessToken) {
    return NextResponse.json({ error: 'Mercado Pago não configurado. Adicione MERCADOPAGO_ACCESS_TOKEN ao .env' }, { status: 503 })
  }

  const pixExpiresAt = new Date()
  pixExpiresAt.setHours(pixExpiresAt.getHours() + 24) // 24h to pay

  const idempotencyKey = `sub-${subscription.id}-${Date.now()}`

  const mpPayload = {
    transaction_amount: plan.price,
    description: `StreamBox Pro — Plano ${plan.name}`,
    payment_method_id: 'pix',
    date_of_expiration: pixExpiresAt.toISOString(),
    payer: {
      email: user.email,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || 'Cliente',
    },
    notification_url: `${process.env.NEXTAUTH_URL}/api/payment/webhook`,
    metadata: {
      subscription_id: subscription.id,
      user_id: userId,
      plan_id: planId,
      reseller_id: resellerId || null,
    },
  }

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mpAccessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(mpPayload),
  })

  if (!mpRes.ok) {
    const err = await mpRes.text()
    console.error('[PIX] Mercado Pago error:', err)
    // Clean up the pending subscription
    await prisma.subscription.delete({ where: { id: subscription.id } })
    return NextResponse.json({ error: 'Erro ao gerar PIX. Tente novamente.' }, { status: 502 })
  }

  const mpData = await mpRes.json()

  const pixCode = mpData.point_of_interaction?.transaction_data?.qr_code || null
  const pixQRCode = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null

  // Save payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      planId,
      subscriptionId: subscription.id,
      resellerId: resellerId || null,
      mpPaymentId: String(mpData.id),
      mpStatus: mpData.status,
      pixCode,
      pixQRCode,
      amount: plan.price,
      status: 'PENDING',
      expiresAt: pixExpiresAt,
    },
  })

  return NextResponse.json({
    paymentId: payment.id,
    pixCode,
    pixQRCode,
    amount: plan.price,
    planName: plan.name,
    expiresAt: pixExpiresAt.toISOString(),
    subscriptionId: subscription.id,
  })
}

// ─────────────────────────────────────────────────────────
// GET /api/payment/pix?paymentId=xxx — poll payment status
// ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const paymentId = request.nextUrl.searchParams.get('paymentId')
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: { select: { status: true } } },
  })

  if (!payment || payment.userId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: payment.status,
    mpStatus: payment.mpStatus,
    subscriptionActive: payment.subscription?.status === 'ACTIVE',
    paidAt: payment.paidAt,
  })
}
