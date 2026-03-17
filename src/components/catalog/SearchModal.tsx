'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Tv, Loader2, Clock, TrendingUp, Film, Clapperboard } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SearchResult {
  uuid: string; name: string; logoUrl?: string | null
  category: { name: string }; viewCount: number; isFeatured: boolean
  contentType?: string
}

interface SeriesResult {
  id: string; title: string; slug: string; posterUrl?: string | null
  provider?: string | null; seasonCount: number; episodeCount: number
}

interface SearchModalProps {
  onClose: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const [q, setQ]             = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [series, setSeries]   = useState<SeriesResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent]   = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  useEffect(() => {
    const r = localStorage.getItem('sb_recent') || '[]'
    try { setRecent(JSON.parse(r).slice(0, 5)) } catch {}
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Debounced search
  useEffect(() => {
    if (q.length < 2) { setResults([]); setSeries([]); return }
    const tid = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results || [])
        setSeries(data.series || [])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(tid)
  }, [q])

  const navigateChannel = (channel: SearchResult) => {
    const updated = [channel.name, ...recent.filter(r => r !== channel.name)].slice(0, 5)
    localStorage.setItem('sb_recent', JSON.stringify(updated))
    onClose()
    router.push(`/watch/${channel.uuid}`)
  }

  const navigateSeries = (s: SeriesResult) => {
    const updated = [s.title, ...recent.filter(r => r !== s.title)].slice(0, 5)
    localStorage.setItem('sb_recent', JSON.stringify(updated))
    onClose()
    router.push(`/series/${s.id}`)
  }

  const hasResults = results.length > 0 || series.length > 0

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 inset-x-0 z-[70] flex justify-center px-4 pt-4 sm:pt-16 animate-fade-in">
        <div
          className="w-full max-w-xl"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="relative flex items-center bg-card border border-border rounded-2xl overflow-hidden">
            <Search className="w-4 h-4 text-muted-foreground ml-4 flex-shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter' && results[0]) navigateChannel(results[0])
              }}
              placeholder="Buscar canais, filmes, séries..."
              className="flex-1 px-3 py-4 text-[15px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-3" />}
            {q && !loading && (
              <button onClick={() => setQ('')} className="mr-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="border-l border-border px-4 py-4 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Esc
            </button>
          </div>

          {/* Results */}
          {(hasResults || (q.length < 2 && recent.length > 0)) && (
            <div className="bg-card border border-border rounded-2xl mt-2 overflow-hidden max-h-[65vh] overflow-y-auto">
              {/* Recent searches */}
              {q.length < 2 && recent.length > 0 && (
                <div className="p-3">
                  <p className="text-label px-2 mb-2">Recentes</p>
                  {recent.map(r => (
                    <button key={r}
                      onClick={() => setQ(r)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-[13px] text-foreground">{r}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Series results */}
              {series.length > 0 && (
                <div className="p-3 border-b border-border/50">
                  <p className="text-label px-2 mb-2">
                    <Clapperboard className="w-3 h-3 inline mr-1" />
                    Séries
                  </p>
                  <div className="space-y-0.5">
                    {series.map(s => (
                      <button
                        key={s.id}
                        onClick={() => navigateSeries(s)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left group"
                      >
                        <div className="w-9 h-12 rounded-lg bg-secondary border border-border flex-shrink-0 overflow-hidden relative">
                          {s.posterUrl
                            ? <Image src={s.posterUrl} alt="" fill className="object-cover" unoptimized />
                            : <Film className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate group-hover:text-[var(--apple-blue)] transition-colors">
                            {s.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.seasonCount} temp · {s.episodeCount} ep
                            {s.provider && ` · ${s.provider}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel results */}
              {results.length > 0 && (
                <div className="p-3">
                  {q.length >= 2 && (
                    <p className="text-label px-2 mb-2">
                      <Tv className="w-3 h-3 inline mr-1" />
                      Canais e Filmes · {results.length}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {results.map(ch => (
                      <button
                        key={ch.uuid}
                        onClick={() => navigateChannel(ch)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex-shrink-0 overflow-hidden relative">
                          {ch.logoUrl
                            ? <Image src={ch.logoUrl} alt="" fill className="object-contain p-1" unoptimized />
                            : <Tv className="w-4 h-4 text-muted-foreground m-auto mt-2.5" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate group-hover:text-[var(--apple-blue)] transition-colors">
                            {ch.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {ch.category.name}
                            {ch.contentType === 'MOVIE' && ' · Filme'}
                          </p>
                        </div>
                        {ch.isFeatured && (
                          <TrendingUp className="w-3.5 h-3.5 text-[var(--apple-amber)] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {q.length >= 2 && !hasResults && !loading && (
                <div className="py-8 text-center text-muted-foreground text-[13px]">
                  Nenhum resultado para "{q}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
