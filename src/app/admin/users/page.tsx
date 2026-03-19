'use client'
import { useEffect, useState } from 'react'
import { Search, UserPlus, Shield, User, UserCheck, Loader2, X, Check, ChevronLeft, ChevronRight, MonitorPlay, Clock3, Users } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { TableSkeleton } from '@/components/ui/skeleton'
import { PageIntro } from '@/components/admin/PageIntro'

interface UserRow {
  id: string; name: string; email: string; role: string
  active: boolean; createdAt: string; referralCode?: string; commissionRate?: number
  profilesCount: number
  activeSessionsCount: number
  activePlanName?: string | null
  activePlanMaxDevices?: number | null
  _count: { subscriptions: number; clientsAsReseller: number }
}

interface PlaybackDetails {
  profiles: Array<{
    id: string
    name: string
    avatarColor: string
    isDefault: boolean
    activeSessionCount: number
  }>
  activeSessions: Array<{
    id: string
    profileId: string
    profileName: string
    avatarColor: string
    channelUuid: string | null
    channelName: string | null
    contentType: string | null
    startedAt: string
    lastSeenAt: string
  }>
  activePlan?: {
    name: string
    maxDevices: number
    expiresAt: string
  } | null
}

const ROLE: Record<string, { label: string; icon: any; badge: string }> = {
  ADMIN:    { label: 'Admin',      icon: Shield,    badge: 'badge-red'    },
  RESELLER: { label: 'Revendedor', icon: UserCheck, badge: 'badge-violet' },
  CLIENT:   { label: 'Cliente',    icon: User,      badge: 'badge-blue'   },
}
const emptyForm = { id: '', name: '', email: '', password: '', role: 'CLIENT', active: true, commissionRate: '0.20' }

