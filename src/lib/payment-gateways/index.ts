import { prisma } from '@/lib/prisma'
import { expfyPayGateway } from '@/lib/payment-gateways/expfypay'
import { mercadoPagoGateway } from '@/lib/payment-gateways/mercadopago'
import type {
  PaymentGateway,
  PaymentGatewayAdminConfig,
  PaymentGatewayDescriptor,
  PaymentGatewayId,
} from '@/lib/payment-gateways/types'

export const PAYMENT_GATEWAY_OPTIONS: PaymentGatewayDescriptor[] = [
  {
    id: 'mercadopago',
    label: 'Mercado Pago',
    description: 'PIX e webhook prontos para uso imediato.',
    implemented: true,
  },
  {
    id: 'expfypay',
    label: 'EXPFY Pay',
    description: 'PIX com webhook assinado por HMAC e pronto para operar pelo painel.',
    implemented: true,
  },
  { id: 'asaas', label: 'Asaas', description: 'Preparado para integração futura.', implemented: false },
  { id: 'efi', label: 'Efí', description: 'Preparado para integração futura.', implemented: false },
  { id: 'pagseguro', label: 'PagSeguro', description: 'Preparado para integração futura.', implemented: false },
  { id: 'pagarme', label: 'Pagar.me', description: 'Preparado para integração futura.', implemented: false },
  { id: 'iugu', label: 'Iugu', description: 'Preparado para integração futura.', implemented: false },
  { id: 'stripe', label: 'Stripe', description: 'Preparado para integração futura.', implemented: false },
  { id: 'openpix', label: 'OpenPix', description: 'Preparado para integração futura.', implemented: false },
  { id: 'pushinpay', label: 'PushinPay', description: 'Preparado para integração futura.', implemented: false },
  { id: 'appmax', label: 'Appmax', description: 'Preparado para integração futura.', implemented: false },
]

const gatewayRegistry: Partial<Record<PaymentGatewayId, PaymentGateway>> = {
  mercadopago: mercadoPagoGateway,
  expfypay: expfyPayGateway,
}

export function getGatewayById(id: PaymentGatewayId) {
  return gatewayRegistry[id] || null
}

export function getImplementedPaymentGateways() {
  return PAYMENT_GATEWAY_OPTIONS.filter(item => item.implemented)
}

export function getConfiguredImplementedGateways(config: PaymentGatewayAdminConfig) {
  return config.enabled
    .map(id => getGatewayById(id))
    .filter((gateway): gateway is PaymentGateway => !!gateway && gateway.isConfigured(config))
}

export async function advanceGatewayRotationCursor(current: number, total: number) {
  const next = total <= 0 ? 0 : (current + 1) % total

  await prisma.systemConfig.upsert({
    where: { key: 'payment_gateway_rotation_cursor' },
    update: { value: String(next) },
    create: { key: 'payment_gateway_rotation_cursor', value: String(next) },
  })

  return next
}
