import type { MetadataRoute } from 'next'
import { getPublicSystemConfig } from '@/lib/system-config'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getPublicSystemConfig()

  return {
    name: branding.siteName || 'IPTV',
    short_name: branding.siteShortName || branding.siteName || 'IPTV',
    description: 'IPTV Premium — Canais, Filmes e Séries',
    start_url: '/',
    display: 'standalone',
    background_color: '#050a14',
    theme_color: branding.primaryColor || '#73de90',
    orientation: 'any',
    scope: '/',
    lang: 'pt-BR',
    categories: ['entertainment'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/icons/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Assistir Canais',
        url: '/watch',
        description: 'Acesse o catálogo de canais',
      },
    ],
  }
}
