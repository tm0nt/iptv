'use client'
import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Calendar, Loader2, ArrowUpRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Stats {
  monthlyCommission: number; commissionRate: number
  totalClients: number; activeClients: number
}
const MOCK_PAYOUTS = [
  { id: '1', month: 'Fevereiro 2025', amount: 347.50, status: 'PAID', paidAt: '05/03/2025' },
  { id: '2', month: 'Janeiro 2025',   amount: 290.00, status: 'PAID', paidAt: '05/02/2025' },
  { id: '3', month: 'Dezembro 2024',  amount: 185.00, status: 'PAID', paidAt: '07/01/2025' },
]

export default function ResellerCommissions() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reseller/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-6 pt-20 md:pt-8 flex justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  const pct = ((stats?.commissionRate || 0.2) * 100).toFixed(0)

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">Comissões</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Taxa: <span className="text-[var(--apple-blue)] font-semibold">{pct}%</span> sobre o valor dos planos
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <DollarSign className="w-3.5 h-3.5 text-[var(--apple-green)]" />
            <span className="text-[12px]">Este mês</span>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(stats?.monthlyCommission || 0)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Estimado</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--apple-blue)]" />
            <span className="text-[12px]">Ativos</span>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{stats?.activeClients || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Gerando comissão</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Calendar className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[12px]">Pagamento</span>
          </div>
          <p className="text-2xl font-bold text-foreground">Dia 5</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Todo mês</p>
        </div>
      </div>

      {/* How it works */}
      <div className="surface rounded-2xl p-5">
        <h2 className="text-[14px] font-semibold text-foreground mb-3">Como funciona</h2>
        <div className="space-y-3">
          {[
            `Você recebe ${pct}% do valor de cada assinatura dos seus clientes`,
            'Calculado mensalmente com base nos clientes com assinatura ativa',
            'Pagamentos processados todo dia 5 do mês seguinte',
            'Clientes via seu link de afiliado são vinculados automaticamente',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--apple-blue)]/10 text-[var(--apple-blue)] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i+1}
              </span>
              <span className="text-[13px] text-muted-foreground">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payout history */}
      <div className="surface rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-border">
          <h2 className="text-[14px] font-semibold text-foreground">Histórico de Pagamentos</h2>
        </div>
        <div className="divide-y divide-border">
          {/* Current month — pending */}
          <div className="px-4 py-3.5 flex items-center justify-between bg-secondary/30">
            <div>
              <p className="text-[13px] font-medium text-foreground">Março 2025 (em aberto)</p>
              <p className="text-[12px] text-muted-foreground">Pagamento em 05/04/2025</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold text-foreground">{formatCurrency(stats?.monthlyCommission || 0)}</p>
              <span className="badge badge-amber">Pendente</span>
            </div>
          </div>
          {MOCK_PAYOUTS.map(p => (
            <div key={p.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-[13px] font-medium text-foreground">{p.month}</p>
                <p className="text-[12px] text-muted-foreground">Pago em {p.paidAt}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-foreground">{formatCurrency(p.amount)}</p>
                <span className="badge badge-green">Pago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
