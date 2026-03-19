import { prisma } from '@/lib/prisma'
import type { PaymentGatewayId, PaymentGatewayMode } from '@/lib/payment-gateways/types'

export const SYSTEM_DEFAULTS = {
  siteName: 'IPTV',
  siteShortName: 'IPTV',
  siteLogoUrl: '/logo-dark.png',
  siteLogoDarkUrl: '/logo-dark.png',
  siteLogoLightUrl: '/logo-white.png',
  primaryColor: '#73de90',
  featuredChannelUuid: '',
  featuredBannerUrl: '',
  supportEmail: 'suporte@iptv.local',
  supportWhatsapp: '',
  pixKey: 'suporte@iptv.local',
  mercadopagoAccessToken: '',
  expfypayPublicKey: '',
  expfypaySecretKey: '',
  paymentGatewayProvider: 'mercadopago',
  paymentGatewayMode: 'single',
  paymentGatewayEnabled: 'mercadopago',
  paymentGatewayRotationCursor: '0',
  defaultPlanId: 'basico',
  defaultCommission: '0.20',
  trialDays: '7',
  auditRetentionDays: '90',
} as const

const KEY_MAP = {
  site_name: 'siteName',
  site_short_name: 'siteShortName',
  site_logo_url: 'siteLogoUrl',
  site_logo_dark_url: 'siteLogoDarkUrl',
  site_logo_light_url: 'siteLogoLightUrl',
  primary_color: 'primaryColor',
  featured_channel_uuid: 'featuredChannelUuid',
  featured_banner_url: 'featuredBannerUrl',
  support_email: 'supportEmail',
  support_whatsapp: 'supportWhatsapp',
  pix_key: 'pixKey',
  mercadopago_access_token: 'mercadopagoAccessToken',
  expfypay_public_key: 'expfypayPublicKey',
  expfypay_secret_key: 'expfypaySecretKey',
  payment_gateway_provider: 'paymentGatewayProvider',
  payment_gateway_mode: 'paymentGatewayMode',
  payment_gateway_enabled: 'paymentGatewayEnabled',
  payment_gateway_rotation_cursor: 'paymentGatewayRotationCursor',
  default_plan_id: 'defaultPlanId',
  commission_default: 'defaultCommission',
  trial_days: 'trialDays',
  audit_retention_days: 'auditRetentionDays',
} as const

type SystemConfigKey = keyof typeof KEY_MAP
type MappedSystemKey = (typeof KEY_MAP)[SystemConfigKey]

type SystemConfigValues = Record<MappedSystemKey, string>

const DEFAULT_VALUES: SystemConfigValues = {
  siteName: SYSTEM_DEFAULTS.siteName,
  siteShortName: SYSTEM_DEFAULTS.siteShortName,
  siteLogoUrl: SYSTEM_DEFAULTS.siteLogoUrl,
  siteLogoDarkUrl: SYSTEM_DEFAULTS.siteLogoDarkUrl,
  siteLogoLightUrl: SYSTEM_DEFAULTS.siteLogoLightUrl,
  primaryColor: SYSTEM_DEFAULTS.primaryColor,
  featuredChannelUuid: SYSTEM_DEFAULTS.featuredChannelUuid,
  featuredBannerUrl: SYSTEM_DEFAULTS.featuredBannerUrl,
  supportEmail: SYSTEM_DEFAULTS.supportEmail,
  supportWhatsapp: SYSTEM_DEFAULTS.supportWhatsapp,
  pixKey: SYSTEM_DEFAULTS.pixKey,
  mercadopagoAccessToken: SYSTEM_DEFAULTS.mercadopagoAccessToken,
  expfypayPublicKey: SYSTEM_DEFAULTS.expfypayPublicKey,
  expfypaySecretKey: SYSTEM_DEFAULTS.expfypaySecretKey,
  paymentGatewayProvider: SYSTEM_DEFAULTS.paymentGatewayProvider,
  paymentGatewayMode: SYSTEM_DEFAULTS.paymentGatewayMode,
  paymentGatewayEnabled: SYSTEM_DEFAULTS.paymentGatewayEnabled,
  paymentGatewayRotationCursor: SYSTEM_DEFAULTS.paymentGatewayRotationCursor,
  defaultPlanId: SYSTEM_DEFAULTS.defaultPlanId,
  defaultCommission: SYSTEM_DEFAULTS.defaultCommission,
  trialDays: SYSTEM_DEFAULTS.trialDays,
  auditRetentionDays: SYSTEM_DEFAULTS.auditRetentionDays,
}

