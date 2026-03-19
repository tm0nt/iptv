'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  User, Lock, CreditCard, CheckCircle2, Loader2,
  ArrowLeft, Eye, EyeOff, Tv2, Calendar, Shield, Users, Plus, Sparkles, Copy, Clock, PencilLine, UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, getDaysUntilExpiry, cn } from '@/lib/utils'
import { useBranding } from '@/hooks/useBranding'
import { Skeleton } from '@/components/ui/skeleton'

interface Profile {
  id: string; name: string; email: string; role: string; createdAt: string
  subscriptions: Array<{
    id: string; status: string; expiresAt: string; startsAt: string
    plan: { id: string; name: string; price: number; interval: string; durationDays: number; maxDevices: number }
    payment?: { status: string; paidAt: string; amount: number } | null
  }>
}

interface AccountProfile {
  id: string
  name: string
  avatarColor?: string
  isDefault?: boolean
  createdAt?: string
  status?: 'FREE' | 'CURRENT_SCREEN' | 'OTHER_SCREEN'
  statusLabel?: string
  activeSessionCount?: number
}

interface PlanOption {
  id: string
  name: string
  price: number
  interval: string
  durationDays: number
  maxDevices: number
  featured?: boolean
}

interface PaymentGatewayMeta {
  gatewayId: string | null
  gatewayLabel: string
  customerDocumentMode: 'none' | 'optional' | 'required'
  requiresCustomerDocument: boolean
}

const PROFILE_COLOR_OPTIONS = [
  '#73de90',
  '#4f9cff',
  '#ff9f5a',
  '#f56565',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
]

