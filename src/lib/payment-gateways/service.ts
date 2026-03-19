import { advanceGatewayRotationCursor, getConfiguredImplementedGateways, getGatewayById } from '@/lib/payment-gateways'
import type { PaymentGateway } from '@/lib/payment-gateways/types'
import { getPaymentGatewayConfig } from '@/lib/system-config'

export async function resolvePixGateway(): Promise<{
  gateway: PaymentGateway
  gatewayId: string
  config: Awaited<ReturnType<typeof getPaymentGatewayConfig>>
}> {
  const config = await getPaymentGatewayConfig()
  const configured = getConfiguredImplementedGateways(config)

  if (configured.length === 0) {
    throw new Error('Nenhum gateway de pagamento configurado e ativo.')
  }

  if (config.mode === 'round_robin' && configured.length > 1) {
    const index = config.rotationCursor % configured.length
    const gateway = configured[index]
    await advanceGatewayRotationCursor(index, configured.length)
    return { gateway, gatewayId: gateway.id, config }
  }

  const preferred = getGatewayById(config.provider)
  if (preferred && preferred.isConfigured(config)) {
    return { gateway: preferred, gatewayId: preferred.id, config }
  }

  return { gateway: configured[0], gatewayId: configured[0].id, config }
}