function fromRows(
  rows: Array<{ key: string; value: string }>,
): SystemConfigValues {
  const out = { ...DEFAULT_VALUES }

  for (const row of rows) {
    const mapped = KEY_MAP[row.key as SystemConfigKey]
    if (!mapped) continue
    out[mapped] = row.value
  }

  return out
}

export async function getPublicSystemConfig() {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          'site_name',
          'site_short_name',
          'site_logo_url',
          'site_logo_dark_url',
          'site_logo_light_url',
          'primary_color',
          'featured_channel_uuid',
          'featured_banner_url',
          'support_email',
          'support_whatsapp',
        ],
      },
    },
    select: { key: true, value: true },
  })

  const merged = fromRows(rows)
  return {
    siteName: merged.siteName,
    siteShortName: merged.siteShortName,
    siteLogoUrl: merged.siteLogoUrl,
    siteLogoDarkUrl: merged.siteLogoDarkUrl || merged.siteLogoUrl || SYSTEM_DEFAULTS.siteLogoDarkUrl,
    siteLogoLightUrl: merged.siteLogoLightUrl || merged.siteLogoUrl || SYSTEM_DEFAULTS.siteLogoLightUrl,
    primaryColor: merged.primaryColor,
    featuredChannelUuid: merged.featuredChannelUuid,
    featuredBannerUrl: merged.featuredBannerUrl,
    supportEmail: merged.supportEmail,
    supportWhatsapp: merged.supportWhatsapp,
  }
}

export async function getAdminSystemConfig() {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          'site_name',
          'site_short_name',
          'site_logo_url',
          'site_logo_dark_url',
          'site_logo_light_url',
          'primary_color',
          'featured_channel_uuid',
          'featured_banner_url',
          'support_email',
          'support_whatsapp',
          'pix_key',
          'mercadopago_access_token',
          'expfypay_public_key',
          'expfypay_secret_key',
          'payment_gateway_provider',
          'payment_gateway_mode',
          'payment_gateway_enabled',
          'payment_gateway_rotation_cursor',
          'default_plan_id',
          'commission_default',
          'trial_days',
          'audit_retention_days',
        ],
      },
    },
    select: { key: true, value: true },
  })

  return fromRows(rows)
}

