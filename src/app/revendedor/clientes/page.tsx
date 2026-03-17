'use client'
import { useEffect, useState } from 'react'
import { Search, UserPlus, Loader2, X, Check, QrCode, Copy } from 'lucide-react'
import { formatDate, formatCurrency, cn } from '@/lib/utils'

interface SubRow {
  id: string; status: string; expiresAt: string; createdAt: string
  user: { id: string; name: string; email: string; active: boolean }
  plan: { name: string; price: number; interval: string }
}
interface Plan { id: string; name: string; price: number; interval: string; durationDays: number }

const emptyForm = { name: '', email: '', password: '', planId: '' }
type ModalStep = 'form' | 'pix' | 'done'

export default function ResellerClients() {
  const [subs,      setSubs]      = useState<SubRow[]>([])
  const [plans,     setPlans]     = useState<Plan[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(false)
  const [step,      setStep]      = useState<ModalStep>('form')
  const [form,      setForm]      = useState(emptyForm)
  const [saving,    setSaving]    = useState(false)
  const [pixData,   setPixData]   = useState<any>(null)
  const [pixCopied, setPixCopied] = useState(false)

  async function load() {
    setLoading(true)
    const [sr, pr] = await Promise.all([
      fetch('/api/reseller/clients').then(r => r.json()),
      fetch('/api/plans').then(r => r.json()),
    ])
    setSubs(sr.subscriptions || []); setPlans(pr.plans || []); setLoading(false)
  }
  useEffect(load, [])

  async function handleAdd() {
    setSaving(true)
    try {
      const res  = await fetch('/api/reseller/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Generate PIX
      const pr = await fetch('/api/payment/pix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: form.planId }),
      })
      const pd = await pr.json()
      if (pr.ok && pd.pixCode) { setPixData(pd); setStep('pix') }
      else setStep('done')
      await load()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  function closeModal() { setModal(false); setStep('form'); setForm(emptyForm); setPixData(null) }

  const filtered = subs.filter(s =>
    !search || s.user.name.toLowerCase().includes(search.toLowerCase()) ||
    s.user.email.toLowerCase().includes(search.toLowerCase())
  )
  const active = subs.filter(s => s.status === 'ACTIVE').length

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Meus Clientes</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            <span className="text-[var(--apple-green)] font-medium">{active} ativos</span>
            {subs.length - active > 0 && ` · ${subs.length - active} inativos`}
          </p>
        </div>
        <button onClick={() => { setModal(true); setStep('form') }} className="btn-primary py-2 px-4 text-[13px]">
          <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente..." className="field-input pl-9" />
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead><tr>
              {['Cliente', 'Plano', 'Status', 'Valor', 'Expira'].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-[13px]">
                  Nenhum cliente encontrado
                </td></tr>
              )}
              {filtered.map(sub => (
                <tr key={sub.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                        {sub.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-[13px]">{sub.user.name}</p>
                        <p className="text-[12px] text-muted-foreground">{sub.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground text-[13px]">{sub.plan.name}</td>
                  <td>
                    <span className={cn('badge',
                      sub.status === 'ACTIVE' ? 'badge-green' :
                      sub.status === 'PENDING_PAYMENT' ? 'badge-amber' : 'badge-red')}>
                      {{ ACTIVE:'Ativo', EXPIRED:'Expirado', PENDING_PAYMENT:'Aguard. PIX', SUSPENDED:'Suspenso' }[sub.status] || sub.status}
                    </span>
                  </td>
                  <td className="font-medium text-foreground text-[13px]">{formatCurrency(sub.plan.price)}</td>
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
          <div className="modal-sheet sm:max-w-md" onClick={e => e.stopPropagation()}>
            {step === 'form' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[16px] font-semibold">Novo Cliente</h2>
                    <p className="text-[12px] text-muted-foreground mt-0.5">PIX gerado automaticamente</p>
                  </div>
                  <button onClick={closeModal} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'name',     type: 'text',     label: 'Nome completo', ph: 'João Silva' },
                    { key: 'email',    type: 'email',    label: 'Email',         ph: 'joao@email.com' },
                    { key: 'password', type: 'password', label: 'Senha inicial', ph: '••••••••' },
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
                  <button onClick={handleAdd}
                    disabled={saving || !form.name || !form.email || !form.planId}
                    className="btn-primary flex-1 py-2.5">
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                      : <><QrCode className="w-4 h-4" /> Criar + PIX</>}
                  </button>
                </div>
              </>
            )}

            {step === 'pix' && pixData && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold">PIX do cliente</h2>
                  <button onClick={closeModal} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Envie este PIX para o cliente. A conta ativa automaticamente após pagamento.
                </p>
                <div className="surface-sm p-3 rounded-xl mb-4 space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span>{pixData.planName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-foreground">{formatCurrency(pixData.amount)}</span></div>
                </div>
                {pixData.pixQRCode && (
                  <div className="flex justify-center mb-4">
                    <div className="surface-sm p-2.5 rounded-xl">
                      <img src={`data:image/png;base64,${pixData.pixQRCode}`} alt="QR" className="w-36 h-36" />
                    </div>
                  </div>
                )}
                {pixData.pixCode && (
                  <div className="flex gap-2 mb-4">
                    <code className="flex-1 text-[11px] bg-secondary px-3 py-2.5 rounded-xl font-mono text-muted-foreground truncate border border-border">
                      {pixData.pixCode.slice(0, 40)}...
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(pixData.pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000) }}
                      className={cn('btn-secondary px-3 flex-shrink-0', pixCopied && 'text-[var(--apple-green)]')}>
                      {pixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
                <button onClick={closeModal} className="btn-primary w-full py-2.5">Fechar</button>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-6">
                <Check className="w-10 h-10 text-[var(--apple-green)] mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">Cliente criado com sucesso!</p>
                <p className="text-[13px] text-muted-foreground mb-5">Assinatura ativada manualmente.</p>
                <button onClick={closeModal} className="btn-primary px-6 py-2.5">OK</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
