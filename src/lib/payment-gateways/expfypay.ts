import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import type {
  PaymentGateway,
  PaymentGatewayAdminConfig,
  PaymentWebhookResult,
  PixChargeInput,
} from '@/lib/payment-gateways/types'

const EXPFY_BASE_URL = 'https://pro.expfypay.com/api/v1'

function getStringValue(source: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    let current: any = source
    for (const key of path) {
      current = current?.[key]
    }

    if (typeof current === 'string' && current.trim()) {
      return current.trim()
    }

    if (typeof current === 'number' && Number.isFinite(current)) {
      return String(current)
    }
  }

  return null
}

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase()

  if (['completed', 'confirmed', 'paid', 'approved', 'success'].includes(normalized)) {
    return 'APPROVED' as const
  }

  if (['rejected', 'cancelled', 'canceled', 'failed', 'expired'].includes(normalized)) {
    return 'REJECTED' as const
  }

  return 'PENDING' as const
}

function parseExpiresAt(raw: unknown, fallback: Date) {
  if (typeof raw !== 'string') return fallback
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export const expfyPayGateway: PaymentGateway = {
  id: 'expfypay',
  label: 'EXPFY Pay',
  customerDocumentMode: 'required',
  isConfigured(config: PaymentGatewayAdminConfig) {
    return !!config.expfypayPublicKey.trim() && !!config.expfypaySecretKey.trim()
  },
  async createPixCharge(input: PixChargeInput, config: PaymentGatewayAdminConfig) {
    const customerPayload = {
      name: input.customer.name,
      email: input.customer.email,
      ...(input.customer.document ? { document: input.customer.document } : {}),
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    }

    const payload = {
      amount: input.amount,
      description: input.description,
      customer: customerPayload,
      external_id: String(input.metadata.subscription_id || input.idempotencyKey),
      callback_url: input.webhookUrl,
    }

    const response = await fetch(`${EXPFY_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Key': config.expfypayPublicKey,
        'X-Secret-Key': config.expfypaySecretKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[PIX][EXPFY Pay] error:', err)
      throw new Error('Erro ao gerar PIX no EXPFY Pay.')
    }

    const data = await response.json()
    const externalPaymentId = getStringValue(data, [
      ['transaction_id'],
      ['id'],
      ['payment_id'],
      ['data', 'transaction_id'],
      ['data', 'id'],
    ])

    if (!externalPaymentId) {
      throw new Error('EXPFY Pay respondeu sem identificador da cobrança.')
    }

    return {
      externalPaymentId,
      gatewayStatus: getStringValue(data, [['status'], ['data', 'status']]) || 'pending',
      pixCode: getStringValue(data, [
        ['pix_code'],
        ['pixCopyPaste'],
        ['copy_paste'],
        ['qr_code'],
        ['pix', 'copy_paste'],
        ['pix', 'qr_code'],
        ['pix_data', 'qr_code'],
        ['data', 'pix_code'],
        ['data', 'copy_paste'],
      ]),
      pixQRCode: getStringValue(data, [
        ['qr_code_base64'],
        ['qrcode_base64'],
        ['pix', 'qr_code_base64'],
        ['pix_data', 'qr_code_base64'],
        ['data', 'qr_code_base64'],
      ]),
      expiresAt: parseExpiresAt(
        getStringValue(data, [['expires_at'], ['expiration_date'], ['data', 'expires_at']]),
        input.expiresAt,
      ),
      raw: data,
    }
  },
  async handleWebhook(request: NextRequest, config: PaymentGatewayAdminConfig): Promise<PaymentWebhookResult | NextResponse> {
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature') || request.headers.get('X-Signature') || ''

    if (!signature) {
      return NextResponse.json({ error: 'Assinatura ausente' }, { status: 401 })
    }

    const expected = crypto
      .createHmac('sha256', config.expfypaySecretKey)
      .update(rawBody)
      .digest('hex')

    const receivedBuffer = Buffer.from(signature.trim())
    const expectedBuffer = Buffer.from(expected)

    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const event = String(body?.event || '')
    const externalPaymentId = getStringValue(body, [['transaction_id'], ['payment_id'], ['id']])

    if (!externalPaymentId) {
      return NextResponse.json({ error: 'Identificador do pagamento ausente' }, { status: 400 })
    }

    const status = String(body?.status || (event === 'payment.confirmed' ? 'completed' : 'pending'))

    return {
      externalPaymentId,
      gatewayStatus: status,
      normalizedStatus: normalizeStatus(status),
      metadata: {
        provider: 'expfypay',
        event,
        externalId: body?.external_id || null,
        amount: body?.amount ?? null,
        paidAt: body?.paid_at || body?.updated_at || null,
      },
    }
  },
}
