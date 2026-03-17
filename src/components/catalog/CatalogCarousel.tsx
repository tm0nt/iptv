'use client'
import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Play, Tv, Film } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChannelItem {
  uuid: string; name: string; tvgName?: string | null
  logoUrl?: string | null; isFeatured?: boolean; viewCount?: number
  contentType?: string
}

interface Props {
  title: string
  channels: ChannelItem[]
  variant?: 'default' | 'large'
}

export function CatalogCarousel({ title, channels, variant = 'default' }: Props) {
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Only render cards that are near the viewport (virtualization)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const updateRange = () => {
      const scrollLeft = el.scrollLeft
      const width      = el.offsetWidth
      const cardWidth  = variant === 'large' ? 176 : 128 // approx card width + gap
      const start      = Math.max(0, Math.floor(scrollLeft / cardWidth) - 4)
      const visible    = Math.ceil(width / cardWidth)
      const end        = Math.min(channels.length, start + visible + 8)
      setVisibleRange({ start, end })
    }

    updateRange()
    el.addEventListener('scroll', updateRange, { passive: true })
    return () => el.removeEventListener('scroll', updateRange)
  }, [channels.length, variant])

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    const w = ref.current.offsetWidth
    ref.current.scrollBy({ left: dir === 'left' ? -(w * .75) : w * .75, behavior: 'smooth' })
  }

  if (!channels.length) return null

  const isLarge    = variant === 'large'
  const cardWidth  = isLarge ? 176 : 128
  const totalWidth = channels.length * (cardWidth + 10) // cardWidth + gap

  return (
    <section className="relative group/row">
      {/* Title */}
      <div className="flex items-center justify-between px-4 md:px-6 mb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <span className="text-[11px] text-muted-foreground font-medium">{channels.length}</span>
        </div>
        <button className="text-[12px] text-[var(--apple-blue)] font-medium opacity-0 group-hover/row:opacity-100 transition-opacity">
          Ver todos →
        </button>
      </div>

      {/* Left arrow */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-[52%] -translate-y-1/2 z-10 h-16 w-8 bg-background/90 border border-border rounded-r-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-card shadow-md"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-[52%] -translate-y-1/2 z-10 h-16 w-8 bg-background/90 border border-border rounded-l-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-card shadow-md"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      {/* Scrollable track */}
      <div
        ref={ref}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 md:px-6 pb-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {channels.map((ch, idx) => {
          // Only fully render cards in visible range, use placeholders for offscreen
          const inRange = idx >= visibleRange.start && idx <= visibleRange.end
          return (
            <ChannelCard
              key={ch.uuid}
              channel={ch}
              isLarge={isLarge}
              visible={inRange}
              onClick={() => router.push(`/watch/${ch.uuid}`)}
            />
          )
        })}
      </div>
    </section>
  )
}

function ChannelCard({ channel, isLarge, visible, onClick }: {
  channel: ChannelItem; isLarge: boolean; visible: boolean; onClick: () => void
}) {
  const w = isLarge ? 'w-40 sm:w-44' : 'w-28 sm:w-32'
  const h = isLarge ? 'h-[90px] sm:h-[104px]' : 'h-[64px] sm:h-[72px]'

  const isMovie = channel.contentType === 'MOVIE'

  return (
    <div
      onClick={onClick}
      style={{ scrollSnapAlign: 'start' }}
      className={cn(
        'flex-none cursor-pointer rounded-xl overflow-hidden',
        'bg-secondary border border-border',
        'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-border/80',
        'active:scale-[.97]',
        w,
      )}
    >
      {/* Logo */}
      <div className={cn('relative w-full flex items-center justify-center bg-secondary overflow-hidden', h)}>
        {visible && channel.logoUrl ? (
          <Image
            src={channel.logoUrl}
            alt={channel.name}
            fill
            className="object-contain p-3"
            sizes="176px"
            loading="lazy"
            unoptimized
          />
        ) : !channel.logoUrl ? (
          isMovie
            ? <Film className="w-5 h-5 text-muted-foreground/30" />
            : <Tv className="w-5 h-5 text-muted-foreground/30" />
        ) : (
          // Placeholder for offscreen cards
          <div className="w-full h-full bg-secondary" />
        )}
        {/* Hover play */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      {/* Name */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-medium text-foreground line-clamp-1 leading-tight">
          {channel.name}
        </p>
      </div>
    </div>
  )
}

// ── Skeleton loader for progressive loading ──────────────────────────────────

export function CatalogCarouselSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="flex items-center gap-2.5 px-4 md:px-6 mb-3">
        <div className="h-4 w-28 bg-secondary rounded-md" />
        <div className="h-3 w-8 bg-secondary rounded-md" />
      </div>
      <div className="flex gap-2.5 overflow-hidden px-4 md:px-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-none w-28 sm:w-32 rounded-xl overflow-hidden border border-border">
            <div className="h-[64px] sm:h-[72px] bg-secondary" />
            <div className="px-2 py-2">
              <div className="h-3 w-16 bg-secondary rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