export async function setAdminSystemConfig(input: {
  siteName: string
  siteShortName: string
  siteLogoUrl: string
  siteLogoDarkUrl: string
  siteLogoLightUrl: string
  primaryColor: string
  featuredChannelUuid: string
  featuredBannerUrl: string
  supportEmail: string
  supportWhatsapp: string
  pixKey: string
  mercadopagoAccessToken: string
  expfypayPublicKey: string
  expfypaySecretKey: string
  paymentGatewayProvider: string
  paymentGatewayMode: string
  paymentGatewayEnabled: string
  defaultPlanId: string
  defaultCommission: string
  trialDays: string
  auditRetentionDays: string
}) {
  const writes: Array<{ key: SystemConfigKey; value: string }> = [
    { key: 'site_name', value: input.siteName },
    { key: 'site_short_name', value: input.siteShortName || input.siteName },
    { key: 'site_logo_url', value: input.siteLogoUrl || SYSTEM_DEFAULTS.siteLogoUrl },
    { key: 'site_logo_dark_url', value: input.siteLogoDarkUrl || input.siteLogoUrl || SYSTEM_DEFAULTS.siteLogoDarkUrl },
    { key: 'site_logo_light_url', value: input.siteLogoLightUrl || input.siteLogoUrl || SYSTEM_DEFAULTS.siteLogoLightUrl },
    { key: 'primary_color', value: input.primaryColor || SYSTEM_DEFAULTS.primaryColor },
    { key: 'featured_channel_uuid', value: input.featuredChannelUuid || '' },
    { key: 'featured_banner_url', value: input.featuredBannerUrl || '' },
    { key: 'support_email', value: input.supportEmail },
    { key: 'support_whatsapp', value: input.supportWhatsapp || '' },
    { key: 'pix_key', value: input.pixKey },
    { key: 'mercadopago_access_token', value: input.mercadopagoAccessToken || '' },
    { key: 'expfypay_public_key', value: input.expfypayPublicKey || '' },
    { key: 'expfypay_secret_key', value: input.expfypaySecretKey || '' },
    { key: 'payment_gateway_provider', value: input.paymentGatewayProvider || SYSTEM_DEFAULTS.paymentGatewayProvider },
    { key: 'payment_gateway_mode', value: input.paymentGatewayMode || SYSTEM_DEFAULTS.paymentGatewayMode },
    { key: 'payment_gateway_enabled', value: input.paymentGatewayEnabled || SYSTEM_DEFAULTS.paymentGatewayEnabled },
    { key: 'default_plan_id', value: input.defaultPlanId || SYSTEM_DEFAULTS.defaultPlanId },
    { key: 'commission_default', value: input.defaultCommission || SYSTEM_DEFAULTS.defaultCommission },
    { key: 'trial_days', value: input.trialDays || SYSTEM_DEFAULTS.trialDays },
    { key: 'audit_retention_days', value: input.auditRetentionDays || SYSTEM_DEFAULTS.auditRetentionDays },
  ]

  await prisma.$transaction(
    writes.map((entry) =>
      prisma.systemConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value.trim() },
        create: { key: entry.key, value: entry.value.trim() },
      }),
    ),
  )
}

export async function getMercadoPagoAccessToken() {
  const row = await prisma.systemConfig.findUnique({
    where: { key: 'mercadopago_access_token' },
    select: { value: true },
  })

  return row?.value?.trim() || ''
}

function parseGatewayList(raw: string) {
  return raw
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean) as PaymentGatewayId[]
}

export async function getPaymentGatewayConfig() {
  const config = await getAdminSystemConfig()

  return {
    provider: (config.paymentGatewayProvider || SYSTEM_DEFAULTS.paymentGatewayProvider) as PaymentGatewayId,
    mode: (config.paymentGatewayMode || SYSTEM_DEFAULTS.paymentGatewayMode) as PaymentGatewayMode,
    enabled: parseGatewayList(config.paymentGatewayEnabled || SYSTEM_DEFAULTS.paymentGatewayEnabled),
    rotationCursor: Math.max(0, parseInt(config.paymentGatewayRotationCursor || SYSTEM_DEFAULTS.paymentGatewayRotationCursor, 10) || 0),
    mercadopagoAccessToken: config.mercadopagoAccessToken || '',
    expfypayPublicKey: config.expfypayPublicKey || '',
    expfypaySecretKey: config.expfypaySecretKey || '',
  }
}

export async function getAuditRetentionDays() {
  const row = await prisma.systemConfig.findUnique({
    where: { key: 'audit_retention_days' },
    select: { value: true },
  })

  const value = parseInt(row?.value || SYSTEM_DEFAULTS.auditRetentionDays, 10)
  return Number.isFinite(value) && value > 0 ? value : parseInt(SYSTEM_DEFAULTS.auditRetentionDays, 10)
}
