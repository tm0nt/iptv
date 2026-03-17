'use client'
import { useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Play, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeriesItem } from '@/types'

interface Props {
  title: string
  series: SeriesItem[]
  variant?: 'carousel' | 'grid'
}

export function SeriesCarousel({ title, series, variant = 'carousel' }: Props) {
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    const w = ref.current.offsetWidth
    ref.current.scrollBy({ left: dir === 'left' ? -(w * .75) : w * .75, behavior: 'smooth' })
  }

  if (!series.length) return null

  if (variant === 'grid') {
    return (
      <section>
        <div className="px-4 md:px-6 mb-4">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 px-4 md:px-6">
          {series.map(s => (
            <SeriesCard key={s.id} series={s} onClick={() => router.push(`/series/${s.id}`)} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="relative group/row">
      <div className="flex items-center justify-between px-4 md:px-6 mb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <span className="text-[11px] text-muted-foreground font-medium">{series.length}</span>
        </div>
      </div>

      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-[52%] -translate-y-1/2 z-10 h-20 w-8 bg-background/90 border border-border rounded-r-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-card shadow-md"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>

      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-[52%] -translate-y-1/2 z-10 h-20 w-8 bg-background/90 border border-border rounded-l-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-card shadow-md"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-6 pb-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {series.map(s => (
          <SeriesCard key={s.id} series={s} onClick={() => router.push(`/series/${s.id}`)} />
        ))}
      </div>
    </section>
  )
}

function SeriesCard({ series, onClick }: { series: SeriesItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ scrollSnapAlign: 'start' }}
      className={cn(
        'flex-none cursor-pointer rounded-xl overflow-hidden',
        'bg-secondary border border-border',
        'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-border/80',
        'active:scale-[.97] w-36 sm:w-40',
      )}
    >
      {/* Poster (portrait ratio) */}
      <div className="relative w-full h-[200px] sm:h-[224px] flex items-center justify-center bg-secondary/80 overflow-hidden">
        {series.posterUrl ? (
          <Image
            src={series.posterUrl}
            alt={series.title}
            fill
            className="object-cover"
            sizes="176px"
            loading="lazy"
            unoptimized
          />
        ) : (
          <Film className="w-8 h-8 text-muted-foreground/30" />
        )}

        {/* Provider badge */}
        {series.provider && (
          <span className="absolute top-2 left-2 text-[9px] font-semibold bg-black/60 text-white/90 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {series.provider}
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 py-2">
        <p className="text-[12px] font-semibold text-foreground line-clamp-1 leading-tight">
          {series.title}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {series.seasonCount} temp · {series.episodeCount} ep
        </p>
      </div>
    </div>
  )
}

export function SeriesCarouselSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="flex items-center gap-2.5 px-4 md:px-6 mb-3">
        <div className="h-4 w-28 bg-secondary rounded-md" />
      </div>
      <div className="flex gap-3 overflow-hidden px-4 md:px-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-none w-36 sm:w-40 rounded-xl overflow-hidden border border-border">
            <div className="h-[200px] sm:h-[224px] bg-secondary" />
            <div className="px-2.5 py-2 space-y-1.5">
              <div className="h-3 w-24 bg-secondary rounded-md" />
              <div className="h-2.5 w-16 bg-secondary rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
