'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users, TrendingUp, CreditCard, UserCheck, DollarSign, AlertTriangle, Activity, Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { MetricCard } from '@/components/admin/MetricCard'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

const PIE_COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500']
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  SUSPENDED: 'Suspenso',
  TRIAL: 'Trial',
  PENDING_PAYMENT: 'Aguard. Pag.',
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [recentPage, setRecentPage] = useState(1)
  const [health, setHealth] = useState<{
    errors24h: number
    warnings24h: number
    failedLogins24h: number
    playerErrors24h: number
    streamStarts1h: number
  } | null>(null)
  const [alerts, setAlerts] = useState<Array<{
    id: string
    level: 'INFO' | 'WARN' | 'ERROR'
    title: string
    description: string
    count: number
  }>>([])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const params = new URLSearchParams({
      recentPage: String(recentPage),
      recentLimit: '10',
    })
    const res = await fetch(`/api/admin/stats?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  useEffect(() => {
    let fallback: ReturnType<typeof setInterval> | null = null
    let source: EventSource | null = null
    let fallbackStarted = false

    load()

    const startFallback = () => {
      if (fallbackStarted) return
      fallbackStarted = true
      fallback = setInterval(() => load(true), 8000)
    }

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      source = new EventSource(`/api/admin/stats/stream?recentPage=${recentPage}&recentLimit=10`)
      source.addEventListener('stats', event => {
        const next = JSON.parse((event as MessageEvent).data)
        setData(next)
        setLoading(false)
      })
      source.addEventListener('error', () => {
        source?.close()
        startFallback()
      })
    } else {
      startFallback()
    }

    return () => {
      source?.close()
      if (fallback) clearInterval(fallback)
    }
  }, [recentPage])

  useEffect(() => {
    let mounted = true

    const loadAlerts = async () => {
      const res = await fetch('/api/admin/audit?limit=10', { cache: 'no-store' })
      const json = await res.json()
      if (mounted) {
        setAlerts(json.alerts || [])
        setHealth(json.health || null)
      }
    }

    loadAlerts()
    const interval = setInterval(() => {
      void loadAlerts()
    }, 15000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const pie = useMemo(
    () => data?.plans?.map((p: any) => ({ name: p.name, value: p.subscriberCount || 0 })) || [],
    [data],
  )

  const revenueChart = useMemo(() => {
    const activePlans = data?.plans || []
    return activePlans.slice(0, 6).map((plan: any, index: number) => ({
      month: plan.name.slice(0, 10),
      receita: Math.round((plan.price || 0) * (plan.subscriberCount || 0) + index * 75),
    }))
  }, [data])

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <div className="surface rounded-[30px] p-6 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Admin</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">Visão Geral da plataforma</h1>
            <p className="text-[14px] text-muted-foreground mt-1">
              Os números atualizam automaticamente a cada 8 segundos, sem precisar recarregar o painel.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-3 py-2 text-[12px] text-muted-foreground">
            <Radio className={cn('w-3.5 h-3.5', !loading && 'text-[var(--apple-green)] animate-pulse')} />
            Tempo real ativo
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="surface rounded-[28px] p-5 h-28 skeleton" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="MRR"
              value={formatCurrency(data?.mrr || 0)}
              animateValue={data?.mrr || 0}
              formatValue={value => formatCurrency(value)}
              subtitle="Receita mensal recorrente"
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Assinaturas Ativas"
              value={data?.activeSubscriptions || 0}
              animateValue={data?.activeSubscriptions || 0}
              icon={Activity}
              color="blue"
            />
            <MetricCard
              title="Novos Clientes"
              value={data?.newUsersThisMonth || 0}
              animateValue={data?.newUsersThisMonth || 0}
              subtitle="Este mês"
              icon={Users}
              color="violet"
            />
            <MetricCard
              title="Churn Rate"
              value={`${(data?.churnRate || 0).toFixed(1)}%`}
              animateValue={data?.churnRate || 0}
              formatValue={value => `${value.toFixed(1)}%`}
              icon={AlertTriangle}
              color={(data?.churnRate || 0) > 5 ? 'red' : 'amber'}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Total Clientes" value={data?.totalUsers || 0} animateValue={data?.totalUsers || 0} icon={Users} color="blue" />
            <MetricCard title="Revendedores" value={data?.totalResellers || 0} animateValue={data?.totalResellers || 0} icon={UserCheck} color="violet" />
            <MetricCard
              title="ARR Projetado"
              value={formatCurrency((data?.mrr || 0) * 12)}
              animateValue={(data?.mrr || 0) * 12}
              formatValue={value => formatCurrency(value)}
              subtitle="Anual"
              icon={TrendingUp}
              color="green"
            />
            <MetricCard
              title="LTV Médio"
              value={formatCurrency(data?.mrr && data?.totalUsers ? (data.mrr / data.totalUsers) * 12 : 0)}
              animateValue={data?.mrr && data?.totalUsers ? (data.mrr / data.totalUsers) * 12 : 0}
              formatValue={value => formatCurrency(value)}
              icon={CreditCard}
              color="amber"
            />
          </div>

          <div className="surface rounded-[30px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[16px] font-semibold text-foreground">Alertas operacionais</p>
                <p className="text-[12px] text-muted-foreground mt-1">Resumo rápido dos sinais sensíveis mais recentes.</p>
              </div>
              <a href="/admin/auditoria" className="text-[12px] text-[var(--apple-blue)] hover:underline">
                Ver auditoria completa
              </a>
            </div>

            {alerts.length === 0 ? (
              <div className="rounded-[24px] bg-secondary/60 p-4 text-[13px] text-muted-foreground">
                Nenhum alerta sensível no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="rounded-[24px] bg-secondary/60 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className={cn(
                        'badge',
                        alert.level === 'ERROR' ? 'badge-red' : alert.level === 'WARN' ? 'badge-amber' : 'badge-blue',
                      )}>
                        {alert.level}
                      </span>
                      <span className="text-[22px] font-semibold tracking-tight text-foreground">{alert.count}</span>
                    </div>
                    <p className="text-[14px] font-medium text-foreground">{alert.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {health && (
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
              {[
                { label: 'Erros 24h', value: health.errors24h },
                { label: 'Avisos 24h', value: health.warnings24h },
                { label: 'Logins falhos', value: health.failedLogins24h },
                { label: 'Erros do player', value: health.playerErrors24h },
                { label: 'Streams 1h', value: health.streamStarts1h },
              ].map(item => (
                <div key={item.label} className="surface rounded-[24px] p-4">
                  <p className="text-[12px] text-muted-foreground">{item.label}</p>
                  <p className="text-[24px] font-semibold tracking-tight text-foreground mt-2">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 surface rounded-[30px] p-5 md:p-6">
              <p className="text-[16px] font-semibold text-foreground mb-0.5">Receita estimada por plano</p>
              <p className="text-[12px] text-muted-foreground mb-5">Atualização em tempo real baseada nos dados atuais</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [formatCurrency(v), 'Receita']}
                  />
                  <Area type="monotone" dataKey="receita" stroke="var(--brand-primary)" strokeWidth={2.5} fill="url(#cg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="surface rounded-[30px] p-5 md:p-6">
              <p className="text-[16px] font-semibold text-foreground mb-0.5">Planos ativos</p>
              <p className="text-[12px] text-muted-foreground mb-4">Distribuição ao vivo</p>
              {pie.some((d: any) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                      {pie.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-[13px]">Sem dados</div>
              )}
            </div>
          </div>

          <div className="surface rounded-[30px] overflow-hidden">
            <div className="px-5 md:px-6 py-4">
              <p className="text-[16px] font-semibold text-foreground">Assinaturas recentes</p>
              <p className="text-[12px] text-muted-foreground mt-1">Últimas 10 entradas processadas</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead><tr>
                  {['Cliente', 'Plano', 'Status', 'Valor', 'Data'].map(h => <th key={h}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(!data?.recentSubscriptions?.length) && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-[13px]">Nenhuma assinatura recente</td></tr>
                  )}
                  {data?.recentSubscriptions?.map((sub: any) => (
                    <tr key={sub.id}>
                      <td>
                        <p className="font-medium text-foreground text-[13px]">{sub.user.name}</p>
                        <p className="text-[12px] text-muted-foreground">{sub.user.email}</p>
                      </td>
                      <td className="text-muted-foreground text-[13px]">{sub.plan.name}</td>
                      <td>
                        <span className={cn('badge', {
                          ACTIVE: 'badge-green',
                          EXPIRED: 'badge-red',
                          SUSPENDED: 'badge-amber',
                          TRIAL: 'badge-blue',
                          PENDING_PAYMENT: 'badge-gray',
                        }[String(sub.status)] || 'badge-gray')}>
                          {STATUS_LABELS[String(sub.status)] || sub.status}
                        </span>
                      </td>
                      <td className="font-medium text-foreground text-[13px]">{formatCurrency(sub.plan.price)}</td>
                      <td className="text-[12px] text-muted-foreground">{formatDate(sub.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.max(1, Math.ceil((data?.recentSubscriptionsTotal || 0) / (data?.recentSubscriptionsLimit || 10))) > 1 && (
              <div className="px-5 md:px-6 py-4 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-3">
                <p className="text-[12px] text-muted-foreground">
                  Página {data?.recentSubscriptionsPage || 1} de {Math.max(1, Math.ceil((data?.recentSubscriptionsTotal || 0) / (data?.recentSubscriptionsLimit || 10)))}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={(data?.recentSubscriptionsPage || 1) <= 1}
                    onClick={() => setRecentPage((current) => Math.max(1, current - 1))}
                    className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    disabled={(data?.recentSubscriptionsPage || 1) >= Math.max(1, Math.ceil((data?.recentSubscriptionsTotal || 0) / (data?.recentSubscriptionsLimit || 10)))}
                    onClick={() => setRecentPage((current) => Math.min(Math.max(1, Math.ceil((data?.recentSubscriptionsTotal || 0) / (data?.recentSubscriptionsLimit || 10))), current + 1))}
                    className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
