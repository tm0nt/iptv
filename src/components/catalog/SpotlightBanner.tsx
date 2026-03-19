'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Play, Sparkles, Tv2, Info } from 'lucide-react'
import { useBranding } from '@/hooks/useBranding'

type SpotlightBannerProps = {
  channel: {
    uuid: string
    name: string
    logoUrl?: string | null
    viewCount?: number
  }
  category: string
  bannerUrl?: string | null
}

export function SpotlightBanner({ channel, category, bannerUrl }: SpotlightBannerProps) {
  const router = useRouter()
  const branding = useBranding()

  return (
    <section className="px-4 md:px-6 pt-6 md:pt-8">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#dfe9e5] dark:bg-[#111715] shadow-[0_24px_80px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={channel.name}
            fill
            priority
            unoptimized
            className="object-cover object-center"
          />
        ) : channel.logoUrl ? (
          <Image
            src={channel.logoUrl}
            alt={channel.name}
            fill
            unoptimized
            className="object-cover blur-2xl scale-110 opacity-30"
          />
        ) : null}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/58 to-white/12 dark:from-[#09110d]/92 dark:via-[#09110d]/72 dark:to-[#09110d]/28" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent dark:from-black/35" />

        <div className="relative grid min-h-[360px] md:min-h-[430px] items-end md:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 md:p-10">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[11px] font-semibold text-slate-950">
                <Sparkles className="h-3.5 w-3.5" />
                Agora em destaque
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-medium text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/80">
                <Tv2 className="h-3.5 w-3.5" />
                {category}
              </span>
            </div>

            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.25em] text-foreground/50 dark:text-white/40">
              Showcase
            </p>
            <h1 className="max-w-2xl text-[32px] font-bold leading-[0.95] tracking-tight text-slate-900 dark:text-white md:text-[54px]">
              {channel.name}
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-6 text-slate-700/80 dark:text-white/70 md:text-[15px]">
              Abra o canal em um destaque com visual premium, acesso rapido e banner configurado direto pelo painel administrativo de {branding.siteName}.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push(`/watch/${channel.uuid}`)}
                className="btn-primary px-5 py-3 text-[14px] shadow-[0_18px_40px_color-mix(in_srgb,var(--brand-primary)_28%,transparent)]"
              >
                <Play className="h-4 w-4 fill-white" />
                Assistir agora
              </button>
              <button
                onClick={() => router.push(`/watch/${channel.uuid}`)}
                className="btn-secondary px-5 py-3 text-[14px] bg-white/65 backdrop-blur-xl dark:bg-white/5"
              >
                <Info className="h-4 w-4" />
                Ver detalhes
              </button>
            </div>
          </div>

          <div className="hidden h-full items-end justify-end p-8 md:flex">
            <div className="relative w-full max-w-[360px] rounded-[28px] border border-white/20 bg-white/40 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/50 dark:text-white/45">
                  Canal ao vivo
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)] shadow-[0_0_24px_var(--brand-primary)]" />
              </div>

              <div className="relative mb-4 h-28 overflow-hidden rounded-[22px] border border-white/20 bg-gradient-to-br from-white to-white/60 dark:border-white/10 dark:from-white/10 dark:to-white/5">
                {channel.logoUrl ? (
                  <Image
                    src={channel.logoUrl}
                    alt={channel.name}
                    fill
                    unoptimized
                    className="object-contain p-5"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Tv2 className="h-9 w-9 text-foreground/30 dark:text-white/25" />
                  </div>
                )}
              </div>

              <p className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
                {channel.name}
              </p>
              <p className="mt-1 text-[13px] text-slate-700/75 dark:text-white/60">
                {category} · {Math.max(1, channel.viewCount || 0).toLocaleString()} visualizacoes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
