'use client'
import { useEffect, useState } from 'react'
import { Search, UserPlus, Shield, User, UserCheck, Loader2, X, Check } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

interface UserRow {
  id: string; name: string; email: string; role: string
  active: boolean; createdAt: string; referralCode?: string; commissionRate?: number
  _count: { subscriptions: number; clientsAsReseller: number }
}

const ROLE: Record<string, { label: string; icon: any; badge: string }> = {
  ADMIN:    { label: 'Admin',      icon: Shield,    badge: 'badge-red'    },
  RESELLER: { label: 'Revendedor', icon: UserCheck, badge: 'badge-violet' },
  CLIENT:   { label: 'Cliente',    icon: User,      badge: 'badge-blue'   },
}
const emptyForm = { id: '', name: '', email: '', password: '', role: 'CLIENT', active: true, commissionRate: '0.20' }

export default function AdminUsers() {
  const [users,      setUsers]      = useState<UserRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modal,      setModal]      = useState(false)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (roleFilter) p.set('role', roleFilter)
    const res  = await fetch(`/api/admin/users?${p}`)
    const data = await res.json()
    setUsers(data.users || []); setTotal(data.total || 0); setLoading(false)
  }
  useEffect(() => { load() }, [roleFilter])

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/admin/users', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commissionRate: parseFloat(form.commissionRate) }),
      })
      await load(); setModal(false)
    } finally { setSaving(false) }
  }

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Usuários</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{total} cadastrados</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setModal(true) }} className="btn-primary py-2 px-4 text-[13px]">
          <UserPlus className="w-3.5 h-3.5" /> Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="field-input pl-9" />
        </div>
        <div className="flex gap-1.5">
          {['', 'CLIENT', 'RESELLER', 'ADMIN'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn('px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
                roleFilter === r ? 'bg-[var(--apple-blue)] text-white' : 'btn-secondary')}>
              {r === '' ? 'Todos' : ROLE[r]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead><tr>
              {['Usuário', 'Função', 'Assinaturas', 'Status', 'Criado em'].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-10 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-[13px]">
                  Nenhum usuário encontrado
                </td></tr>
              )}
              {filtered.map(user => {
                const r = ROLE[user.role]
                const RIcon = r?.icon
                return (
                  <tr key={user.id} className="cursor-pointer"
                    onClick={() => {
                      setForm({ id: user.id, name: user.name, email: user.email, password: '',
                        role: user.role, active: user.active, commissionRate: String(user.commissionRate || .2) })
                      setModal(true)
                    }}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-[13px]">{user.name}</p>
                          <p className="text-[12px] text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={cn('badge', r?.badge)}>
                        <RIcon className="w-3 h-3" /> {r?.label}
                      </span>
                    </td>
                    <td className="text-muted-foreground text-[13px]">
                      {user.role === 'RESELLER'
                        ? `${user._count.clientsAsReseller} clientes`
                        : `${user._count.subscriptions} assin.`}
                    </td>
                    <td>
                      <span className={cn('badge', user.active ? 'badge-green' : 'badge-red')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', user.active ? 'bg-[var(--apple-green)]' : 'bg-[var(--apple-red)]')} />
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="text-[12px] text-muted-foreground">{formatDate(user.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal-sheet sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold">{form.id ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'name',     label: 'Nome',     type: 'text',     ph: 'Nome completo' },
                { key: 'email',    label: 'Email',    type: 'email',    ph: 'email@exemplo.com' },
                { key: 'password', label: form.id ? 'Nova senha (deixe vazio para manter)' : 'Senha', type: 'password', ph: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-label mb-1.5 block">{f.label}</label>
                  <input type={f.type} placeholder={f.ph}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="field-input" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">Função</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="field-input">
                    <option value="CLIENT">Cliente</option>
                    <option value="RESELLER">Revendedor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                {form.role === 'RESELLER' && (
                  <div>
                    <label className="text-label mb-1.5 block">Comissão %</label>
                    <input type="number" min="0" max="100" step="1" placeholder="20"
                      value={String(parseFloat(form.commissionRate) * 100)}
                      onChange={e => setForm(f => ({ ...f, commissionRate: String(parseFloat(e.target.value)/100) }))}
                      className="field-input" />
                  </div>
                )}
              </div>
            </div>
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
