import { NextRequest, NextResponse } from 'next/server'
import type { PaymentGatewayId } from '@/lib/payment-gateways/types'
import { processPaymentWebhook } from '@/lib/payment-gateways/process-webhook'

export async function POST(
  request: NextRequest,
  { params }: { params: { gateway: string } },
) {
  return processPaymentWebhook(request, params.gateway as PaymentGatewayId)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { gateway: string } },
) {
  return NextResponse.json({ status: 'ok', service: 'IPTV Gateway Webhook', gateway: params.gateway })
}
