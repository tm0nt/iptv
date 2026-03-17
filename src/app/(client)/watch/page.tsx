'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CatalogCarousel, CatalogCarouselSkeleton, type ChannelItem } from '@/components/catalog/CatalogCarousel'
import { SeriesCarousel, SeriesCarouselSkeleton } from '@/components/catalog/SeriesCarousel'
import { HeroBanner } from '@/components/catalog/HeroBanner'
import { SubscriptionModal } from '@/components/catalog/SubscriptionModal'
import { useCatalog, useIntersectionObserver } from '@/hooks/useCatalog'
import { Loader2, Tv, Film, Zap, Baby, Compass, SlidersHorizontal, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeriesItem } from '@/types'

const CATEGORY_ICONS: Record<string, any> = {
  ESPORTES: Zap, FILMES: Film, SERIES: Clapperboard, INFANTIL: Baby,
  DOCUMENTARIOS: Compass, DEFAULT: SlidersHorizontal,
}

type TabType = 'all' | 'live' | 'series' | 'movies'

function WatchContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('all')

  // Progressive catalog loading
  const {
    categories: liveCategories,
    loading: liveLoading,
    loadingMore: liveLoadingMore,
    hasMore: liveHasMore,
    noSub,
    loadMore: loadMoreLive,
  } = useCatalog({ type: 'live', pageSize: 4 })

  // Series data (separate fetch)
  const [seriesByProvider, setSeriesByProvider] = useState<Record<string, SeriesItem[]>>({})
  const [seriesLoading, setSeriesLoading]       = useState(false)

  // Infinite scroll sentinel
  const sentinelRef = useIntersectionObserver(
    useCallback(() => {
      if (activeTab === 'all' || activeTab === 'live') {
        loadMoreLive()
      }
    }, [activeTab, loadMoreLive]),
    [activeTab, liveHasMore],
  )

  // Fetch series when tab is active
  useEffect(() => {
    if (activeTab !== 'all' && activeTab !== 'series') return
    if (Object.keys(seriesByProvider).length > 0) return // already loaded

    setSeriesLoading(true)
    fetch('/api/series?limit=48')
      .then(r => r.json())
      .then(data => {
        const items: SeriesItem[] = data.data || []
        // Group by provider
        const grouped: Record<string, SeriesItem[]> = {}
        for (const s of items) {
          const key = s.provider || 'Outros'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        }
        setSeriesByProvider(grouped)
      })
      .catch(() => {})
      .finally(() => setSeriesLoading(false))
  }, [activeTab, seriesByProvider])

  const refCode = typeof document !== 'undefined'
    ? document.cookie.split('; ').find(r => r.startsWith('ref_code='))?.split('=')[1]
    : undefined

  // Hero from first loaded category
  const hero    = liveCategories.flatMap(c => c.channels).find(ch => ch.isFeatured)
  const heroCat = hero ? liveCategories.find(c => c.channels.some(ch => ch.uuid === hero.uuid)) : null

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'all',    label: 'Todos',  icon: SlidersHorizontal },
    { key: 'live',   label: 'Ao Vivo', icon: Tv },
    { key: 'series', label: 'Séries',  icon: Clapperboard },
    { key: 'movies', label: 'Filmes',  icon: Film },
  ]

  // Filtered categories for the active tab
  const displayedLive = activeTab === 'all' || activeTab === 'live'
    ? liveCategories
    : []

  const showSeries = activeTab === 'all' || activeTab === 'series'

  // Initial loading state — only show full screen loader if nothing is loaded yet
  if (liveLoading && liveCategories.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Carregando catálogo...</p>
      </div>
    )
  }

  return (
    <>
      {noSub && <SubscriptionModal refCode={refCode} />}

      <div className="pb-16">
        {/* Hero — renders immediately from first batch */}
        {!noSub && hero && heroCat && (
          <HeroBanner channel={hero} category={heroCat.name} />
        )}

        {/* Tab bar */}
        {!noSub && (
          <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border/50">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 md:px-6 py-2.5">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <TabPill
                    key={tab.key}
                    active={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                  </TabPill>
                )
              })}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className={cn('space-y-8', hero && !noSub ? 'mt-8' : 'mt-6')}>

          {/* ── Live channels (progressively loaded) ───────────────────────── */}
          {displayedLive.map(cat => (
            <CatalogCarousel
              key={cat.id}
              title={cat.name}
              channels={cat.channels}
              variant={
                cat.name.toLowerCase().includes('filmes') ||
                cat.name.toLowerCase().includes('série') ? 'large' : 'default'
              }
            />
          ))}

          {/* ── Series section ─────────────────────────────────────────────── */}
          {showSeries && !noSub && (
            <>
              {seriesLoading && Object.keys(seriesByProvider).length === 0 && (
                <SeriesCarouselSkeleton />
              )}

              {Object.entries(seriesByProvider).map(([provider, items]) => (
                <SeriesCarousel
                  key={provider}
                  title={`Séries · ${provider}`}
                  series={items}
                />
              ))}
            </>
          )}

          {/* ── Loading more skeletons ─────────────────────────────────────── */}
          {(liveLoadingMore) && (
            <>
              <CatalogCarouselSkeleton />
              <CatalogCarouselSkeleton />
            </>
          )}

          {/* ── Infinite scroll sentinel ───────────────────────────────────── */}
          {liveHasMore && !noSub && (
            <div ref={sentinelRef} className="h-4" />
          )}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {displayedLive.length === 0 && Object.keys(seriesByProvider).length === 0 && !liveLoading && !seriesLoading && !noSub && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Tv className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-[13px] text-muted-foreground">Nenhum conteúdo disponível</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function TabPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-all',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  )
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    }>
      <WatchContent />
    </Suspense>
  )
}
