import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SessionProvider } from '@/components/SessionProvider'
import { Toaster } from '@/components/ui/toaster'
import { PWARegister } from '@/components/PWARegister'
import { getPublicSystemConfig } from '@/lib/system-config'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'IPTV',
  description: 'IPTV Premium — Canais, Filmes e Séries em HD',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'IPTV' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
}

export async function generateViewport(): Promise<Viewport> {
  const branding = await getPublicSystemConfig()
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: branding.primaryColor || '#73de90' },
      { media: '(prefers-color-scheme: dark)', color: '#123126' },
    ],
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
            {children}
            <Toaster />
            <PWARegister />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