export default function AdminUsers() {
  const LIMIT = 20
  const [users,      setUsers]      = useState<UserRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page,       setPage]       = useState(1)
  const [modal,      setModal]      = useState(false)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)
  const [playbackDetails, setPlaybackDetails] = useState<PlaybackDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (roleFilter) p.set('role', roleFilter)
    if (search.trim()) p.set('q', search.trim())
    p.set('page', String(page))
    p.set('limit', String(LIMIT))
    const res  = await fetch(`/api/admin/users?${p}`)
    const data = await res.json()
    setUsers(data.users || []); setTotal(data.total || 0); setLoading(false)
  }
  useEffect(() => { load() }, [roleFilter, search, page])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, search])

  async function loadPlaybackDetails(userId: string) {
    setDetailsLoading(true)
    return fetch(`/api/admin/users/${userId}/playback`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar as sessões.')
        return data
      })
      .then(data => setPlaybackDetails(data))
      .catch(() => setPlaybackDetails(null))
      .finally(() => setDetailsLoading(false))
  }

  useEffect(() => {
    if (!modal || !form.id || form.role !== 'CLIENT') {
      setPlaybackDetails(null)
      return
    }

    loadPlaybackDetails(form.id)
  }, [modal, form.id, form.role])

  async function endSession(sessionId: string) {
    if (!form.id) return
    setEndingSessionId(sessionId)
    try {
      const response = await fetch(`/api/admin/users/${form.id}/playback/${sessionId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível encerrar a sessão.')
      }
      await loadPlaybackDetails(form.id)
      await load()
    } finally {
      setEndingSessionId(null)
    }
  }

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

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Gestão de usuários"
        description={`${total.toLocaleString()} cadastro(s) entre clientes, revendedores e administradores.`}
        actions={(
          <button onClick={() => { setForm(emptyForm); setModal(true) }} className="btn-primary py-2.5 px-4 text-[13px]">
            <UserPlus className="w-3.5 h-3.5" /> Novo Usuário
          </button>
        )}
      />

      {/* Filters */}
      <div className="surface rounded-[30px] p-5 md:p-6">
        <div className="flex flex-col sm:flex-row gap-2.5">
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
      </div>

      {/* Table */}
      <div className="surface rounded-[30px] overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton columns={7} rows={6} />
          ) : (
            <table className="w-full data-table">
              <thead><tr>
                {['Usuário', 'Função', 'Plano ativo', 'Perfis', 'Uso agora', 'Status', 'Criado em'].map(h => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-[13px]">
                    Nenhum usuário encontrado
                  </td></tr>
                )}
                {users.map(user => {
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
                      <td>
                        {user.role === 'CLIENT' ? (
                          user.activePlanName ? (
                            <div>
                              <p className="text-[13px] font-medium text-foreground">{user.activePlanName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {user.activePlanMaxDevices || 1} tela(s) liberada(s)
                              </p>
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">Sem assinatura ativa</span>
                          )
                        ) : (
                          <span className="text-[12px] text-muted-foreground">
                            {user.role === 'RESELLER'
                              ? `${user._count.clientsAsReseller} cliente(s)`
                              : `${user._count.subscriptions} assinatura(s)`}
                          </span>
                        )}
                      </td>
                      <td>
                        {user.role === 'CLIENT' ? (
                          <div>
                            <p className="text-[13px] font-medium text-foreground">{user.profilesCount}</p>
                            <p className="text-[11px] text-muted-foreground">perfil(is) criados</p>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
                      </td>
                      <td>
                        {user.role === 'CLIENT' ? (
                          <div>
                            <p className="text-[13px] font-medium text-foreground">
                              {user.activeSessionsCount}/{user.activePlanMaxDevices || 1}
                            </p>
                            <p className="text-[11px] text-muted-foreground">tela(s) em uso agora</p>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
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
          )}
        </div>

        {!loading && totalPages > 1 && (
          <div className="px-4 md:px-5 py-4 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              Página {page} de {totalPages} · {total.toLocaleString()} usuário(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
                className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                className="btn-secondary px-3 py-2 text-[12px] disabled:opacity-50 disabled:pointer-events-none"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className={cn('modal-sheet', form.role === 'CLIENT' ? 'sm:max-w-3xl' : 'sm:max-w-md')} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold">{form.id ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
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

              {form.role === 'CLIENT' && (
                <div className="rounded-[24px] bg-secondary p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">Uso da conta agora</p>
                      <p className="text-[12px] text-muted-foreground">
                        Perfis liberados, sessões ativas e o que esta sendo assistido neste momento.
                      </p>
                    </div>
                    {playbackDetails?.activePlan && (
                      <div className="text-right">
                        <p className="text-[13px] font-semibold text-foreground">{playbackDetails.activePlan.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {playbackDetails.activePlan.maxDevices} tela(s)
                        </p>
                      </div>
                    )}
                  </div>

                  {detailsLoading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-background p-4 h-28 animate-pulse" />
                      <div className="rounded-2xl bg-background p-4 h-28 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-background p-4">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Users className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.16em]">Perfis</span>
                          </div>
                          <p className="text-[22px] font-semibold text-foreground">{playbackDetails?.profiles.length || 0}</p>
                          <p className="text-[11px] text-muted-foreground">criados nesta conta</p>
                        </div>
                        <div className="rounded-2xl bg-background p-4">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <MonitorPlay className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.16em]">Sessões</span>
                          </div>
                          <p className="text-[22px] font-semibold text-foreground">{playbackDetails?.activeSessions.length || 0}</p>
                          <p className="text-[11px] text-muted-foreground">ativas agora</p>
                        </div>
                        <div className="rounded-2xl bg-background p-4">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Shield className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.16em]">Capacidade</span>
                          </div>
                          <p className="text-[22px] font-semibold text-foreground">{playbackDetails?.activePlan?.maxDevices || 1}</p>
                          <p className="text-[11px] text-muted-foreground">tela(s) permitidas</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-3">Perfis disponíveis</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {playbackDetails?.profiles.map(profile => (
                            <div key={profile.id} className="rounded-2xl bg-background p-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-11 h-11 rounded-[16px] flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
                                  style={{ backgroundColor: profile.avatarColor }}
                                >
                                  {profile.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-foreground truncate">{profile.name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {profile.activeSessionCount > 0 ? 'Em uso agora' : 'Livre neste momento'}
                                  </p>
                                </div>
                              </div>
                              <span className={cn('badge', profile.activeSessionCount > 0 ? 'badge-green' : 'badge-gray')}>
                                {profile.activeSessionCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-3">Sessões ativas</p>
                        {playbackDetails?.activeSessions.length ? (
                          <div className="space-y-2">
                            {playbackDetails.activeSessions.map(session => (
                              <div key={session.id} className="rounded-2xl bg-background p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className="w-11 h-11 rounded-[16px] flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
                                    style={{ backgroundColor: session.avatarColor }}
                                  >
                                    {session.profileName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-foreground truncate">{session.channelName || 'Conteúdo em reprodução'}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Perfil {session.profileName} · {session.contentType || 'STREAM'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    Iniciou {formatDate(session.startedAt)}
                                  </span>
                                  <span>Último ping {formatDate(session.lastSeenAt)}</span>
                                  <button
                                    onClick={() => endSession(session.id)}
                                    disabled={endingSessionId === session.id}
                                    className="btn-secondary px-3 py-1.5 text-[11px] disabled:opacity-60 disabled:pointer-events-none"
                                  >
                                    {endingSessionId === session.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Encerrando...</> : 'Encerrar sessão'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-background p-4 text-[12px] text-muted-foreground">
                            Nenhuma sessão ativa neste momento para esta conta.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
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
