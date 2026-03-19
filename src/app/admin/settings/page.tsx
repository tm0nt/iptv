'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Save, Key, Globe, Percent, Loader2, Check, ShieldCheck, AlertCircle,
  UploadCloud, Search, ImageIcon, Tv2, X,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PageIntro } from '@/components/admin/PageIntro'
import { PAYMENT_GATEWAY_OPTIONS } from '@/lib/payment-gateways'

type ChannelOption = {
  uuid: string
  name: string
  logoUrl?: string | null
}

type UploadField = 'dark' | 'light' | 'banner'

export default function AdminSettings() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<Record<UploadField, boolean>>({
    dark: false,
    light: false,
    banner: false,
  })
  const [channelSearch, setChannelSearch] = useState('')
  const [channelResults, setChannelResults] = useState<ChannelOption[]>([])
  const [channelSearching, setChannelSearching] = useState(false)
  const [selectedFeaturedChannel, setSelectedFeaturedChannel] = useState<ChannelOption | null>(null)
  const [config, setConfig] = useState({
    siteName: 'IPTV',
    siteShortName: 'IPTV',
    siteLogoUrl: '/logo-dark.png',
    siteLogoDarkUrl: '/logo-dark.png',
    siteLogoLightUrl: '/logo-white.png',
    primaryColor: '#73de90',
    featuredChannelUuid: '',
    featuredBannerUrl: '',
    defaultCommission: '20',
    trialDays: '7',
    supportEmail: 'suporte@iptv.local',
    supportWhatsapp: '',
    pixKey: 'suporte@iptv.local',
    mercadopagoAccessToken: '',
    expfypayPublicKey: '',
    expfypaySecretKey: '',
    paymentGatewayProvider: 'mercadopago',
    paymentGatewayMode: 'single',
    paymentGatewayEnabled: ['mercadopago'],
    defaultPlanId: 'basico',
    auditRetentionDays: '90',
  })

  const darkInputRef = useRef<HTMLInputElement>(null)
  const lightInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        setConfig({
          siteName: d.siteName || 'IPTV',
          siteShortName: d.siteShortName || d.siteName || 'IPTV',
          siteLogoUrl: d.siteLogoUrl || d.siteLogoDarkUrl || '/logo-dark.png',
          siteLogoDarkUrl: d.siteLogoDarkUrl || d.siteLogoUrl || '/logo-dark.png',
          siteLogoLightUrl: d.siteLogoLightUrl || d.siteLogoUrl || '/logo-white.png',
          primaryColor: d.primaryColor || '#73de90',
          featuredChannelUuid: d.featuredChannelUuid || '',
          featuredBannerUrl: d.featuredBannerUrl || '',
          defaultCommission: String(Math.round((parseFloat(d.defaultCommission || '0.20') || 0.2) * 100)),
          trialDays: d.trialDays || '7',
          supportEmail: d.supportEmail || 'suporte@iptv.local',
          supportWhatsapp: d.supportWhatsapp || '',
          pixKey: d.pixKey || d.supportEmail || 'suporte@iptv.local',
          mercadopagoAccessToken: d.mercadopagoAccessToken || '',
          expfypayPublicKey: d.expfypayPublicKey || '',
          expfypaySecretKey: d.expfypaySecretKey || '',
          paymentGatewayProvider: d.paymentGatewayProvider || 'mercadopago',
          paymentGatewayMode: d.paymentGatewayMode || 'single',
          paymentGatewayEnabled: (d.paymentGatewayEnabled || 'mercadopago').split(',').map((item: string) => item.trim()).filter(Boolean),
          defaultPlanId: d.defaultPlanId || 'basico',
          auditRetentionDays: d.auditRetentionDays || '90',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const primary = config.primaryColor || '#73de90'
    document.documentElement.style.setProperty('--brand-primary', primary)
    document.documentElement.style.setProperty('--apple-blue', primary)
    document.documentElement.style.setProperty('--apple-green', primary)
  }, [config.primaryColor])

  useEffect(() => {
    if (!config.featuredChannelUuid) {
      setSelectedFeaturedChannel(null)
      return
    }

    fetch(`/api/admin/channels?uuid=${encodeURIComponent(config.featuredChannelUuid)}&limit=1`)
      .then(r => r.json())
      .then(d => {
        const channel = d.channels?.[0]
        if (!channel) return
        const selected = {
          uuid: channel.uuid,
          name: channel.name,
          logoUrl: channel.logoUrl || null,
        }
        setSelectedFeaturedChannel(selected)
        setChannelSearch(selected.name)
      })
      .catch(() => {})
  }, [config.featuredChannelUuid])

  useEffect(() => {
    const query = channelSearch.trim()
    if (selectedFeaturedChannel && query === selectedFeaturedChannel.name) {
      setChannelResults([])
      return
    }
    if (query.length < 2) {
      setChannelResults([])
      return
    }

    const timer = setTimeout(() => {
      setChannelSearching(true)
      fetch(`/api/admin/channels?q=${encodeURIComponent(query)}&page=1&limit=12`)
        .then(r => r.json())
        .then(d => {
          setChannelResults((d.channels || []).map((channel: ChannelOption) => ({
            uuid: channel.uuid,
            name: channel.name,
            logoUrl: channel.logoUrl || null,
          })))
        })
        .catch(() => setChannelResults([]))
        .finally(() => setChannelSearching(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [channelSearch, selectedFeaturedChannel])

  const isAnyUploadActive = useMemo(
    () => Object.values(uploading).some(Boolean),
    [uploading],
  )

  async function uploadAsset(kind: UploadField, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'branding')
    formData.append('prefix', kind === 'banner' ? 'featured-banner' : `logo-${kind}`)

    setUploading(prev => ({ ...prev, [kind]: true }))
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no upload')

      setConfig(prev => ({
        ...prev,
        siteLogoUrl: kind === 'dark' ? data.path : prev.siteLogoUrl,
        siteLogoDarkUrl: kind === 'dark' ? data.path : prev.siteLogoDarkUrl,
        siteLogoLightUrl: kind === 'light' ? data.path : prev.siteLogoLightUrl,
        featuredBannerUrl: kind === 'banner' ? data.path : prev.featuredBannerUrl,
      }))
    } catch (error) {
      console.error(error)
    } finally {
      setUploading(prev => ({ ...prev, [kind]: false }))
    }
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      siteName: config.siteName.trim(),
      siteShortName: (config.siteShortName || config.siteName).trim(),
      siteLogoUrl: config.siteLogoDarkUrl.trim() || config.siteLogoLightUrl.trim(),
      siteLogoDarkUrl: config.siteLogoDarkUrl.trim(),
      siteLogoLightUrl: config.siteLogoLightUrl.trim(),
      primaryColor: config.primaryColor.trim(),
      featuredChannelUuid: config.featuredChannelUuid.trim(),
      featuredBannerUrl: config.featuredBannerUrl.trim(),
      supportEmail: config.supportEmail.trim(),
      supportWhatsapp: config.supportWhatsapp.trim(),
      pixKey: config.pixKey.trim(),
      mercadopagoAccessToken: config.mercadopagoAccessToken.trim(),
      expfypayPublicKey: config.expfypayPublicKey.trim(),
      expfypaySecretKey: config.expfypaySecretKey.trim(),
      paymentGatewayProvider: config.paymentGatewayProvider,
      paymentGatewayMode: config.paymentGatewayMode,
      paymentGatewayEnabled: config.paymentGatewayEnabled.join(','),
      defaultPlanId: config.defaultPlanId.trim(),
      defaultCommission: (Math.max(0, parseFloat(config.defaultCommission || '20')) / 100).toFixed(2),
      trialDays: String(Math.max(0, parseInt(config.trialDays || '7', 10))),
      auditRetentionDays: String(Math.max(1, parseInt(config.auditRetentionDays || '90', 10))),
    }

    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (!res.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )

  if (loading) {
    return (
      <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-5xl space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="h-8 w-44 rounded-full mx-auto" />
          <Skeleton className="h-4 w-72 rounded-full mx-auto" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="surface rounded-[28px] p-6 space-y-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            ))}
          </div>
          <div className="surface rounded-[28px] p-6 space-y-4">
            <Skeleton className="h-40 w-full rounded-[24px]" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Configurações do painel"
        description="Ajuste branding, destaque, pagamentos e regras operacionais sem depender de URL manual ou UUID."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] items-start">
        <div className="space-y-6">
          <Section title="Branding" icon={Globe}>
            <div className="grid gap-4 md:grid-cols-2">
              <F label="Nome do sistema">
                <input
                  value={config.siteName}
                  onChange={e => setConfig(c => ({ ...c, siteName: e.target.value }))}
                  className="field-input"
                  placeholder="IPTV"
                />
              </F>
              <F label="Nome curto">
                <input
                  value={config.siteShortName}
                  onChange={e => setConfig(c => ({ ...c, siteShortName: e.target.value }))}
                  className="field-input"
                  placeholder="IPTV"
                />
              </F>
            </div>

            <F label="Cor primária">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                  className="h-12 w-16 rounded-2xl bg-transparent cursor-pointer"
                />
                <input
                  value={config.primaryColor}
                  onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                  className="field-input font-mono"
                  placeholder="#73de90"
                />
                <div className="h-12 w-12 rounded-2xl shadow-sm" style={{ background: config.primaryColor }} />
              </div>
            </F>

            <div className="grid gap-4 lg:grid-cols-2">
              <LogoUploader
                label="Logo para dark"
                hint="Usada em telas escuras e como fallback padrão."
                src={config.siteLogoDarkUrl}
                uploading={uploading.dark}
                onSelect={() => darkInputRef.current?.click()}
              />
              <LogoUploader
                label="Logo para light"
                hint="Usada em telas claras automaticamente."
                src={config.siteLogoLightUrl}
                uploading={uploading.light}
                onSelect={() => lightInputRef.current?.click()}
              />
            </div>

            <input
              ref={darkInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadAsset('dark', file)
              }}
            />
            <input
              ref={lightInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadAsset('light', file)
              }}
            />
          </Section>

          <Section title="Destaque do /watch" icon={Tv2}>
            <F
              label="Canal em destaque"
              hint="Pesquise pelo nome do canal e selecione direto na lista."
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={channelSearch}
                  onChange={e => {
                    setChannelSearch(e.target.value)
                    if (!e.target.value.trim()) {
                      setConfig(c => ({ ...c, featuredChannelUuid: '' }))
                      setSelectedFeaturedChannel(null)
                    }
                  }}
                  className="field-input pl-11 pr-10"
                  placeholder="Ex: SporTV, HBO, Premiere..."
                />
                {selectedFeaturedChannel && (
                  <button
                    type="button"
                    onClick={() => {
                      setChannelSearch('')
                      setChannelResults([])
                      setSelectedFeaturedChannel(null)
                      setConfig(c => ({ ...c, featuredChannelUuid: '' }))
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(channelSearching || channelResults.length > 0) && !selectedFeaturedChannel && (
                <div className="mt-2 rounded-[22px] bg-secondary/70 p-2 shadow-sm">
                  {channelSearching && (
                    <div className="px-3 py-2 text-[13px] text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Buscando canais...
                    </div>
                  )}
                  {!channelSearching && channelResults.map(channel => (
                    <button
                      key={channel.uuid}
                      type="button"
                      onClick={() => {
                        setConfig(c => ({ ...c, featuredChannelUuid: channel.uuid }))
                        setSelectedFeaturedChannel(channel)
                        setChannelSearch(channel.name)
                        setChannelResults([])
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-background/70 transition-colors"
                    >
                      <div className="relative h-10 w-10 rounded-xl bg-background/80 overflow-hidden flex-shrink-0">
                        {channel.logoUrl ? (
                          <Image src={channel.logoUrl} alt={channel.name} fill unoptimized className="object-contain p-1.5" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Tv2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{channel.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">{channel.uuid}</p>
                      </div>
                    </button>
                  ))}
                  {!channelSearching && channelResults.length === 0 && channelSearch.trim().length >= 2 && (
                    <div className="px-3 py-2 text-[13px] text-muted-foreground">
                      Nenhum canal encontrado.
                    </div>
                  )}
                </div>
              )}
            </F>

            {selectedFeaturedChannel && (
              <div className="rounded-[24px] bg-secondary/65 p-4 flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-2xl bg-background/80 overflow-hidden flex-shrink-0">
                  {selectedFeaturedChannel.logoUrl ? (
                    <Image
                      src={selectedFeaturedChannel.logoUrl}
                      alt={selectedFeaturedChannel.name}
                      fill
                      unoptimized
                      className="object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Tv2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground truncate">{selectedFeaturedChannel.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{selectedFeaturedChannel.uuid}</p>
                </div>
              </div>
            )}

            <F
              label="Banner do destaque"
              hint="Envie uma arte e o painel salva no seu /public automaticamente."
            >
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="w-full rounded-[24px] bg-secondary/75 p-5 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-background/80 flex items-center justify-center">
                    {uploading.banner ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <UploadCloud className="w-5 h-5 text-[var(--brand-primary)]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Enviar banner</p>
                    <p className="text-[12px] text-muted-foreground">PNG, JPG, WEBP ou SVG até 10MB</p>
                  </div>
                </div>
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) uploadAsset('banner', file)
                }}
              />
            </F>

            {config.featuredBannerUrl && (
              <div className="overflow-hidden rounded-[26px] bg-secondary/70 p-2">
                <div className="relative h-44 w-full overflow-hidden rounded-[22px]">
                  <Image
                    src={config.featuredBannerUrl}
                    alt="Banner de destaque"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            )}
          </Section>

          <Section title="Revendedores" icon={Percent}>
            <div className="grid gap-4 md:grid-cols-3">
              <F label="Comissão padrão (%)">
                <input
                  type="number"
                  value={config.defaultCommission}
                  min="0"
                  max="100"
                  step="1"
                  onChange={e => setConfig(c => ({ ...c, defaultCommission: e.target.value }))}
                  className="field-input"
                />
              </F>
              <F label="Dias de trial">
                <input
                  type="number"
                  value={config.trialDays}
                  min="0"
                  max="30"
                  onChange={e => setConfig(c => ({ ...c, trialDays: e.target.value }))}
                  className="field-input"
                />
              </F>
              <F label="Plano padrão">
                <input
                  value={config.defaultPlanId}
                  onChange={e => setConfig(c => ({ ...c, defaultPlanId: e.target.value }))}
                  className="field-input"
                  placeholder="basico"
                />
              </F>
            </div>
          </Section>

          <Section title="Suporte" icon={Key}>
            <div className="grid gap-4 md:grid-cols-2">
              <F label="Email de suporte">
                <input
                  type="email"
                  value={config.supportEmail}
                  onChange={e => setConfig(c => ({ ...c, supportEmail: e.target.value }))}
                  className="field-input"
                  placeholder="suporte@seudominio.com"
                />
              </F>
              <F label="WhatsApp de suporte">
                <input
                  value={config.supportWhatsapp}
                  onChange={e => setConfig(c => ({ ...c, supportWhatsapp: e.target.value }))}
                  className="field-input"
                  placeholder="+55 11 99999-9999"
                />
              </F>
            </div>
            <F label="Chave PIX padrão">
              <input
                value={config.pixKey}
                onChange={e => setConfig(c => ({ ...c, pixKey: e.target.value }))}
                className="field-input"
                placeholder="chave@pix.com"
              />
            </F>
            <div className="grid gap-4 md:grid-cols-2">
              <F label="Gateway principal do PIX" hint="Usado no modo único e como preferência inicial no revezamento.">
                <select
                  value={config.paymentGatewayProvider}
                  onChange={e => setConfig(c => ({ ...c, paymentGatewayProvider: e.target.value }))}
                  className="field-input"
                >
                  {PAYMENT_GATEWAY_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}{option.implemented ? '' : ' (Em breve)'}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Estratégia de uso" hint="Prepare o sistema para operar com um gateway fixo ou alternância futura entre provedores.">
                <select
                  value={config.paymentGatewayMode}
                  onChange={e => setConfig(c => ({ ...c, paymentGatewayMode: e.target.value }))}
                  className="field-input"
                >
                  <option value="single">Único gateway</option>
                  <option value="round_robin">Revezamento</option>
                </select>
              </F>
            </div>
            <F label="Gateways habilitados" hint="Mercado Pago e EXPFY Pay já estão operacionais. Os demais continuam preparados para entrar depois sem refazer a arquitetura.">
              <div className="grid gap-2">
                {PAYMENT_GATEWAY_OPTIONS.map(option => {
                  const checked = config.paymentGatewayEnabled.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-[22px] bg-secondary/70 px-4 py-3',
                        !option.implemented && 'opacity-70',
                      )}
                    >
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{option.label}</p>
                        <p className="text-[11px] text-muted-foreground">{option.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!option.implemented}
                        onChange={(e) => {
                          setConfig(current => {
                            const next = e.target.checked
                              ? Array.from(new Set([...current.paymentGatewayEnabled, option.id]))
                              : current.paymentGatewayEnabled.filter(item => item !== option.id)

                            return {
                              ...current,
                              paymentGatewayEnabled: next.length > 0 ? next : ['mercadopago'],
                              paymentGatewayProvider: next.includes(current.paymentGatewayProvider)
                                ? current.paymentGatewayProvider
                                : 'mercadopago',
                            }
                          })
                        }}
                        className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
                      />
                    </label>
                  )
                })}
              </div>
            </F>
            <F label="Mercado Pago Access Token" hint="Agora configurado pelo painel, sem depender do .env.">
              <input
                type="password"
                value={config.mercadopagoAccessToken}
                onChange={e => setConfig(c => ({ ...c, mercadopagoAccessToken: e.target.value }))}
                className="field-input font-mono"
                placeholder="APP_USR-..."
              />
            </F>
            <div className="grid gap-4 md:grid-cols-2">
              <F label="EXPFY Public Key" hint="Enviada no header X-Public-Key para criar cobranças PIX.">
                <input
                  type="password"
                  value={config.expfypayPublicKey}
                  onChange={e => setConfig(c => ({ ...c, expfypayPublicKey: e.target.value }))}
                  className="field-input font-mono"
                  placeholder="pk_..."
                />
              </F>
              <F label="EXPFY Secret Key" hint="Usada nas requisições server-to-server e na validação HMAC do webhook.">
                <input
                  type="password"
                  value={config.expfypaySecretKey}
                  onChange={e => setConfig(c => ({ ...c, expfypaySecretKey: e.target.value }))}
                  className="field-input font-mono"
                  placeholder="sk_..."
                />
              </F>
            </div>
            <F label="Retenção da auditoria (dias)">
              <input
                type="number"
                min="1"
                max="3650"
                value={config.auditRetentionDays}
                onChange={e => setConfig(c => ({ ...c, auditRetentionDays: e.target.value }))}
                className="field-input"
              />
            </F>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Preview" icon={ImageIcon}>
            <div
              className="rounded-[30px] p-5 text-slate-950"
              style={{
                background: `linear-gradient(145deg, ${config.primaryColor} 0%, color-mix(in srgb, ${config.primaryColor} 58%, white) 100%)`,
              }}
            >
              <div className="rounded-[24px] bg-white/70 backdrop-blur-xl p-4 shadow-[0_18px_50px_rgba(255,255,255,0.28)_inset]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700/65">Branding</p>
                    <h3 className="text-[24px] font-bold tracking-tight">{config.siteName || 'IPTV'}</h3>
                  </div>
                  <div className="h-11 w-11 rounded-2xl shadow-sm" style={{ background: config.primaryColor }} />
                </div>

                <div className="mt-5 space-y-3">
                  <PreviewAsset title="Logo dark" src={config.siteLogoDarkUrl} />
                  <PreviewAsset title="Logo light" src={config.siteLogoLightUrl} />
                  <PreviewAsset title="Banner destaque" src={config.featuredBannerUrl} large />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Segurança" icon={ShieldCheck}>
            <div className="space-y-2">
              {[
                { label: 'Proxy de Stream', status: true },
                { label: 'Proteção de URLs M3U8', status: true },
                { label: 'Verificação de Assinatura', status: true },
                { label: 'Gateway PIX ativo', status: !!config.paymentGatewayProvider },
                { label: 'Webhook Mercado Pago', status: !!config.mercadopagoAccessToken },
                { label: 'Webhook EXPFY Pay', status: !!config.expfypayPublicKey && !!config.expfypaySecretKey },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-muted-foreground">{item.label}</span>
                  <span className={cn('badge', item.status ? 'badge-green' : 'badge-amber')}>
                    {item.status ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        Verificar
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <button
            onClick={handleSave}
            disabled={saving || isAnyUploadActive}
            className="btn-primary w-full py-3 text-[15px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando configurações...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Salvo com sucesso
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="surface rounded-[30px] p-6 md:p-7">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl bg-secondary/75 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--brand-primary)]" />
        </div>
        <div>
          <p className="text-[17px] font-semibold text-foreground">{title}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function LogoUploader({
  label,
  hint,
  src,
  uploading,
  onSelect,
}: {
  label: string
  hint: string
  src: string
  uploading: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[24px] bg-secondary/75 p-4 text-left hover:bg-secondary transition-colors"
    >
      <div className="relative h-28 overflow-hidden rounded-[20px] bg-background/80">
        {src ? (
          <Image src={src} alt={label} fill unoptimized className="object-contain p-4" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-background/80 flex items-center justify-center">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="w-4 h-4 text-[var(--brand-primary)]" />
          )}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground">{label}</p>
          <p className="text-[12px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </button>
  )
}

function PreviewAsset({ title, src, large = false }: { title: string; src?: string; large?: boolean }) {
  return (
    <div className="rounded-[20px] bg-white/65 p-3">
      <p className="text-[12px] font-semibold text-slate-700 mb-2">{title}</p>
      <div className={cn('relative w-full overflow-hidden rounded-[16px] bg-white/80', large ? 'h-28' : 'h-20')}>
        {src ? (
          <Image src={src} alt={title} fill unoptimized className={large ? 'object-cover' : 'object-contain p-3'} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="w-5 h-5 text-slate-400" />
          </div>
        )}
      </div>
    </div>
  )
}
