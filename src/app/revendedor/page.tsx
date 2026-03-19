'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Users, DollarSign, TrendingUp, Copy, UserPlus,
  Loader2, Check, X, QrCode, ExternalLink, Radio,
} from 'lucide-react'
import { MetricCard } from '@/components/admin/MetricCard'
import { PageIntro } from '@/components/admin/PageIntro'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface Stats {
  totalClients: number; activeClients: number; newThisMonth: number
  monthlyCommission: number; commissionRate: number; referralCode: string
  affiliateClicks: number; conversionRate: number
}
interface SubRow {
  id: string; status: string; expiresAt: string
  user: { name: string; email: string }
  plan: { name: string; price: number }
}
interface Plan { id: string; name: string; price: number; interval: string; durationDays: number }

const emptyForm = { name: '', email: '', password: '', planId: '' }
type ModalStep = 'form' | 'pix' | 'done'

export default function ResellerDashboard() {
  const { data: session }                 = useSession()
  const [stats,     setStats]             = useState<Stats | null>(null)
  const [clients,   setClients]           = useState<SubRow[]>([])
  const [plans,     setPlans]             = useState<Plan[]>([])
  const [loading,   setLoading]           = useState(true)
  const [modal,     setModal]             = useState(false)
  const [modalStep, setModalStep]         = useState<ModalStep>('form')
  const [form,      setForm]              = useState(emptyForm)
  const [saving,    setSaving]            = useState(false)
  const [copied,    setCopied]            = useState(false)
  const [pixData,   setPixData]           = useState<any>(null)
  const [pixCopied, setPixCopied]         = useState(false)

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    const [s, c, p] = await Promise.all([
      fetch('/api/reseller/stats').then(r => r.json()),
      fetch('/api/reseller/clients').then(r => r.json()),
      fetch('/api/plans').then(r => r.json()),   // ← uses public /api/plans now
    ])
    setStats(s); setClients(c.subscriptions || []); setPlans(p.plans || [])
    setLoading(false)
  }
  useEffect(() => {
    let fallback: ReturnType<typeof setInterval> | null = null
    let source: EventSource | null = null
    let fallbackStarted = false

    loadData()

    const startFallback = () => {
      if (fallbackStarted) return
      fallbackStarted = true
      fallback = setInterval(() => loadData(true), 8000)
    }

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      source = new EventSource('/api/reseller/stats/stream')
      source.addEventListener('stats', event => {
        const next = JSON.parse((event as MessageEvent).data)
        setStats(next)
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
  }, [])

  function copyAffiliateLink() {
    if (!stats?.referralCode) return
    navigator.clipboard.writeText(`${window.location.origin}/api/affiliate/${stats.referralCode}`)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  async function handleCreateClient() {
    setSaving(true)
    try {
      const res = await fetch('/api/reseller/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Generate PIX for client
      const pixRes = await fetch('/api/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: form.planId,
          resellerId: (session?.user as any)?.id,
          clientUserId: data.user?.id,
        }),
      })
      const pixJson = await pixRes.json()
      if (pixRes.ok && pixJson.pixCode) {
        setPixData(pixJson)
        setModalStep('pix')
      } else {
        setModalStep('done')
      }
      await loadData()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setModal(false); setModalStep('form'); setForm(emptyForm); setPixData(null)
  }

  if (loading) return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-52 rounded-full skeleton" />
        <div className="h-4 w-64 rounded-full skeleton" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="surface rounded-[28px] p-5 h-28 skeleton" />)}
      </div>
      <div className="surface rounded-[28px] p-5 h-28 skeleton" />
      <div className="surface rounded-[28px] p-5 h-72 skeleton" />
    </div>
  )

  const affiliateUrl = stats?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/affiliate/${stats.referralCode}`
    : ''

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 space-y-6 max-w-7xl">
      <PageIntro
        eyebrow="Revendedor"
        title={`Olá, ${(session?.user as any)?.name?.split(' ')[0]}`}
        description="Acompanhe sua operação em tempo real, compartilhe seu link e gerencie clientes no mesmo padrão visual do admin."
        actions={(
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-3 py-2 text-[12px] text-muted-foreground">
            <Radio className={cn('w-3.5 h-3.5', !loading && 'text-[var(--apple-green)] animate-pulse')} />
            Tempo real ativo
          </div>
        )}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Comissão/mês" value={formatCurrency(stats?.monthlyCommission || 0)}
          animateValue={stats?.monthlyCommission || 0}
          formatValue={value => formatCurrency(value)}
          subtitle={`${((stats?.commissionRate || .2) * 100).toFixed(0)}% sobre receita`}
          icon={DollarSign} color="green" />
        <MetricCard title="Clientes Ativos" value={stats?.activeClients || 0} animateValue={stats?.activeClients || 0}
          subtitle={`de ${stats?.totalClients || 0} total`} icon={Users} color="blue" />
        <MetricCard title="Novos este mês" value={stats?.newThisMonth || 0} animateValue={stats?.newThisMonth || 0}
          icon={TrendingUp} color="violet" />
        <MetricCard title="Conversão" value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
          animateValue={stats?.conversionRate || 0}
          formatValue={value => `${value.toFixed(1)}%`}
          subtitle={`${stats?.affiliateClicks || 0} cliques`} icon={ExternalLink} color="amber" />
      </div>

      {/* Affiliate link */}
      <div className="surface rounded-[30px] p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[16px] font-semibold text-foreground">Link de Afiliado</p>
            <p className="text-[13px] text-muted-foreground mt-1">Compartilhe e ganhe comissão automática</p>
          </div>
          <span className="badge badge-blue">Link ativo</span>
        </div>
        <div className="flex gap-2">
          <code className="flex-1 text-[11px] bg-secondary px-3 py-3 rounded-2xl font-mono text-muted-foreground truncate">
            {affiliateUrl || 'Não disponível'}
          </code>
          <button onClick={copyAffiliateLink}
            className={cn('btn-secondary px-3.5 text-[12px] flex-shrink-0',
              copied && 'text-[var(--apple-green)]')}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Clients table */}
      <div className="surface rounded-[30px] overflow-hidden">
        <div className="px-5 md:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[16px] font-semibold text-foreground">Meus Clientes</p>
            <p className="text-[13px] text-muted-foreground mt-1">{clients.length} gerenciados</p>
          </div>
          <button onClick={() => { setModal(true); setModalStep('form') }}
            className="btn-primary py-2.5 px-4 text-[13px]">
            <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead><tr>
              {['Cliente', 'Plano', 'Status', 'Expira'].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-[13px]">
                  Nenhum cliente ainda
                </td></tr>
              )}
              {clients.map(sub => (
                <tr key={sub.id}>
                  <td>
                    <div>
                      <p className="font-medium text-foreground text-[13px]">{sub.user.name}</p>
                      <p className="text-[12px] text-muted-foreground">{sub.user.email}</p>
                    </div>
                  </td>
                  <td className="text-muted-foreground text-[13px]">{sub.plan.name}</td>
                  <td>
                    <span className={cn('badge', sub.status === 'ACTIVE' ? 'badge-green' : 'badge-red')}>
                      {sub.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-[12px] text-muted-foreground">{formatDate(sub.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            {/* Form step */}
            {modalStep === 'form' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[16px] font-semibold">Novo Cliente</h2>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Um link PIX será gerado automaticamente</p>
                  </div>
                  <button onClick={closeModal} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'name',     label: 'Nome completo', type: 'text',     ph: 'João Silva' },
                    { key: 'email',    label: 'Email',         type: 'email',    ph: 'joao@email.com' },
                    { key: 'password', label: 'Senha inicial', type: 'password', ph: '••••••••' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-label mb-1.5 block">{f.label}</label>
                      <input type={f.type} placeholder={f.ph}
                        value={(form as any)[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="field-input" />
                    </div>
                  ))}
                  <div>
                    <label className="text-label mb-1.5 block">Plano</label>
                    <select value={form.planId}
                      onChange={e => setForm(p => ({ ...p, planId: e.target.value }))}
                      className="field-input">
                      <option value="">Selecionar plano...</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-5">
                  <button onClick={closeModal} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                  <button onClick={handleCreateClient}
                    disabled={saving || !form.name || !form.email || !form.planId}
                    className="btn-primary flex-1 py-2.5">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><UserPlus className="w-4 h-4" /> Criar + Gerar PIX</>}
                  </button>
                </div>
              </>
            )}

            {/* PIX step */}
            {modalStep === 'pix' && pixData && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold">PIX gerado para o cliente</h2>
                  <button onClick={closeModal} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Copie o código PIX abaixo e envie ao cliente. A assinatura será ativada automaticamente após o pagamento.
                </p>

                <div className="surface-sm p-3 rounded-xl mb-4 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-bold text-foreground">{formatCurrency(pixData.amount)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Plano</span>
                    <span className="text-foreground">{pixData.planName}</span>
                  </div>
                </div>

                {pixData.pixQRCode && (
                  <div className="flex justify-center mb-4">
                    <div className="surface-sm p-2.5 rounded-xl inline-block">
                      <img src={`data:image/png;base64,${pixData.pixQRCode}`} alt="QR PIX" className="w-36 h-36" />
                    </div>
                  </div>
                )}

                {pixData.pixCode && (
                  <div>
                    <label className="text-label mb-1.5 block">Copia e Cola</label>
                    <div className="flex gap-2">
                      <code className="flex-1 text-[11px] bg-secondary px-3 py-2.5 rounded-xl font-mono text-muted-foreground truncate border border-border">
                        {pixData.pixCode.slice(0, 40)}...
                      </code>
                      <button onClick={() => {
                        navigator.clipboard.writeText(pixData.pixCode)
                        setPixCopied(true); setTimeout(() => setPixCopied(false), 2500)
                      }} className={cn('btn-secondary px-3 text-[12px] flex-shrink-0',
                        pixCopied && 'text-[var(--apple-green)]')}>
                        {pixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={closeModal} className="btn-primary w-full py-2.5 mt-4">
                  Fechar
                </button>
              </>
            )}

            {/* Done (no PIX) */}
            {modalStep === 'done' && (
              <div className="text-center py-4">
                <Check className="w-10 h-10 text-[var(--apple-green)] mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">Cliente criado!</p>
                <p className="text-[13px] text-muted-foreground mb-4">Assinatura ativada manualmente.</p>
                <button onClick={closeModal} className="btn-primary px-6 py-2.5">OK</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
