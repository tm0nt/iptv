'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  channels: Array<{
    uuid: string; name: string; tvgName?: string | null
    logoUrl?: string | null; isFeatured?: boolean; viewCount?: number
    contentType?: string
  }>
}

interface UseCatalogOptions {
  type?: 'live' | 'movie' | 'series' | 'all'
  pageSize?: number
}

interface UseCatalogReturn {
  categories:  Category[]
  loading:     boolean   // initial load
  loadingMore: boolean   // loading next page
  hasMore:     boolean
  noSub:       boolean
  error:       string | null
  loadMore:    () => void
  totalCategories: number
}

/**
 * Progressive catalog loader.
 *
 * Loads categories in batches (default 4 at a time).
 * The first batch renders immediately — no waiting for the full catalog.
 * Subsequent batches load on scroll (via IntersectionObserver) or manual trigger.
 */
export function useCatalog(options: UseCatalogOptions = {}): UseCatalogReturn {
  const { type = 'live', pageSize = 4 } = options

  const [categories, setCategories]         = useState<Category[]>([])
  const [page, setPage]                     = useState(0)
  const [loading, setLoading]               = useState(true)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [hasMore, setHasMore]               = useState(true)
  const [noSub, setNoSub]                   = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [totalCategories, setTotalCategories] = useState(0)

  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async (pageNum: number) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    const isFirst = pageNum === 0
    if (isFirst) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        page:  String(pageNum),
        limit: String(pageSize),
        type,
      })

      const res = await fetch(`/api/channels?${params}`)

      if (res.status === 403) {
        setNoSub(true)
        setHasMore(false)
        return
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const newCats: Category[] = data.categories || []

      setCategories(prev => {
        // Deduplicate by id
        const existingIds = new Set(prev.map(c => c.id))
        const unique      = newCats.filter(c => !existingIds.has(c.id))
        return [...prev, ...unique]
      })

      setHasMore(data.hasMore ?? false)
      setTotalCategories(data.totalCategories ?? 0)
      setPage(pageNum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar catálogo')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      fetchingRef.current = false
    }
  }, [type, pageSize])

  // Load first page on mount
  useEffect(() => {
    setCategories([])
    setPage(0)
    setHasMore(true)
    setNoSub(false)
    setError(null)
    fetchPage(0)
  }, [type, fetchPage])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || fetchingRef.current) return
    fetchPage(page + 1)
  }, [hasMore, loadingMore, page, fetchPage])

  return {
    categories,
    loading,
    loadingMore,
    hasMore,
    noSub,
    error,
    loadMore,
    totalCategories,
  }
}

/**
 * IntersectionObserver hook for triggering loadMore when sentinel is visible.
 */
export function useIntersectionObserver(
  callback: () => void,
  deps: unknown[] = [],
) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          callback()
        }
      },
      { rootMargin: '400px' }, // trigger 400px before visible
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [callback, ...deps])

  return sentinelRef
}
