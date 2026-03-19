import { NextRequest, NextResponse } from 'next/server'
import { getPaymentGatewayConfig } from '@/lib/system-config'
import type { PaymentGatewayId } from '@/lib/payment-gateways/types'
import { processPaymentWebhook } from '@/lib/payment-gateways/process-webhook'

export async function POST(request: NextRequest) {
  const config = await getPaymentGatewayConfig()
  const gateway = (request.nextUrl.searchParams.get('gateway') || config.provider) as PaymentGatewayId
  return processPaymentWebhook(request, gateway)
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'IPTV Payment Webhook Router' })
}
