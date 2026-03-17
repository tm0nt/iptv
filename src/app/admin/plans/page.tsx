'use client'
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Star, Loader2, X, Check } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Plan {
  id: string; name: string; description?: string; price: number
  interval: string; durationDays: number; maxDevices: number
  active: boolean; featured: boolean; subscriberCount?: number
}

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual',
}

const emptyForm = {
  id: '', name: '', description: '', price: '', interval: 'MONTHLY',
  durationDays: '30', maxDevices: '1', active: true, featured: false,
}

export default function AdminPlans() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState(emptyForm)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function loadPlans() {
    const res  = await fetch('/api/admin/plans')
    const data = await res.json()
    setPlans(data.plans || [])
    setLoading(false)
  }
  useEffect(() => { loadPlans() }, [])

  function openNew()        { setForm(emptyForm); setError(''); setModal(true) }
  function openEdit(p: Plan) {
    setForm({ id: p.id, name: p.name, description: p.description||'', price: String(p.price),
      interval: p.interval, durationDays: String(p.durationDays), maxDevices: String(p.maxDevices),
      active: p.active, featured: p.featured })
    setError(''); setModal(true)
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/plans', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      await loadPlans(); setModal(false)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Desativar este plano?')) return
    await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' })
    await loadPlans()
  }

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Planos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie os planos de assinatura</p>
        </div>
        <button onClick={openNew} className="btn-primary py-2 px-4 text-[13px]">
          <Plus className="w-3.5 h-3.5" /> Novo Plano
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="surface rounded-2xl p-5 h-48 skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id}
              className={cn('surface rounded-2xl p-5 relative transition-all',
                !plan.active && 'opacity-50',
                plan.featured && 'ring-2 ring-[var(--apple-blue)]/30',
              )}>
              {plan.featured && (
                <span className="absolute top-4 right-4 badge badge-blue text-[10px]">
                  <Star className="w-2.5 h-2.5 fill-current" /> Popular
                </span>
              )}
              <div className="mb-3">
                <h3 className="text-[15px] font-bold text-foreground">{plan.name}</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {INTERVAL_LABELS[plan.interval]} · {plan.durationDays} dias
                </p>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums mb-1">
                {formatCurrency(plan.price)}
              </p>
              <p className="text-[12px] text-muted-foreground mb-3">
                {plan.maxDevices} dispositivo{plan.maxDevices > 1 ? 's' : ''}
              </p>
              {plan.description && (
                <p className="text-[12px] text-muted-foreground border-t border-border pt-3 mb-3">
                  {plan.description}
                </p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[12px] text-muted-foreground">
                  {plan.subscriberCount ?? 0} assinantes
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(plan)}
                    className="btn-ghost p-1.5 text-muted-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(plan.id)}
                    className="btn-ghost p-1.5 text-muted-foreground hover:text-[var(--apple-red)]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-3 surface rounded-2xl p-12 text-center text-muted-foreground text-[13px]">
              Nenhum plano criado ainda. Crie o primeiro!
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal-sheet sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold">{form.id ? 'Editar Plano' : 'Novo Plano'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Nome">
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="field-input" placeholder="Ex: Mensal Premium" />
              </Field>
              <Field label="Descrição">
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="field-input" placeholder="Descrição curta (opcional)" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <input type="number" value={form.price} step="0.01"
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="field-input" placeholder="29.90" />
                </Field>
                <Field label="Intervalo">
                  <select value={form.interval}
                    onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                    className="field-input">
                    {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duração (dias)">
                  <input type="number" value={form.durationDays}
                    onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))}
                    className="field-input" />
                </Field>
                <Field label="Dispositivos">
                  <input type="number" value={form.maxDevices} min="1"
                    onChange={e => setForm(f => ({ ...f, maxDevices: e.target.value }))}
                    className="field-input" />
                </Field>
              </div>
              <div className="flex items-center gap-6 pt-1">
                <Toggle label="Ativo"    checked={form.active}   onChange={v => setForm(f => ({ ...f, active: v }))} />
                <Toggle label="Destaque" checked={form.featured} onChange={v => setForm(f => ({ ...f, featured: v }))} />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-[13px] text-[var(--apple-red)] bg-red-500/10 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-label">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)}
        className={cn('w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
          checked ? 'bg-[var(--apple-blue)]' : 'bg-border')}>
        <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-4')} />
      </button>
      <span className="text-[13px] text-foreground">{label}</span>
    </label>
  )
}
