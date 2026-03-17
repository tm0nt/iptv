'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  User, Lock, CreditCard, CheckCircle2, Loader2,
  ArrowLeft, Eye, EyeOff, Tv2, Calendar, Shield,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, getDaysUntilExpiry, cn } from '@/lib/utils'

interface Profile {
  id: string; name: string; email: string; role: string; createdAt: string
  subscriptions: Array<{
    id: string; status: string; expiresAt: string; startsAt: string
    plan: { name: string; price: number; interval: string; durationDays: number }
    payment?: { status: string; paidAt: string; amount: number } | null
  }>
}

type Tab = 'profile' | 'security' | 'subscription'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [profile,    setProfile]  = useState<Profile | null>(null)
  const [loading,    setLoading]  = useState(true)
  const [tab,        setTab]      = useState<Tab>('profile')
  const [saving,     setSaving]   = useState(false)
  const [success,    setSuccess]  = useState('')
  const [error,      setError]    = useState('')

  // Profile form
  const [name,       setName]     = useState('')

  // Password form
  const [currPass,   setCurrPass] = useState('')
  const [newPass,    setNewPass]  = useState('')
  const [confPass,   setConfPass] = useState('')
  const [showPass,   setShowPass] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.user)
        setName(d.user?.name || '')
        setLoading(false)
      })
  }, [])

  async function saveProfile() {
    setSaving(true); setError(''); setSuccess('')
    const res  = await fetch('/api/user/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess('Perfil atualizado!'); setProfile(p => p ? { ...p, name: data.user.name } : p)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function savePassword() {
    if (newPass !== confPass) { setError('As senhas não coincidem'); return }
    if (newPass.length < 6)  { setError('Senha deve ter ao menos 6 caracteres'); return }
    setSaving(true); setError(''); setSuccess('')
    const res  = await fetch('/api/user/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currPass, newPassword: newPass }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess('Senha alterada com sucesso!')
    setCurrPass(''); setNewPass(''); setConfPass('')
    setTimeout(() => setSuccess(''), 3000)
  }

  const activeSub = profile?.subscriptions.find(s => s.status === 'ACTIVE')
  const daysLeft  = activeSub ? getDaysUntilExpiry(activeSub.expiresAt) : 0

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
      {/* Back */}
      <Link href="/watch"
        className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-xl font-bold text-white">
          {profile?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-white">{profile?.name}</h1>
          <p className="text-[13px] text-white/50">{profile?.email}</p>
        </div>
        {activeSub && (
          <div className="ml-auto">
            <span className="badge badge-green">Assinatura Ativa</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-5">
        {([
          ['profile',      User,       'Perfil'],
          ['security',     Lock,       'Segurança'],
          ['subscription', CreditCard, 'Assinatura'],
        ] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => { setTab(id); setError(''); setSuccess('') }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all',
              tab === id
                ? 'bg-white text-black shadow-sm'
                : 'text-white/50 hover:text-white',
            )}>
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {(error || success) && (
        <div className={cn(
          'flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4 text-[13px] animate-fade-in',
          error   ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-green-500/10 text-green-400 border border-green-500/20',
        )}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {error || success}
        </div>
      )}

      {/* ── Profile tab ── */}
      {tab === 'profile' && (
        <div className="surface rounded-2xl p-5 animate-fade-in space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">Informações pessoais</h2>
          <div>
            <label className="text-label mb-1.5 block">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="field-input" placeholder="Seu nome completo" />
          </div>
          <div>
            <label className="text-label mb-1.5 block">Email</label>
            <input value={profile?.email || ''} disabled
              className="field-input opacity-50 cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground mt-1">O email não pode ser alterado</p>
          </div>
          <div>
            <label className="text-label mb-1.5 block">Membro desde</label>
            <input value={profile ? formatDate(profile.createdAt) : ''} disabled
              className="field-input opacity-50 cursor-not-allowed" />
          </div>
          <button onClick={saveProfile} disabled={saving || name === profile?.name}
            className="btn-primary py-2.5 px-5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar alterações'}
          </button>
        </div>
      )}

      {/* ── Security tab ── */}
      {tab === 'security' && (
        <div className="surface rounded-2xl p-5 animate-fade-in space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">Alterar senha</h2>
          <div>
            <label className="text-label mb-1.5 block">Senha atual</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={currPass}
                onChange={e => setCurrPass(e.target.value)}
                className="field-input pr-10" placeholder="••••••••" />
              <button onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-label mb-1.5 block">Nova senha</label>
            <input type={showPass ? 'text' : 'password'} value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="field-input" placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="text-label mb-1.5 block">Confirmar nova senha</label>
            <input type={showPass ? 'text' : 'password'} value={confPass}
              onChange={e => setConfPass(e.target.value)}
              className="field-input" />
          </div>

          {/* Strength indicator */}
          {newPass && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {[1,2,3,4].map(l => (
                  <div key={l} className={cn('h-1 flex-1 rounded-full transition-colors',
                    newPass.length >= l * 3
                      ? l <= 2 ? 'bg-[var(--apple-red)]'
                        : l === 3 ? 'bg-[var(--apple-amber)]'
                        : 'bg-[var(--apple-green)]'
                      : 'bg-border'
                  )} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {newPass.length < 6 ? 'Muito curta' : newPass.length < 9 ? 'Média' : newPass.length < 12 ? 'Boa' : 'Forte'}
              </p>
            </div>
          )}

          <button onClick={savePassword}
            disabled={saving || !currPass || !newPass || !confPass}
            className="btn-primary py-2.5 px-5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Alterando...</> : 'Alterar senha'}
          </button>
        </div>
      )}

      {/* ── Subscription tab ── */}
      {tab === 'subscription' && (
        <div className="space-y-4 animate-fade-in">
          {/* Active subscription */}
          {activeSub ? (
            <div className="surface rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--apple-blue)]/10 flex items-center justify-center">
                    <Tv2 className="w-5 h-5 text-[var(--apple-blue)]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">{activeSub.plan.name}</p>
                    <p className="text-[12px] text-muted-foreground">StreamBox Pro</p>
                  </div>
                </div>
                <span className="badge badge-green">Ativo</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Expira em</p>
                  <p className="text-[14px] font-semibold text-foreground">{formatDate(activeSub.expiresAt)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{daysLeft} dias restantes</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Valor</p>
                  <p className="text-[14px] font-semibold text-foreground">{formatCurrency(activeSub.plan.price)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">por período</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatDate(activeSub.startsAt)}</span>
                  <span>{formatDate(activeSub.expiresAt)}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--apple-blue)] rounded-full transition-all"
                    style={{
                      width: `${Math.max(5, 100 - (daysLeft / activeSub.plan.durationDays) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="surface rounded-2xl p-6 text-center">
              <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-foreground mb-1">Sem assinatura ativa</p>
              <p className="text-[13px] text-muted-foreground mb-4">Escolha um plano para acessar o catálogo completo</p>
              <Link href="/watch" className="btn-primary py-2.5 px-5 inline-flex">
                Ver planos disponíveis
              </Link>
            </div>
          )}

          {/* History */}
          {profile?.subscriptions.length ? (
            <div className="surface rounded-2xl overflow-hidden">
              <p className="text-[13px] font-semibold text-foreground px-5 py-3.5 border-b border-border">
                Histórico de assinaturas
              </p>
              <div className="divide-y divide-border">
                {profile.subscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{sub.plan.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(sub.startsAt)}</p>
                      </div>
                    </div>
                    <span className={cn('badge', {
                      ACTIVE: 'badge-green', EXPIRED: 'badge-red',
                      PENDING_PAYMENT: 'badge-amber', TRIAL: 'badge-blue', SUSPENDED: 'badge-gray',
                    }[sub.status] || 'badge-gray')}>
                      {{ ACTIVE:'Ativo', EXPIRED:'Expirado', PENDING_PAYMENT:'Aguard. Pag.', TRIAL:'Trial', SUSPENDED:'Suspenso' }[sub.status] || sub.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
