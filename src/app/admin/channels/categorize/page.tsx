'use client'

import { useState } from 'react'
import {
  Zap,
  Eye,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Tag,
  Globe,
  Flag,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PreviewItem {
  slug: string
  name: string
  count: number
}

interface PreviewData {
  total: number
  matched: number
  foreignDetected: number
  preview: PreviewItem[]
}

interface ResultItem {
  category: string
  count: number
}

interface ResultData {
  total: number
  updated: number
  unmatched: number
  foreignDetected: number
  elapsed: string
  breakdown: ResultItem[]
}

const ICONS: Record<string, string> = {
  adulto: '🔞',
  esportes: '⚽',
  noticias: '📰',
  infantil: '🧒',
  documentarios: '🌍',
  filmes: '🎬',
  series: '🎭',
  musica: '🎵',
  'tv-aberta': '📺',
  'tv-fechada': '📡',
  internacional: '🌐',
  _unmatched: '❓',
}

function normalizePreview(data: any): PreviewData {
  return {
    total: Number(data?.total ?? 0),
    matched: Number(data?.matched ?? 0),
    foreignDetected: Number(data?.foreignDetected ?? data?.foreign_detected ?? 0),
    preview: Array.isArray(data?.preview)
      ? data.preview.map((item: any) => ({
          slug: String(item?.slug ?? ''),
          name: String(item?.name ?? item?.slug ?? 'Sem nome'),
          count: Number(item?.count ?? 0),
        }))
      : [],
  }
}

function normalizeResult(data: any): ResultData {
  return {
    total: Number(data?.total ?? 0),
    updated: Number(data?.updated ?? 0),
    unmatched: Number(data?.unmatched ?? 0),
    foreignDetected: Number(data?.foreignDetected ?? data?.foreign_detected ?? 0),
    elapsed: String(data?.elapsed ?? '0s'),
    breakdown: Array.isArray(data?.breakdown)
      ? data.breakdown.map((item: any) => ({
          category: String(item?.category ?? 'Sem categoria'),
          count: Number(item?.count ?? 0),
        }))
      : [],
  }
}

export default function AutoCategorizePage() {
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [onlyUn, setOnlyUn] = useState(true)
  const [step, setStep] = useState<'idle' | 'previewed' | 'done'>('idle')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(
        `/api/admin/auto-categorize?only_uncategorized=${onlyUn ? '1' : '0'}`
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Falha ao analisar os canais')
      }

      const normalized = normalizePreview(data)
      setPreview(normalized)
      setShowAll(false)
      setStep('previewed')
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado ao carregar a prévia')
      setPreview(null)
      setStep('idle')
    } finally {
      setLoading(false)
    }
  }

  async function run() {
    setRunning(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          only_uncategorized: onlyUn,
          dry_run: false,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Falha ao categorizar os canais')
      }

      const normalized = normalizeResult(data)
      setResult(normalized)
      setStep('done')
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado ao categorizar')
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  const matchRate = preview
    ? Math.round((preview.matched / Math.max(preview.total, 1)) * 100)
    : 0

  const catItems = preview?.preview.filter((p) => p.slug !== '_unmatched') ?? []
  const unmatched = preview?.preview.find((p) => p.slug === '_unmatched')?.count ?? 0
  const visibleCats = showAll ? catItems : catItems.slice(0, 8)

  const statCards = result
    ? ([
        ['Categorizados', result.updated ?? 0, 'text-[var(--apple-green)]'],
        ['Estrangeiros', result.foreignDetected ?? 0, 'text-[var(--apple-blue)]'],
        ['Sem match', result.unmatched ?? 0, 'text-[var(--apple-amber)]'],
        ['Total', result.total ?? 0, 'text-foreground'],
      ] as const)
    : []

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-2xl">
      <Link
        href="/admin/channels"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Canais
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">
            Categorização Automática
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Detecta país de origem e categoriza sem misturar canais estrangeiros
          </p>
        </div>
      </div>

      {error && (
        <div className="surface rounded-2xl p-4 mb-5 border border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Erro</p>
              <p className="text-[12px] text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="surface rounded-2xl p-5 mb-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--apple-blue)]" />
          <p className="text-[13px] font-semibold text-foreground">
            Detecção de país de origem
          </p>
        </div>

        <p className="text-[12px] text-muted-foreground">
          Canais com sinais de outros países no nome ou grupo M3U são automaticamente
          enviados para <strong>Internacional</strong> — mesmo que tenham o mesmo nome
          de um canal brasileiro.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Flag className="w-3 h-3 text-green-500" />
              <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">
                BR → categoria correta
              </p>
            </div>

            <div className="space-y-1">
              {[
                ['ESPN Brasil HD', 'Esportes'],
                ['Globo SP FHD', 'TV Aberta'],
                ['HBO Max BR', 'Filmes'],
              ].map(([n, c]) => (
                <div key={n} className="flex justify-between text-[11px]">
                  <span className="text-foreground truncate mr-2">{n}</span>
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0">
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe className="w-3 h-3 text-[var(--apple-blue)]" />
              <p className="text-[11px] font-semibold text-[var(--apple-blue)]">
                Estrangeiro → Internacional
              </p>
            </div>

            <div className="space-y-1">
              {[
                ['ESPN Romania HD', 'Internacional'],
                ['CNN Turkey', 'Internacional'],
                ['HBO Germany', 'Internacional'],
              ].map(([n, c]) => (
                <div key={n} className="flex justify-between text-[11px]">
                  <span className="text-foreground truncate mr-2">{n}</span>
                  <span className="text-[var(--apple-blue)] flex-shrink-0">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="surface rounded-2xl p-5 mb-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setOnlyUn((v) => !v)}
            className={cn(
              'w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
              onlyUn ? 'bg-[var(--apple-blue)]' : 'bg-border'
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                onlyUn && 'translate-x-4'
              )}
            />
          </button>

          <div>
            <p className="text-[13px] font-medium text-foreground">
              Apenas canais sem categoria
            </p>
            <p className="text-[11px] text-muted-foreground">
              {onlyUn
                ? 'Processa somente os sem categoria'
                : 'Reprocessa todos (sobrescreve categorias existentes)'}
            </p>
          </div>
        </label>
      </div>

      {step === 'idle' && (
        <button
          onClick={loadPreview}
          disabled={loading}
          className="btn-primary w-full py-3 text-[14px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando canais...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" /> Analisar antes de categorizar
            </>
          )}
        </button>
      )}

      {step === 'previewed' && preview && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div className="surface rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {(preview.total ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total</p>
            </div>

            <div className="surface rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-[var(--apple-green)]">
                {(preview.matched ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Identificados
              </p>
            </div>

            <div className="surface rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-[var(--apple-blue)]">
                {(preview.foreignDetected ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                🌐 Estrangeiros
              </p>
            </div>
          </div>

          <div className="surface rounded-2xl p-4">
            <div className="flex justify-between text-[12px] mb-2">
              <span className="text-muted-foreground">Taxa de identificação</span>
              <span className="font-semibold text-foreground">{matchRate}%</span>
            </div>

            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  matchRate > 70
                    ? 'bg-[var(--apple-green)]'
                    : matchRate > 40
                    ? 'bg-[var(--apple-amber)]'
                    : 'bg-[var(--apple-red)]'
                )}
                style={{ width: `${matchRate}%` }}
              />
            </div>

            {unmatched > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                {unmatched.toLocaleString()} canais sem correspondência ficarão sem
                categoria
              </p>
            )}
          </div>

          <div className="surface rounded-2xl overflow-hidden">
            <p className="text-[13px] font-semibold text-foreground px-5 py-3.5 border-b border-border">
              Distribuição por categoria
            </p>

            <div className="divide-y divide-border">
              {visibleCats.map((p) => (
                <div key={p.slug + p.name} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-lg w-7 text-center flex-shrink-0">
                    {ICONS[p.slug] || '📺'}
                  </span>

                  <p className="flex-1 text-[13px] font-medium text-foreground">
                    {p.name}
                  </p>

                  <div className="flex items-center gap-2.5">
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-[var(--apple-blue)] rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (p.count / Math.max(preview.matched, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="badge badge-blue text-[10px] w-16 justify-center tabular-nums">
                      {(p.count ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {catItems.length > 8 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> +{catItems.length - 8}{' '}
                      categorias
                    </>
                  )}
                </button>
              )}

              {unmatched > 0 && (
                <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/5">
                  <span className="text-lg w-7 text-center">❓</span>
                  <p className="flex-1 text-[13px] text-muted-foreground">
                    Sem correspondência
                  </p>
                  <span className="badge badge-amber text-[10px]">
                    {unmatched.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep('idle')
                setPreview(null)
                setError(null)
              }}
              className="btn-secondary flex-1 py-3"
            >
              Cancelar
            </button>

            <button
              onClick={run}
              disabled={running || (preview.matched ?? 0) === 0}
              className="btn-primary flex-1 py-3 text-[14px] disabled:opacity-40"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Categorizando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Categorizar{' '}
                  {(preview.matched ?? 0).toLocaleString()}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4 animate-fade-in">
          <div className="surface rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[var(--apple-green)]" />
            </div>

            <p className="text-[18px] font-bold text-foreground mb-1">Pronto!</p>
            <p className="text-[13px] text-muted-foreground">
              {(result.updated ?? 0).toLocaleString()} canais categorizados em{' '}
              {result.elapsed || '0s'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map(([label, value, cls]) => (
              <div key={label} className="surface rounded-xl p-3 text-center">
                <p className={cn('text-xl font-bold tabular-nums', cls)}>
                  {(value ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="surface rounded-2xl overflow-hidden">
            <p className="text-[13px] font-semibold text-foreground px-5 py-3.5 border-b border-border">
              Resultado
            </p>

            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {result.breakdown.length > 0 ? (
                result.breakdown.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <p className="text-[13px] font-medium text-foreground">
                      {item.category}
                    </p>
                    <span className="badge badge-blue text-[10px]">
                      {(item.count ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-4 text-[12px] text-muted-foreground">
                  Nenhum detalhamento retornado pela API.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep('idle')
                setPreview(null)
                setResult(null)
                setError(null)
                setShowAll(false)
              }}
              className="btn-secondary flex-1 py-2.5"
            >
              <RefreshCw className="w-4 h-4" /> Recategorizar
            </button>

            <Link
              href="/admin/channels"
              className="btn-primary flex-1 py-2.5 inline-flex items-center justify-center gap-2 text-[14px]"
            >
              <Tag className="w-4 h-4" /> Ver canais
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
