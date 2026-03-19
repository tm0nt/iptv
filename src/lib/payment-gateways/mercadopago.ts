import { NextResponse, type NextRequest } from 'next/server'
import type {
  PaymentGateway,
  PaymentGatewayAdminConfig,
  PaymentWebhookResult,
  PixChargeInput,
} from '@/lib/payment-gateways/types'

export const mercadoPagoGateway: PaymentGateway = {
  id: 'mercadopago',
  label: 'Mercado Pago',
  customerDocumentMode: 'none',
  isConfigured(config: PaymentGatewayAdminConfig) {
    return !!config.mercadopagoAccessToken.trim()
  },
  async createPixCharge(input: PixChargeInput, config: PaymentGatewayAdminConfig) {
    const mpPayload = {
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: 'pix',
      date_of_expiration: input.expiresAt.toISOString(),
      payer: {
        email: input.customer.email,
        first_name: input.customer.name.split(' ')[0],
        last_name: input.customer.name.split(' ').slice(1).join(' ') || 'Cliente',
      },
      notification_url: input.webhookUrl,
      metadata: input.metadata,
    }

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.mercadopagoAccessToken}`,
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    })

    if (!mpRes.ok) {
      const err = await mpRes.text()
      console.error('[PIX][MercadoPago] error:', err)
      throw new Error('Erro ao gerar PIX no Mercado Pago.')
    }

    const mpData = await mpRes.json()

    return {
      externalPaymentId: String(mpData.id),
      gatewayStatus: mpData.status || 'pending',
      pixCode: mpData.point_of_interaction?.transaction_data?.qr_code || null,
      pixQRCode: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      expiresAt: input.expiresAt,
      raw: mpData,
    }
  },
  async handleWebhook(request: NextRequest, config: PaymentGatewayAdminConfig): Promise<PaymentWebhookResult | NextResponse> {
    const body = await request.json()
    const { type, data } = body

    if (type !== 'payment') {
      return NextResponse.json({ received: true, ignored: true })
    }

    const externalPaymentId = String(data?.id || '')
    if (!externalPaymentId) {
      return NextResponse.json({ error: 'No payment id' }, { status: 400 })
    }

    if (!config.mercadopagoAccessToken) {
      return NextResponse.json({ error: 'Mercado Pago not configured' }, { status: 500 })
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${externalPaymentId}`, {
      headers: { Authorization: `Bearer ${config.mercadopagoAccessToken}` },
    })

    if (!mpRes.ok) {
      return NextResponse.json({ error: 'Mercado Pago fetch error' }, { status: 502 })
    }

    const mpPayment = await mpRes.json()
    const status = String(mpPayment.status || 'pending')

    return {
      externalPaymentId,
      gatewayStatus: status,
      normalizedStatus:
        status === 'approved'
          ? 'APPROVED'
          : status === 'rejected' || status === 'cancelled'
            ? 'REJECTED'
            : 'PENDING',
      metadata: {
        provider: 'mercadopago',
        paymentType: mpPayment.payment_type_id || null,
        detail: mpPayment.status_detail || null,
      },
    }
  },
}
