'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Search, ShieldCheck, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type AuditLog = {
  id: string
  level: string
  action: string
  entityType: string
  entityId?: string | null
  message: string
  actorId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: any
  createdAt: string
}

type AuditAlert = {
  id: string
  level: 'INFO' | 'WARN' | 'ERROR'
  title: string
  description: string
  action?: string
  count: number
}

type AuditHealth = {
  errors24h: number
  warnings24h: number
  failedLogins24h: number
  playerErrors24h: number
  streamStarts1h: number
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [level, setLevel] = useState('')
  const [period, setPeriod] = useState('7d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [alerts, setAlerts] = useState<AuditAlert[]>([])
  const [health, setHealth] = useState<AuditHealth | null>(null)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const params = new URLSearchParams({ limit: '40', page: String(page) })
    if (query.trim()) params.set('q', query.trim())
    if (action) params.set('action', action)
    if (entityType) params.set('entityType', entityType)
    if (level) params.set('level', level)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const res = await fetch(`/api/admin/audit?${params.toString()}`)
    const data = await res.json()

    setLogs(data.logs || [])
    setTotal(data.total || 0)
    setActions(data.actions || [])
    setEntityTypes(data.entityTypes || [])
    setAlerts(data.alerts || [])
    setHealth(data.health || null)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(true), 300)
    return () => clearTimeout(timer)
  }, [query, action, entityType, level, dateFrom, dateTo, page])

  useEffect(() => {
    const interval = setInterval(() => load(true), 10000)
    return () => clearInterval(interval)
  }, [query, action, entityType, level, dateFrom, dateTo, page])

  useEffect(() => {
    if (period === 'custom') return

    const now = new Date()
    const from = new Date()

    if (period === '24h') {
      from.setDate(now.getDate() - 1)
    } else if (period === '30d') {
      from.setDate(now.getDate() - 30)
    } else {
      from.setDate(now.getDate() - 7)
    }

    setDateFrom(from.toISOString().slice(0, 10))
    setDateTo(now.toISOString().slice(0, 10))
  }, [period])

  function exportCsv() {
    const params = new URLSearchParams({ limit: '5000', format: 'csv' })
    if (query.trim()) params.set('q', query.trim())
    if (action) params.set('action', action)
    if (entityType) params.set('entityType', entityType)
    if (level) params.set('level', level)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    window.open(`/api/admin/audit?${params.toString()}`, '_blank')
  }

  useEffect(() => {
    setPage(1)
  }, [query, action, entityType, level, dateFrom, dateTo])

  const groupedSummary = useMemo(() => {
    return [
      { label: 'Eventos exibidos', value: logs.length },
      { label: 'Erros', value: logs.filter(log => log.level === 'ERROR').length },
      { label: 'Ações únicas', value: new Set(logs.map(log => log.action)).size },
    ]
  }, [logs])

  const totalPages = Math.max(1, Math.ceil(total / 40))

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <div className="surface rounded-[30px] p-6 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Auditoria</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">Linha do tempo da plataforma</h1>
            <p className="text-[14px] text-muted-foreground mt-1">
              Visualize alterações do admin, criação de contas, pagamentos, reprodução e snapshots automáticos.
            </p>
          </div>
          <button onClick={() => load(true)} className="btn-secondary px-4 py-2.5 text-[13px]">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar agora
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {groupedSummary.map(item => (
          <div key={item.label} className="surface rounded-[28px] p-5">
            <p className="text-[12px] text-muted-foreground">{item.label}</p>
            <p className="text-[28px] font-semibold tracking-tight text-foreground mt-2">{item.value}</p>
          </div>
        ))}
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {[
            { label: 'Erros 24h', value: health.errors24h },
            { label: 'Avisos 24h', value: health.warnings24h },
            { label: 'Logins falhos 24h', value: health.failedLogins24h },
            { label: 'Erros do player 24h', value: health.playerErrors24h },
            { label: 'Streams na ultima hora', value: health.streamStarts1h },
          ].map(item => (
            <div key={item.label} className="surface rounded-[24px] p-4">
              <p className="text-[12px] text-muted-foreground">{item.label}</p>
              <p className="text-[24px] font-semibold tracking-tight text-foreground mt-2">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="surface rounded-[30px] p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[16px] font-semibold text-foreground">Alertas sensiveis</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Sinais recentes que merecem atencao no operacional e na seguranca.
            </p>
          </div>
          <span className="badge badge-blue">Monitorado continuamente</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[24px] bg-secondary/70 p-4 space-y-3">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-[24px] bg-secondary/60 p-5 text-[13px] text-muted-foreground">
            Nenhum alerta sensivel no momento. A auditoria continua acompanhando autenticacao, pagamentos, streams e alteracoes administrativas.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {alerts.map(alert => (
              <div key={alert.id} className="rounded-[24px] bg-secondary/60 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${alert.level === 'ERROR' ? 'badge-red' : alert.level === 'WARN' ? 'badge-amber' : 'badge-blue'}`}>
                        {alert.level}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">{alert.action || 'system.monitor'}</span>
                    </div>
                    <p className="text-[14px] font-medium text-foreground">{alert.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">{alert.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Qtd.</p>
                    <p className="text-[24px] font-semibold tracking-tight text-foreground">{alert.count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="surface rounded-[30px] p-5 md:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_170px_170px_140px_160px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="field-input pl-9"
              placeholder="Buscar por mensagem, email, ação ou entidade..."
            />
          </div>
          <select value={action} onChange={e => setAction(e.target.value)} className="field-input">
            <option value="">Todas as ações</option>
            {actions.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} className="field-input">
            <option value="">Todas as entidades</option>
            {entityTypes.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value)} className="field-input">
            <option value="">Todas as severidades</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="field-input">
            <option value="24h">Ultimas 24h</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>
          <button onClick={exportCsv} className="btn-secondary px-4 py-2.5 text-[13px]">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-label mb-1.5 block">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setPeriod('custom')
                setDateFrom(e.target.value)
              }}
              className="field-input"
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setPeriod('custom')
                setDateTo(e.target.value)
              }}
              className="field-input"
            />
          </div>
        </div>
      </div>

      <div className="surface rounded-[30px] overflow-hidden">
        <div className="px-5 md:px-6 py-4">
          <p className="text-[16px] font-semibold text-foreground">Eventos recentes</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Atualização automática a cada 10 segundos. {total.toLocaleString()} evento(s) encontrados.
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="rounded-[24px] bg-secondary/70 p-4 space-y-3">
                <Skeleton className="h-4 w-56 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 md:p-5 space-y-3">
            {logs.length === 0 && (
              <div className="rounded-[24px] bg-secondary/60 p-6 text-[13px] text-muted-foreground">
                Nenhum evento encontrado para os filtros selecionados.
              </div>
            )}

            {logs.map(log => (
              <div key={log.id} className="rounded-[24px] bg-secondary/60 p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="badge badge-blue">{log.entityType}</span>
                      <span className={`badge ${log.level === 'ERROR' ? 'badge-red' : log.level === 'WARN' ? 'badge-amber' : 'badge-green'}`}>
                        {log.level}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">{log.action}</span>
                    </div>
                    <p className="text-[14px] font-medium text-foreground">{log.message}</p>
                    <div className="mt-3 grid gap-1 text-[12px] text-muted-foreground">
                      <p>
                        <ShieldCheck className="w-3.5 h-3.5 inline-block mr-1.5" />
                        {log.actorEmail || 'Sistema'} · {log.actorRole || 'SYSTEM'}
                      </p>
                      {log.entityId && <p>ID: <span className="font-mono">{log.entityId}</span></p>}
                      {log.ipAddress && <p>IP: {log.ipAddress}</p>}
                    </div>
                    {log.metadata && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[12px] text-[var(--apple-blue)]">Ver metadados</summary>
                        <pre className="mt-2 overflow-x-auto rounded-2xl bg-background/70 p-3 text-[11px] text-muted-foreground">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                    <Activity className="w-3.5 h-3.5" />
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="px-5 md:px-6 py-4 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
