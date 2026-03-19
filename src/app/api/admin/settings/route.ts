import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { getAdminSystemConfig, setAdminSystemConfig } from '@/lib/system-config'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = await getAdminSystemConfig()
  return NextResponse.json(config)
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const previous = await getAdminSystemConfig()
  const body = await request.json()
  const { ipAddress, userAgent } = getAuditRequestContext(request)

  await setAdminSystemConfig({
    siteName: body.siteName || '',
    siteShortName: body.siteShortName || body.siteName || '',
    siteLogoUrl: body.siteLogoUrl || '',
    siteLogoDarkUrl: body.siteLogoDarkUrl || body.siteLogoUrl || '',
    siteLogoLightUrl: body.siteLogoLightUrl || body.siteLogoUrl || '',
    primaryColor: body.primaryColor || '#73de90',
    featuredChannelUuid: body.featuredChannelUuid || '',
    featuredBannerUrl: body.featuredBannerUrl || '',
    supportEmail: body.supportEmail || '',
    supportWhatsapp: body.supportWhatsapp || '',
    pixKey: body.pixKey || body.supportEmail || '',
    mercadopagoAccessToken: body.mercadopagoAccessToken || '',
    expfypayPublicKey: body.expfypayPublicKey || '',
    expfypaySecretKey: body.expfypaySecretKey || '',
    paymentGatewayProvider: body.paymentGatewayProvider || 'mercadopago',
    paymentGatewayMode: body.paymentGatewayMode || 'single',
    paymentGatewayEnabled: body.paymentGatewayEnabled || 'mercadopago',
    defaultPlanId: body.defaultPlanId || 'basico',
    defaultCommission: body.defaultCommission || '0.20',
    trialDays: body.trialDays || '7',
    auditRetentionDays: body.auditRetentionDays || '90',
  })

  const updated = await getAdminSystemConfig()

  const changedKeys = Object.keys(updated).filter((key) => {
    const current = updated[key as keyof typeof updated]
    const before = previous[key as keyof typeof previous]
    return current !== before
  })

  await logAuditEvent({
    action: 'admin.settings.updated',
    entityType: 'SYSTEM_CONFIG',
    message: 'Configurações gerais do sistema foram atualizadas',
    actor: admin,
    ipAddress,
    userAgent,
    metadata: {
      changedKeys,
      featuredChannelUuid: updated.featuredChannelUuid,
      featuredBannerUrl: updated.featuredBannerUrl,
    },
  })

  return NextResponse.json({ ok: true, config: updated })
}
