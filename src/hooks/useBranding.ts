'use client'

import { useEffect, useState } from 'react'

type Branding = {
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
}

const DEFAULT_BRANDING: Branding = {
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
}

function hexToHslString(hex: string) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))

    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6)
        break
      case g:
        h = 60 * ((b - r) / d + 2)
        break
      default:
        h = 60 * ((r - g) / d + 4)
        break
    }
  }

  if (h < 0) h += 360
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)

  useEffect(() => {
    let active = true
    fetch('/api/system/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return
        const primaryColor = data.primaryColor || DEFAULT_BRANDING.primaryColor
        const primaryHsl = hexToHslString(primaryColor)
        document.documentElement.style.setProperty('--brand-primary', primaryColor)
        document.documentElement.style.setProperty('--apple-blue', primaryColor)
        document.documentElement.style.setProperty('--apple-green', primaryColor)
        document.documentElement.style.setProperty('--primary', primaryHsl)
        document.documentElement.style.setProperty('--ring', primaryHsl)
        setBranding({
          siteName: data.siteName || DEFAULT_BRANDING.siteName,
          siteShortName: data.siteShortName || data.siteName || DEFAULT_BRANDING.siteShortName,
          siteLogoUrl: data.siteLogoUrl || DEFAULT_BRANDING.siteLogoUrl,
          siteLogoDarkUrl: data.siteLogoDarkUrl || data.siteLogoUrl || DEFAULT_BRANDING.siteLogoDarkUrl,
          siteLogoLightUrl: data.siteLogoLightUrl || data.siteLogoUrl || DEFAULT_BRANDING.siteLogoLightUrl,
          primaryColor,
          featuredChannelUuid: data.featuredChannelUuid || '',
          featuredBannerUrl: data.featuredBannerUrl || '',
          supportEmail: data.supportEmail || DEFAULT_BRANDING.supportEmail,
          supportWhatsapp: data.supportWhatsapp || '',
        })
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return branding
}
