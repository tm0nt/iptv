'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Play, ChevronLeft, Film, ChevronDown,
  Clock, Tv
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeriesDetail, SeasonItem, EpisodeItem } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'

export default function SeriesDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [series, setSeries]         = useState<SeriesDetail | null>(null)
  const [loading, setLoading]       = useState(true)
  const [activeSeason, setActiveSeason] = useState(0) // index
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/series?id=${id}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(data => {
        setSeries(data.series)
      })
      .catch(() => setError('Série não encontrada'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen pb-16">
        <div className="px-4 md:px-6 pt-6">
          <Skeleton className="h-[50vh] md:h-[60vh] rounded-[28px]" />
        </div>
        <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border/50 mt-6">
          <div className="flex gap-2 overflow-x-auto px-4 md:px-6 py-2.5">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-8 w-16 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
        <div className="px-4 md:px-6 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center gap-3">
              <Skeleton className="h-14 w-20 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !series) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <Film className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-[13px] text-muted-foreground">{error || 'Série não encontrada'}</p>
        <button onClick={() => router.back()} className="btn-secondary px-4 py-2 text-[13px]">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
      </div>
    )
  }

  const season: SeasonItem | null = series.seasons[activeSeason] || null
  const firstEpisode = season?.episodes?.[0]

  return (
    <div className="min-h-screen pb-16">
      {/* ── Hero / Backdrop ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[50vh] md:h-[60vh] bg-[var(--apple-gray-6)] dark:bg-[#0a0a0a] overflow-hidden">
        {series.posterUrl && (
          <div className="absolute inset-0 scale-110 overflow-hidden">
            <Image src={series.posterUrl} alt="" fill
              className="object-cover blur-3xl opacity-20 dark:opacity-15 scale-110" unoptimized />
          </div>
        )}

        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background)/0.85) 45%, transparent 100%)' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, hsl(var(--background)) 0%, hsl(var(--background)/0.5) 35%, transparent 100%)' }} />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        {/* Content */}
        <div className="absolute bottom-0 left-0 px-4 md:px-6 pb-8 md:pb-10 max-w-xl">
          {series.provider && (
            <span className="inline-block text-[10px] font-semibold bg-[var(--apple-blue)]/20 text-[var(--apple-blue)] px-2 py-0.5 rounded-md mb-3">
              {series.provider}
            </span>
          )}

          <h1 className="text-[28px] md:text-[40px] font-bold text-foreground tracking-tight leading-tight mb-2">
            {series.title}
          </h1>

          <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-4">
            {series.year && <span>{series.year}</span>}
            <span>{series.seasons.length} Temporada{series.seasons.length !== 1 ? 's' : ''}</span>
            {series.genre && <span>· {series.genre}</span>}
          </div>

          {series.description && (
            <p className="text-[13px] text-muted-foreground/80 mb-5 line-clamp-3">
              {series.description}
            </p>
          )}

          {firstEpisode && (
            <button
              onClick={() => router.push(`/watch/${firstEpisode.channelUuid}`)}
              className="btn-primary px-5 py-2.5 text-[14px] shadow-lg shadow-blue-500/20"
            >
              <Play className="w-4 h-4 fill-white" />
              Assistir S{String(season!.seasonNumber).padStart(2, '0')}E01
            </button>
          )}
        </div>

        {/* Poster right side */}
        {series.posterUrl && (
          <div className="hidden md:block absolute right-8 md:right-12 top-1/2 -translate-y-1/2 w-44 h-64 rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <Image src={series.posterUrl} alt={series.title} fill
              className="object-cover" unoptimized />
          </div>
        )}
      </div>

      {/* ── Season selector ─────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 md:px-6 py-2.5">
          {series.seasons.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveSeason(idx)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-all',
                activeSeason === idx
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              T{String(s.seasonNumber).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Episodes grid ───────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 mt-6">
        <h3 className="text-[14px] font-semibold text-foreground mb-4">
          {season?.title || `Temporada ${season?.seasonNumber}`}
          <span className="text-muted-foreground font-normal ml-2 text-[12px]">
            {season?.episodes.length} episódio{(season?.episodes.length || 0) !== 1 ? 's' : ''}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {season?.episodes.map(ep => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              seasonNumber={season.seasonNumber}
              onClick={() => router.push(`/watch/${ep.channelUuid}`)}
            />
          ))}
        </div>

        {(!season || season.episodes.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Tv className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[13px] text-muted-foreground">Nenhum episódio disponível</p>
          </div>
        )}
      </div>
    </div>
  )
}

function EpisodeCard({ episode, seasonNumber, onClick }: {
  episode: EpisodeItem; seasonNumber: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left group active:scale-[.98]"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-14 rounded-lg bg-secondary overflow-hidden relative">
        {episode.logoUrl ? (
          <Image
            src={episode.logoUrl}
            alt=""
            fill
            className="object-cover"
            sizes="80px"
            loading="lazy"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-foreground group-hover:text-[var(--apple-blue)] transition-colors">
          S{String(seasonNumber).padStart(2, '0')}E{String(episode.episodeNumber).padStart(2, '0')}
        </p>
        {episode.title && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {episode.title}
          </p>
        )}
      </div>

      <Play className="w-4 h-4 text-muted-foreground/50 group-hover:text-[var(--apple-blue)] flex-shrink-0 transition-colors" />
    </button>
  )
}