type Tab = 'profile' | 'security' | 'subscription'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const branding = useBranding()
  const [profile,    setProfile]  = useState<Profile | null>(null)
  const [loading,    setLoading]  = useState(true)
  const [tab,        setTab]      = useState<Tab>('profile')
  const [saving,     setSaving]   = useState(false)
  const [success,    setSuccess]  = useState('')
  const [error,      setError]    = useState('')
  const [accountProfiles, setAccountProfiles] = useState<AccountProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [maxProfiles, setMaxProfiles] = useState(1)
  const [activeSessionsCount, setActiveSessionsCount] = useState(0)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileColor, setNewProfileColor] = useState(PROFILE_COLOR_OPTIONS[0])
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editingProfileName, setEditingProfileName] = useState('')
  const [editingProfileColor, setEditingProfileColor] = useState(PROFILE_COLOR_OPTIONS[0])
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = useState('')
  const [upgradeCpf, setUpgradeCpf] = useState('')
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeGateway, setUpgradeGateway] = useState<PaymentGatewayMeta>({
    gatewayId: null,
    gatewayLabel: 'PIX',
    customerDocumentMode: 'none',
    requiresCustomerDocument: false,
  })
  const [upgradePixData, setUpgradePixData] = useState<{
    paymentId: string
    pixCode: string | null
    pixQRCode?: string | null
    amount: number
    planName: string
    expiresAt: string
    gatewayLabel?: string
  } | null>(null)
  const [upgradeCopied, setUpgradeCopied] = useState(false)

  // Profile form
  const [name,       setName]     = useState('')

  // Password form
  const [currPass,   setCurrPass] = useState('')
  const [newPass,    setNewPass]  = useState('')
  const [confPass,   setConfPass] = useState('')
  const [showPass,   setShowPass] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/profile').then(r => r.json()),
      fetch('/api/account/profiles').then(r => (r.ok ? r.json() : { profiles: [], maxProfiles: 1 })),
      fetch('/api/plans').then(r => r.json()),
      fetch('/api/payment/gateway').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([profileData, profileConfig, planData, gatewayData]) => {
        setProfile(profileData.user)
        setName(profileData.user?.name || '')
        setAccountProfiles(profileConfig.profiles || [])
        setActiveProfileId(profileConfig.activeProfileId || null)
        setMaxProfiles(profileConfig.maxProfiles || 1)
        setActiveSessionsCount(profileConfig.activeSessionsCount || 0)
        setPlans(planData.plans || [])
        if (gatewayData) setUpgradeGateway(gatewayData)
      })
      .finally(() => setLoading(false))
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
  const availableUpgradePlans = plans.filter(plan => (
    !activeSub
      ? true
      : plan.id !== activeSub.plan.id && (
        plan.maxDevices > activeSub.plan.maxDevices ||
        plan.price > activeSub.plan.price
      )
  ))
  const selectedUpgradePlan = availableUpgradePlans.find(plan => plan.id === selectedUpgradePlanId) || null
  const normalizedUpgradeCpf = normalizeCpf(upgradeCpf)
  const upgradeCpfStatus = normalizedUpgradeCpf.length === 0
    ? null
    : isValidCpf(normalizedUpgradeCpf)
      ? 'valid'
      : normalizedUpgradeCpf.length < 11
        ? 'typing'
        : 'invalid'

  async function refreshProfiles() {
    const response = await fetch('/api/account/profiles')
    const data = await response.json()
    setAccountProfiles(data.profiles || [])
    setActiveProfileId(data.activeProfileId || null)
    setMaxProfiles(data.maxProfiles || 1)
    setActiveSessionsCount(data.activeSessionsCount || 0)
  }

  async function createProfile() {
    if (!newProfileName.trim()) return
    setCreatingProfile(true)
    setError('')
    const res = await fetch('/api/account/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProfileName.trim(), avatarColor: newProfileColor }),
    })
    const data = await res.json()
    setCreatingProfile(false)
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar o perfil.')
      return
    }
    setAccountProfiles(data.profiles || [])
    setActiveProfileId(data.activeProfileId || null)
    setMaxProfiles(data.maxProfiles || 1)
    setActiveSessionsCount(data.activeSessionsCount || 0)
    setNewProfileName('')
    setNewProfileColor(PROFILE_COLOR_OPTIONS[(accountProfiles.length + 1) % PROFILE_COLOR_OPTIONS.length])
    setSuccess('Perfil criado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function renameProfile(profileId: string) {
    if (!editingProfileName.trim()) return

    const res = await fetch('/api/account/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        profileId,
        name: editingProfileName.trim(),
        avatarColor: editingProfileColor,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Não foi possível renomear o perfil.')
      return
    }

    setAccountProfiles(data.profiles || [])
    setActiveProfileId(data.activeProfileId || null)
    setActiveSessionsCount(data.activeSessionsCount || 0)
    setEditingProfileId(null)
    setEditingProfileName('')
    setEditingProfileColor(PROFILE_COLOR_OPTIONS[0])
    setSuccess('Perfil atualizado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function selectAccountProfile(profileId: string) {
    const res = await fetch('/api/account/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select', profileId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Não foi possível trocar o perfil.')
      return
    }
    setAccountProfiles(data.profiles || [])
    setActiveProfileId(profileId)
    setActiveSessionsCount(data.activeSessionsCount || 0)
    setSuccess('Perfil ativo atualizado!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function deleteProfile(profileId: string) {
    const res = await fetch(`/api/account/profiles?profileId=${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Não foi possível remover o perfil.')
      return
    }
    setAccountProfiles(data.profiles || [])
    setActiveProfileId(data.activeProfileId || null)
    setMaxProfiles(data.maxProfiles || 1)
    setActiveSessionsCount(data.activeSessionsCount || 0)
    setSuccess('Perfil removido com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function generateUpgradePix() {
    if (!selectedUpgradePlanId) return
    if (upgradeGateway.requiresCustomerDocument && !isValidCpf(normalizedUpgradeCpf)) {
      setError('Informe um CPF válido para gerar o PIX deste upgrade.')
      return
    }
    setUpgradeLoading(true)
    setError('')
    const res = await fetch('/api/payment/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedUpgradePlanId,
        ...(upgradeGateway.requiresCustomerDocument ? { customerDocument: normalizedUpgradeCpf } : {}),
      }),
    })
    const data = await res.json()
    setUpgradeLoading(false)
    if (!res.ok) {
      setError(data.error || 'Não foi possível gerar o PIX do upgrade.')
      return
    }
    setUpgradePixData(data)
    setSuccess('PIX de upgrade gerado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  function copyUpgradePix() {
    if (!upgradePixData?.pixCode) return
    navigator.clipboard.writeText(upgradePixData.pixCode)
    setUpgradeCopied(true)
    setTimeout(() => setUpgradeCopied(false), 2500)
  }

  useEffect(() => {
    if (!upgradePixData?.paymentId) return
    const interval = setInterval(async () => {
      const response = await fetch(`/api/payment/pix?paymentId=${upgradePixData.paymentId}`)
      const data = await response.json()
      if (data.subscriptionActive || data.status === 'APPROVED') {
        setSuccess('Upgrade aprovado! Sua assinatura foi atualizada.')
        setUpgradePixData(null)
        const refreshed = await fetch('/api/user/profile').then(r => r.json())
        setProfile(refreshed.user)
        refreshProfiles().catch(() => {})
        setTimeout(() => setSuccess(''), 3000)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [upgradePixData])

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
      <Skeleton className="h-5 w-36 mb-6 rounded-full" />
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-4 w-56 rounded-full" />
        </div>
      </div>
      <div className="flex gap-1 rounded-xl p-1 bg-white/5 mb-5">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 flex-1 rounded-lg" />)}
      </div>
      <div className="surface rounded-2xl p-5 space-y-4">
        <Skeleton className="h-5 w-40 rounded-full" />
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
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
                    <p className="text-[12px] text-muted-foreground">{branding.siteName}</p>
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
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Telas liberadas</p>
                    <p className="text-[14px] font-semibold text-foreground">{activeSub.plan.maxDevices}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">perfil(is) simultâneo(s)</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Perfis criados</p>
                    <p className="text-[14px] font-semibold text-foreground">{accountProfiles.length}/{maxProfiles}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">conforme o plano atual</p>
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

          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--apple-blue)]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[var(--apple-blue)]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Perfis da conta</p>
                <p className="text-[12px] text-muted-foreground">
                  Cada perfil representa uma pessoa usando a assinatura. O limite acompanha a quantidade de telas do plano.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Perfis</p>
                <p className="text-[22px] font-semibold text-foreground">{accountProfiles.length}</p>
                <p className="text-[11px] text-muted-foreground">ativos dentro da conta</p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Capacidade</p>
                <p className="text-[22px] font-semibold text-foreground">{maxProfiles}</p>
                <p className="text-[11px] text-muted-foreground">perfil(is) liberados</p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Perfil ativo</p>
                <p className="text-[16px] font-semibold text-foreground truncate">{accountProfiles.find(item => item.id === activeProfileId)?.name || 'Perfil 1'}</p>
                <p className="text-[11px] text-muted-foreground">retomada e histórico</p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Telas do plano</p>
                <p className="text-[22px] font-semibold text-foreground">{activeSub?.plan.maxDevices || 1}</p>
                <p className="text-[11px] text-muted-foreground">uso simultâneo</p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Uso agora</p>
                <p className="text-[22px] font-semibold text-foreground">{activeSessionsCount}</p>
                <p className="text-[11px] text-muted-foreground">tela(s) ocupadas agora</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              {accountProfiles.map(profileItem => (
                <div
                  key={profileItem.id}
                  className={cn(
                    'rounded-[24px] p-4 transition-all border',
                    profileItem.id === activeProfileId
                      ? 'border-[var(--apple-blue)]/40 bg-[var(--apple-blue)]/6 shadow-[0_12px_40px_rgba(0,0,0,0.12)]'
                      : 'border-border bg-secondary hover:bg-secondary/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-14 h-14 rounded-[18px] flex items-center justify-center text-lg font-semibold shrink-0"
                        style={{
                          backgroundColor: profileItem.avatarColor || '#73de90',
                          color: '#ffffff',
                        }}
                      >
                        {profileItem.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        {editingProfileId === profileItem.id ? (
                          <div className="space-y-2">
                            <input
                              value={editingProfileName}
                              onChange={e => setEditingProfileName(e.target.value)}
                              className="field-input h-10"
                              maxLength={24}
                            />
                            <div className="flex flex-wrap gap-2">
                              {PROFILE_COLOR_OPTIONS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setEditingProfileColor(color)}
                                  className={cn(
                                    'w-7 h-7 rounded-full ring-2 transition-all',
                                    editingProfileColor === color ? 'ring-foreground scale-105' : 'ring-transparent',
                                  )}
                                  style={{ backgroundColor: color }}
                                  title={`Cor ${color}`}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => renameProfile(profileItem.id)}
                                className="btn-primary px-3 py-2 text-[12px]"
                              >
                                Salvar nome
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProfileId(null)
                                  setEditingProfileName('')
                                }}
                                className="btn-secondary px-3 py-2 text-[12px]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[15px] font-semibold text-foreground truncate">{profileItem.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {profileItem.statusLabel || (profileItem.id === activeProfileId ? 'Perfil em uso agora' : 'Disponível para outra pessoa da conta')}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {editingProfileId !== profileItem.id && (
                      <button
                        onClick={() => {
                          setEditingProfileId(profileItem.id)
                          setEditingProfileName(profileItem.name)
                          setEditingProfileColor(profileItem.avatarColor || PROFILE_COLOR_OPTIONS[0])
                        }}
                        className="btn-ghost p-2 rounded-xl"
                        title="Renomear perfil"
                      >
                        <PencilLine className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px]',
                      profileItem.status === 'CURRENT_SCREEN'
                        ? 'bg-[var(--apple-blue)]/10 text-[var(--apple-blue)]'
                        : profileItem.status === 'OTHER_SCREEN'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-background/80 text-muted-foreground',
                    )}>
                      <UserRound className="w-3.5 h-3.5" />
                      {profileItem.status === 'CURRENT_SCREEN'
                        ? 'Esta tela está usando este perfil'
                        : profileItem.status === 'OTHER_SCREEN'
                          ? 'Outra tela está usando este perfil'
                          : 'Livre para assistir'}
                    </div>
                    <div className="flex items-center gap-2">
                      {profileItem.id !== activeProfileId && (
                        <button
                          onClick={() => selectAccountProfile(profileItem.id)}
                          className="btn-secondary px-3 py-2 text-[12px]"
                        >
                          Usar perfil
                        </button>
                      )}
                      {accountProfiles.length > 1 && (
                        <button
                          onClick={() => deleteProfile(profileItem.id)}
                          className="text-[12px] text-red-500 hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] bg-secondary p-4">
              <p className="text-[12px] text-muted-foreground mb-3">
                Você pode criar até <span className="font-medium text-foreground">{maxProfiles}</span> perfil(is) neste plano.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-3">
                  <input
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    className="field-input"
                    placeholder={`Perfil ${accountProfiles.length + 1}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    {PROFILE_COLOR_OPTIONS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewProfileColor(color)}
                        className={cn(
                          'w-8 h-8 rounded-full ring-2 transition-all',
                          newProfileColor === color ? 'ring-foreground scale-105' : 'ring-transparent',
                        )}
                        style={{ backgroundColor: color }}
                        title={`Cor ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={createProfile}
                  disabled={creatingProfile || accountProfiles.length >= maxProfiles || !newProfileName.trim()}
                  className="btn-primary px-4 py-2.5 sm:self-start"
                >
                  {creatingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><Plus className="w-4 h-4" /> Criar perfil</>}
                </button>
              </div>
              {accountProfiles.length >= maxProfiles && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  Limite de perfis atingido. Faça upgrade para liberar mais telas e mais perfis.
                </p>
              )}
            </div>
          </div>

          {activeSub && availableUpgradePlans.length > 0 && (
            <div className="surface rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">Upgrade da assinatura</p>
                  <p className="text-[12px] text-muted-foreground">
                    Precisa de mais telas? Gere um PIX de upgrade e a nova assinatura assume após a confirmação.
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {availableUpgradePlans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedUpgradePlanId(plan.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all',
                      selectedUpgradePlanId === plan.id
                        ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5 ring-2 ring-[var(--apple-blue)]/15'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">{plan.name}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {plan.durationDays} dias · {plan.maxDevices} tela(s)
                        </p>
                      </div>
                      <p className="text-[14px] font-semibold text-foreground">{formatCurrency(plan.price)}</p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedUpgradePlan && (
                <div className="rounded-2xl bg-secondary p-4 mb-4 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground mb-1">Resumo do upgrade</p>
                    <p className="text-[12px] text-muted-foreground">
                      Você sairá de <span className="text-foreground font-medium">{activeSub.plan.name}</span> para <span className="text-foreground font-medium">{selectedUpgradePlan.name}</span>.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="rounded-xl bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground mb-1">Telas atuais</p>
                        <p className="text-[14px] font-semibold text-foreground">{activeSub.plan.maxDevices}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground mb-1">Telas após upgrade</p>
                        <p className="text-[14px] font-semibold text-foreground">{selectedUpgradePlan.maxDevices}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-background px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Pagamento</p>
                    <p className="text-[16px] font-semibold text-foreground">{formatCurrency(selectedUpgradePlan.price)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      PIX emitido via {upgradeGateway.gatewayLabel}. A troca do plano acontece automaticamente após a confirmação.
                    </p>
                  </div>
                </div>
              )}

              {upgradeGateway.requiresCustomerDocument && (
                <div className="rounded-2xl bg-secondary p-4 mb-4">
                  <p className="text-[13px] font-semibold text-foreground mb-1">Validação do pagamento</p>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    O gateway atual pede CPF apenas para emitir o PIX com segurança. Esse dado não fica exposto para outros perfis da conta.
                  </p>
                  <input
                    value={upgradeCpf}
                    onChange={e => setUpgradeCpf(formatCpfInput(e.target.value))}
                    placeholder="000.000.000-00"
                    className="field-input"
                    inputMode="numeric"
                  />
                  {upgradeCpfStatus && (
                    <p className={cn(
                      'mt-2 text-[11px]',
                      upgradeCpfStatus === 'valid'
                        ? 'text-green-500'
                        : upgradeCpfStatus === 'invalid'
                          ? 'text-red-500'
                          : 'text-muted-foreground',
                    )}>
                      {upgradeCpfStatus === 'valid'
                        ? 'CPF valido. Ja pode gerar o PIX deste upgrade.'
                        : upgradeCpfStatus === 'invalid'
                          ? 'CPF invalido. Revise os numeros informados.'
                          : 'Continue digitando o CPF completo.'}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={generateUpgradePix}
                disabled={!selectedUpgradePlanId || upgradeLoading || (upgradeGateway.requiresCustomerDocument && !isValidCpf(normalizedUpgradeCpf))}
                className="btn-primary px-4 py-2.5"
              >
                {upgradeLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando upgrade...</> : 'Gerar PIX do upgrade'}
              </button>

              {upgradePixData && (
                <div className="mt-4 rounded-2xl bg-secondary p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{upgradePixData.planName}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {upgradePixData.gatewayLabel || 'Gateway PIX'} · confirmação automática
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="w-3 h-3" />
                      Aguardando pagamento
                    </div>
                  </div>

                  {upgradePixData.pixQRCode && (
                    <div className="flex justify-center">
                      <img
                        src={upgradePixData.pixQRCode.startsWith('data:') ? upgradePixData.pixQRCode : `data:image/png;base64,${upgradePixData.pixQRCode}`}
                        alt="QR PIX do upgrade"
                        className="w-40 h-40 rounded-xl"
                      />
                    </div>
                  )}

                  {upgradePixData.pixCode && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-muted-foreground">
                        {upgradePixData.pixCode}
                      </code>
                      <button onClick={copyUpgradePix} className="btn-secondary px-3 py-2.5">
                        {upgradeCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
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

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function formatCpfInput(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function isValidCpf(value: string) {
  const cpf = normalizeCpf(value)

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index)
  }

  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index)
  }

  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}
