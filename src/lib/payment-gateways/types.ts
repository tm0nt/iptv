import type { NextRequest, NextResponse } from 'next/server'

export const PAYMENT_GATEWAY_IDS = [
  'mercadopago',
  'expfypay',
  'asaas',
  'efi',
  'pagseguro',
  'pagarme',
  'iugu',
  'stripe',
  'openpix',
  'pushinpay',
  'appmax',
] as const

export type PaymentGatewayId = (typeof PAYMENT_GATEWAY_IDS)[number]
export type PaymentGatewayMode = 'single' | 'round_robin'

export type PaymentGatewayDescriptor = {
  id: PaymentGatewayId
  label: string
  description: string
  implemented: boolean
}

export type PaymentGatewayAdminConfig = {
  provider: PaymentGatewayId
  mode: PaymentGatewayMode
  enabled: PaymentGatewayId[]
  mercadopagoAccessToken: string
  expfypayPublicKey: string
  expfypaySecretKey: string
}

export type PixChargeInput = {
  amount: number
  description: string
  customer: {
    name: string
    email: string
    phone?: string | null
    document?: string | null
  }
  webhookUrl: string
  expiresAt: Date
  metadata: Record<string, unknown>
  idempotencyKey: string
}

export type PixChargeResult = {
  externalPaymentId: string
  gatewayStatus: string
  pixCode: string | null
  pixQRCode: string | null
  expiresAt: Date
  raw: unknown
}

export type PaymentWebhookResult = {
  externalPaymentId: string
  gatewayStatus: string
  normalizedStatus: 'APPROVED' | 'REJECTED' | 'PENDING'
  metadata?: Record<string, unknown>
}

export interface PaymentGateway {
  id: PaymentGatewayId
  label: string
  customerDocumentMode: 'none' | 'optional' | 'required'
  isConfigured(config: PaymentGatewayAdminConfig): boolean
  createPixCharge(input: PixChargeInput, config: PaymentGatewayAdminConfig): Promise<PixChargeResult>
  handleWebhook(request: NextRequest, config: PaymentGatewayAdminConfig): Promise<PaymentWebhookResult | NextResponse>
}
