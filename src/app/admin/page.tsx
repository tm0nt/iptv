'use client'
import { useEffect, useState } from 'react'
import { Users, TrendingUp, CreditCard, UserCheck, DollarSign, AlertTriangle, RefreshCw, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { MetricCard } from '@/components/admin/MetricCard'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

const MOCK_MONTHS = ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'].map((m, i) => ({
  month: m, receita: Math.floor(1400 + i * 380 + Math.random() * 200),
}))
const PIE_COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500']

export default function AdminDashboard() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/stats')
    setData(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const pie = data?.plans?.map((p: any) => ({ name: p.name, value: p.subscriberCount || 0 })) || []

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-[1200px] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Visão Geral</h1>
          <p className="text-[13px] text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="btn-ghost py-2 px-3 text-[13px]">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="surface rounded-2xl p-5 h-28 skeleton" />)}
        </div>
      ) : (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="MRR" value={formatCurrency(data?.mrr || 0)}
              subtitle="Receita mensal recorrente" icon={DollarSign} color="green"
              trend={{ value: 12.5, label: '' }} />
            <MetricCard title="Assinaturas Ativas" value={data?.activeSubscriptions || 0}
              icon={Activity} color="blue" trend={{ value: 8.2, label: '' }} />
            <MetricCard title="Novos Clientes" value={data?.newUsersThisMonth || 0}
              subtitle="Este mês" icon={Users} color="violet" />
            <MetricCard title="Churn Rate" value={`${(data?.churnRate || 0).toFixed(1)}%`}
              icon={AlertTriangle} color={(data?.churnRate || 0) > 5 ? 'red' : 'amber'} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Total Clientes"   value={data?.totalUsers || 0}  icon={Users}      color="blue" />
            <MetricCard title="Revendedores"     value={data?.totalResellers||0} icon={UserCheck}  color="violet" />
            <MetricCard title="ARR Projetado"    value={formatCurrency((data?.mrr||0)*12)}
              subtitle="Anual" icon={TrendingUp} color="green" />
            <MetricCard title="LTV Médio"        value={formatCurrency(data?.mrr&&data?.totalUsers?(data.mrr/data.totalUsers)*12:0)}
              icon={CreditCard} color="amber" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Area chart */}
            <div className="lg:col-span-2 surface rounded-2xl p-5">
              <p className="text-[14px] font-semibold text-foreground mb-0.5">Receita Mensal</p>
              <p className="text-[12px] text-muted-foreground mb-5">Últimos 6 meses</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={MOCK_MONTHS} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#007AFF" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [formatCurrency(v), 'Receita']} />
                  <Area type="monotone" dataKey="receita" stroke="#007AFF" strokeWidth={2} fill="url(#cg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pie */}
            <div className="surface rounded-2xl p-5">
              <p className="text-[14px] font-semibold text-foreground mb-0.5">Planos Ativos</p>
              <p className="text-[12px] text-muted-foreground mb-4">Distribuição</p>
              {pie.some((d: any) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                      {pie.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-[13px]">Sem dados</div>
              )}
            </div>
          </div>

          {/* Recent subs table */}
          <div className="surface rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border">
              <p className="text-[14px] font-semibold text-foreground">Assinaturas Recentes</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Últimas 10</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead><tr>
                  {['Cliente','Plano','Status','Valor','Data'].map(h => <th key={h}>{h}</th>)}
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
                          ACTIVE:'badge-green', EXPIRED:'badge-red',
                          SUSPENDED:'badge-amber', TRIAL:'badge-blue', PENDING_PAYMENT:'badge-gray',
                        }[sub.status] || 'badge-gray')}>
                          {{ ACTIVE:'Ativo', EXPIRED:'Expirado', SUSPENDED:'Suspenso', TRIAL:'Trial', PENDING_PAYMENT:'Aguard. Pag.' }[sub.status] || sub.status}
                        </span>
                      </td>
                      <td className="font-medium text-foreground text-[13px]">{formatCurrency(sub.plan.price)}</td>
                      <td className="text-[12px] text-muted-foreground">{formatDate(sub.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
