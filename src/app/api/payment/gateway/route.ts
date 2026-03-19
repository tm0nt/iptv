import { NextResponse } from 'next/server'
import { resolvePixGateway } from '@/lib/payment-gateways/service'

export async function GET() {
  try {
    const { gateway, gatewayId } = await resolvePixGateway()

    return NextResponse.json({
      gatewayId,
      gatewayLabel: gateway.label,
      customerDocumentMode: gateway.customerDocumentMode,
      requiresCustomerDocument: gateway.customerDocumentMode === 'required',
    })
  } catch {
    return NextResponse.json({
      gatewayId: null,
      gatewayLabel: 'PIX',
      customerDocumentMode: 'none',
      requiresCustomerDocument: false,
    })
  }
}
