'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Play, Tv2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ContinueWatchingItem {
  channelUuid: string
  title: string
  subtitle: string
  contentType: 'LIVE' | 'MOVIE' | 'SERIES'
  artworkUrl: string | null
  progressPercent: number
  href: string
  lastWatchedAt: string
  isLive: boolean
}

export function ContinueWatchingRail({ items }: { items: ContinueWatchingItem[] }) {
  if (!items.length) return null

  return (
    <section className="px-4 md:px-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-foreground">Continuar assistindo</h2>
          <p className="text-[12px] text-muted-foreground mt-1">
            Seu ponto de retomada fica separado por perfil.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(item => (
          <Link
            key={`${item.channelUuid}-${item.lastWatchedAt}`}
            href={item.href}
            className="surface rounded-[24px] p-3 group hover:-translate-y-0.5 transition-transform"
          >
            <div className="relative h-36 w-full rounded-[18px] overflow-hidden bg-secondary">
              {item.artworkUrl ? (
                <Image
                  src={item.artworkUrl}
                  alt={item.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Tv2 className="w-7 h-7 text-muted-foreground/40" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold backdrop-blur-sm',
                  item.isLive
                    ? 'bg-red-500/85 text-white'
                    : 'bg-black/55 text-white/90',
                )}>
                  {item.isLive ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Ao vivo
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      Retomar
                    </>
                  )}
                </span>
              </div>

              <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur-sm group-hover:bg-white group-hover:text-black transition-colors">
                <Play className="w-4 h-4 fill-current" />
              </div>
            </div>

            <div className="mt-3">
              <p className="text-[14px] font-semibold text-foreground line-clamp-1">{item.title}</p>
              <p className="text-[12px] text-muted-foreground mt-1 line-clamp-1">{item.subtitle}</p>
            </div>

            {!item.isLive && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--apple-blue)]"
                    style={{ width: `${Math.min(100, Math.max(6, item.progressPercent || 0))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {Math.round(item.progressPercent)}% assistido
                </p>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
