'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Eye, EyeOff, Sun, Moon, Tv2, Loader2, Check, Clock, Copy, CheckCircle2, ShieldCheck, Sparkles, Lock } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useBranding } from '@/hooks/useBranding'
import { BrandLogo } from '@/components/BrandLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthBackdrop } from '@/components/auth/AuthBackdrop'

interface Plan {
  id: string
  name: string
  description?: string | null
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

type Step = 'account' | 'pix' | 'waiting' | 'success'

export const dynamic = 'force-dynamic'

const INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: '/mes',
  QUARTERLY: '/3 meses',
  SEMIANNUAL: '/6 meses',
  ANNUAL: '/ano',
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const { status } = useSession()
  const branding = useBranding()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme, setTheme } = useTheme()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('account')
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupStarted, setSignupStarted] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [pixData, setPixData] = useState<{
    paymentId: string
    pixCode: string | null
    pixQRCode?: string | null
    amount: number
    planName: string
    expiresAt: string
    gatewayLabel?: string
  } | null>(null)
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    resellerId?: string
    referralCode?: string
    planId: string
  } | null>(null)
  const [paymentGateway, setPaymentGateway] = useState<PaymentGatewayMeta>({
    gatewayId: null,
    gatewayLabel: 'PIX',
    customerDocumentMode: 'none',
    requiresCustomerDocument: false,
  })

  const refCode = searchParams.get('ref')?.trim().toUpperCase()
    || (typeof document !== 'undefined'
      ? document.cookie.split('; ').find(cookie => cookie.startsWith('ref_code='))?.split('=')[1]?.toUpperCase()
      : '')

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  )

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetch('/api/plans')
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar planos')
        return data
      })
      .then(data => {
        const availablePlans = data.plans || []
        setPlans(availablePlans)
        if (availablePlans[0]?.id) setSelectedPlanId(availablePlans[0].id)
      })
      .catch(() => setError('Nao foi possivel carregar os planos agora.'))
      .finally(() => setPlansLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/payment/gateway')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data) setPaymentGateway(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && !signupStarted && step === 'account') {
      router.replace('/watch')
    }
  }, [router, signupStarted, status, step])

  const pollPayment = useCallback(async () => {
    if (!pixData?.paymentId) return
    const response = await fetch(`/api/payment/pix?paymentId=${pixData.paymentId}`)
    const data = await response.json()
    if (data.subscriptionActive || data.status === 'APPROVED') {
      setStep('success')
      setTimeout(() => router.replace('/watch'), 2200)
    }
  }, [pixData, router])

  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(pollPayment, 5000)
    pollPayment()
    return () => clearInterval(interval)
  }, [step, pollPayment])

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedPlan) {
      setError('Escolha um plano para continuar.')
      return
    }

    setSubmitting(true)
    setSignupStarted(true)
    setError('')

    try {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, refCode }),
      })
      const signupData = await signupResponse.json()
      if (!signupResponse.ok) throw new Error(signupData.error || 'Nao foi possivel criar sua conta.')

      const authResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (authResult?.error) {
        throw new Error('Conta criada, mas nao foi possivel iniciar a sessao automaticamente.')
      }

      setPendingPaymentContext({
        planId: selectedPlan.id,
        resellerId: signupData.resellerId || undefined,
        referralCode: refCode || undefined,
      })
      setStep('pix')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao criar sua conta.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGeneratePix(event: React.FormEvent) {
    event.preventDefault()

    if (!pendingPaymentContext) {
      setError('Nao foi possivel preparar o pagamento.')
      return
    }

    const document = normalizeCpf(cpf)
    if (paymentGateway.requiresCustomerDocument && !isValidCpf(document)) {
      setError('Informe um CPF válido para gerar o PIX.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const pixResponse = await fetch('/api/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: pendingPaymentContext.planId,
          resellerId: pendingPaymentContext.resellerId,
          referralCode: pendingPaymentContext.referralCode,
          ...(paymentGateway.requiresCustomerDocument ? { customerDocument: document } : {}),
        }),
      })
      const pixJson = await pixResponse.json()
      if (!pixResponse.ok) throw new Error(pixJson.error || 'Nao foi possivel gerar o PIX.')

      setPixData(pixJson)
      setStep('waiting')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao gerar o PIX.')
    } finally {
      setSubmitting(false)
    }
  }

  function copyPix() {
    if (!pixData?.pixCode) return
    navigator.clipboard.writeText(pixData.pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const timeLeft = pixData
    ? Math.max(0, Math.floor((new Date(pixData.expiresAt).getTime() - Date.now()) / 60000))
    : 0

  const pixQrSrc = pixData?.pixQRCode
    ? (pixData.pixQRCode.startsWith('data:') || pixData.pixQRCode.startsWith('http')
      ? pixData.pixQRCode
      : `data:image/png;base64,${pixData.pixQRCode}`)
    : null
  const normalizedCpf = normalizeCpf(cpf)
  const cpfStatus = normalizedCpf.length === 0
    ? null
    : isValidCpf(normalizedCpf)
      ? 'valid'
      : normalizedCpf.length < 11
        ? 'typing'
        : 'invalid'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <AuthBackdrop />

      {mounted && (
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="fixed top-5 right-5 w-9 h-9 rounded-full surface flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          {resolvedTheme === 'dark'
            ? <Sun className="w-4 h-4 text-amber-400" />
            : <Moon className="w-4 h-4 text-muted-foreground" />}
        </button>
      )}

      <div className="relative w-full max-w-[980px] flex flex-col items-center animate-fade-in">
        <div className="w-full max-w-[360px] flex flex-col items-center mb-8">
          {branding.siteLogoUrl ? (
            <div className="mb-3">
              <BrandLogo
                alt={branding.siteShortName}
                lightSrc={branding.siteLogoLightUrl}
                darkSrc={branding.siteLogoDarkUrl}
                lightClassName="h-12"
                darkClassName="h-12"
              />
            </div>
          ) : (
            <div className="w-[60px] h-[60px] rounded-[18px] bg-[var(--apple-blue)] flex items-center justify-center mb-4 shadow-xl shadow-green-500/20">
              <Tv2 className="w-7 h-7 text-white" />
            </div>
          )}
          {!branding.siteLogoUrl && (
            <h1 className="text-[22px] font-semibold text-foreground tracking-tight">{branding.siteName}</h1>
          )}
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {step === 'account'
              ? 'Crie sua conta e pague com PIX'
              : step === 'pix'
                ? paymentGateway.requiresCustomerDocument
                  ? 'Valide o CPF para emitir o PIX'
                  : 'Revise e emita o PIX da assinatura'
                : 'Ative seu acesso'}
          </p>
          {refCode && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--apple-blue)]/10 text-[var(--apple-blue)] px-3 py-1.5 text-[12px] font-medium">
              Indicado por revendedor · {refCode}
            </div>
          )}
        </div>

        <div className={cn(
          'w-full surface-elevated rounded-2xl p-6',
          step === 'account'
            ? 'max-w-[980px]'
            : step === 'success'
              ? 'max-w-[430px]'
              : 'max-w-[1040px]',
        )}>
          {step === 'account' && (
            <form onSubmit={handleSignup} className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-start">
              <div className="space-y-3">
                <div>
                  <p className="text-[18px] font-semibold text-foreground">Seus dados</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Crie a conta agora com nome, email e celular. O acesso sera liberado depois do pagamento.
                  </p>
                </div>

                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Nome completo"
                  autoComplete="name"
                  required
                  className={cn('field-input rounded-t-xl rounded-b-none border-b-0', error && 'border-red-400/50')}
                />

                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                  className={cn('field-input rounded-none border-b-0', error && 'border-red-400/50')}
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(formatPhoneInput(event.target.value))}
                  placeholder="Celular"
                  autoComplete="tel"
                  required
                  className={cn('field-input rounded-none border-b-0', error && 'border-red-400/50')}
                />

                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Senha"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className={cn('field-input rounded-t-none rounded-b-xl pr-11', error && 'border-red-400/50')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(value => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {selectedPlan && (
                  <div className="rounded-xl bg-muted/60 px-3.5 py-3 text-[12px] text-muted-foreground">
                    Conta criada sem assinatura ativa. O acesso libera quando o gateway confirmar o plano <span className="font-medium text-foreground">{selectedPlan.name}</span>.
                  </div>
                )}

                {error && (
                  <p className="text-[13px] text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || plansLoading || !selectedPlan}
                  className="btn-primary w-full py-3 text-[15px] mt-1"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando conta...</>
                    : `Criar conta${selectedPlan ? ` - ${formatCurrency(selectedPlan.price)}` : ''}`}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[18px] font-semibold text-foreground">Escolha seu plano</p>
                </div>

                {plansLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="rounded-xl border border-border p-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-28 rounded-full" />
                            <Skeleton className="h-3 w-24 rounded-full" />
                          </div>
                          <Skeleton className="h-4 w-16 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plans.map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                          selectedPlanId === plan.id
                            ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5 ring-2 ring-[var(--apple-blue)]/15'
                            : 'border-border hover:bg-muted/40',
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          selectedPlanId === plan.id ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]' : 'border-border',
                        )}>
                          {selectedPlanId === plan.id && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground">{plan.name}</span>
                            {plan.featured && <span className="badge badge-blue text-[9px]">Popular</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {plan.durationDays} dias · {plan.maxDevices} tela(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-foreground">{formatCurrency(plan.price)}</p>
                          <p className="text-[10px] text-muted-foreground">{INTERVAL_LABEL[plan.interval] || ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}

          {step === 'pix' && selectedPlan && (
            <form onSubmit={handleGeneratePix} className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div className="space-y-4">
                <div className="text-left lg:text-left">
                  <h2 className="font-semibold text-foreground text-[20px]">
                    Gerar PIX do plano {selectedPlan.name}
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {paymentGateway.requiresCustomerDocument
                      ? 'Seu CPF sera usado apenas para emitir esta cobranca PIX com seguranca.'
                      : `Seu pagamento sera processado via ${paymentGateway.gatewayLabel} com confirmacao automatica.`}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--apple-blue)]/15 bg-[var(--apple-blue)]/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--apple-blue)]/12 text-[var(--apple-blue)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">
                        Sua conta ja esta pronta para ativacao
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Conta criada com sucesso para <span className="font-medium text-foreground">{email}</span>. Agora falta emitir o PIX de <span className="font-medium text-foreground">{formatCurrency(selectedPlan.price)}</span> para liberar o acesso automaticamente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-muted/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Plano</p>
                    <p className="mt-1 text-[15px] font-semibold text-foreground">{selectedPlan.name}</p>
                    <p className="text-[12px] text-muted-foreground">{selectedPlan.durationDays} dias de acesso</p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telas</p>
                    <p className="mt-1 text-[15px] font-semibold text-foreground">{selectedPlan.maxDevices}</p>
                    <p className="text-[12px] text-muted-foreground">dispositivo(s) simultaneos</p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cobranca</p>
                    <p className="mt-1 text-[15px] font-semibold text-foreground">{formatCurrency(selectedPlan.price)}</p>
                    <p className="text-[12px] text-muted-foreground">ativacao apos confirmacao</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-[13px] font-semibold text-foreground">O que voce recebe ao assinar</p>
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--apple-green)]" />
                      <span>Acesso liberado automaticamente assim que o pagamento for confirmado.</span>
                    </div>
                    <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--apple-green)]" />
                      <span>Uso em ate <span className="font-medium text-foreground">{selectedPlan.maxDevices} dispositivo(s)</span> no plano escolhido.</span>
                    </div>
                    <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--apple-green)]" />
                      <span>Checkout rapido por PIX, sem precisar enviar comprovante manualmente.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:sticky lg:top-4">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-[13px] font-semibold text-foreground">Como a ativacao acontece</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Conta criada', description: 'Seus dados ja foram cadastrados com sucesso.', active: true, done: true },
                      { label: 'PIX emitido', description: paymentGateway.requiresCustomerDocument ? 'Voce informa o CPF e o sistema gera a cobranca.' : 'Voce revisa os dados e o sistema gera a cobranca.', active: true, done: false },
                      { label: 'Pagamento confirmado', description: 'O gateway valida o pagamento automaticamente.', active: false, done: false },
                      { label: 'Acesso liberado', description: 'Sua assinatura e ativada e voce entra na plataforma.', active: false, done: false },
                    ].map((item, index) => (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold',
                              item.done
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : item.active
                                  ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/10 text-[var(--apple-blue)]'
                                  : 'border-border bg-background text-muted-foreground',
                            )}
                          >
                            {item.done ? <Check className="h-4 w-4" /> : index + 1}
                          </div>
                          {index < 3 && (
                            <div className={cn(
                              'mt-1 h-8 w-px',
                              item.done ? 'bg-emerald-500/40' : 'bg-border',
                            )} />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className={cn(
                            'text-[13px] font-medium',
                            item.done || item.active ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[14px] font-semibold text-foreground">Pagamento seguro e validado</p>
                      <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        <span>{paymentGateway.requiresCustomerDocument ? 'Seu CPF entra apenas para emissao da cobranca e nao aparece para outros usuarios.' : 'A cobranca passa apenas pelo gateway configurado e nao depende de comprovante manual.'}</span>
                      </div>
                      <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        <span>A confirmacao acontece de forma automatica pelo gateway configurado, com retorno seguro no sistema.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-background/70 p-4 ring-1 ring-border">
                  <p className="text-[13px] font-semibold text-foreground">
                    {paymentGateway.requiresCustomerDocument ? 'Informe o CPF para continuar' : 'Tudo pronto para emitir o PIX'}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {paymentGateway.requiresCustomerDocument
                      ? 'Esse dado entra apenas na emissao da cobranca PIX.'
                      : `A cobranca sera emitida via ${paymentGateway.gatewayLabel} e a assinatura ativa sozinha quando o pagamento for confirmado.`}
                  </p>

                  {paymentGateway.requiresCustomerDocument && (
                    <>
                      <input
                        type="text"
                        value={cpf}
                        onChange={event => setCpf(formatCpfInput(event.target.value))}
                        placeholder="CPF"
                        autoComplete="off"
                        required
                        className={cn('field-input mt-4', error && 'border-red-400/50')}
                      />

                      {cpfStatus && (
                        <p
                          className={cn(
                            'mt-2 text-[12px]',
                            cpfStatus === 'valid'
                              ? 'text-emerald-500'
                              : cpfStatus === 'typing'
                                ? 'text-muted-foreground'
                                : 'text-red-500',
                          )}
                        >
                          {cpfStatus === 'valid'
                            ? 'CPF valido. Ja pode gerar o PIX.'
                            : cpfStatus === 'typing'
                              ? 'Continue digitando o CPF completo.'
                              : 'CPF invalido. Revise os numeros informados.'}
                        </p>
                      )}
                    </>
                  )}

                  {error && (
                    <p className="mt-2 text-[13px] text-red-500">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || (paymentGateway.requiresCustomerDocument && !isValidCpf(normalizedCpf))}
                    className="btn-primary mt-4 w-full py-3 text-[15px]"
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PIX...</>
                      : `Gerar PIX - ${formatCurrency(selectedPlan.price)}`}
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'waiting' && pixData && (
            <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div className="space-y-4">
                <div className="text-left">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    Aguardando pagamento · {timeLeft}min restantes
                  </div>
                  <h2 className="mt-3 font-semibold text-foreground text-[20px]">
                    Pague {formatCurrency(pixData.amount)} via PIX
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Plano {pixData.planName} · {pixData.gatewayLabel || 'Gateway PIX'}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">Ambiente seguro para ativacao</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Assim que o PIX for confirmado pelo gateway, a plataforma ativa sua assinatura automaticamente. Nao precisa enviar comprovante nem falar com suporte para liberar o acesso.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-[13px] font-semibold text-foreground">Status da ativacao</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Conta criada', description: 'Cadastro concluido com sucesso.', active: true, done: true },
                      { label: 'PIX emitido', description: 'Cobranca gerada para o plano selecionado.', active: true, done: true },
                      { label: 'Pagamento confirmado', description: 'Estamos aguardando o retorno do gateway.', active: true, done: false },
                      { label: 'Acesso liberado', description: 'Assim que confirmar, sua assinatura sera ativada.', active: false, done: false },
                    ].map((item, index) => (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold',
                              item.done
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : item.active
                                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'border-border bg-background text-muted-foreground',
                            )}
                          >
                            {item.done ? <Check className="h-4 w-4" /> : index + 1}
                          </div>
                          {index < 3 && (
                            <div className={cn(
                              'mt-1 h-8 w-px',
                              item.done ? 'bg-emerald-500/40' : 'bg-border',
                            )} />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className={cn(
                            'text-[13px] font-medium',
                            item.done || item.active ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:sticky lg:top-4">
                {pixQrSrc && (
                  <div className="flex justify-center rounded-2xl bg-muted/40 p-4">
                    <div className="surface-sm p-3 inline-block">
                      <img
                        src={pixQrSrc}
                        alt="QR Code do PIX"
                        className="w-44 h-44"
                      />
                    </div>
                  </div>
                )}

                {pixData.pixCode ? (
                  <div className="rounded-2xl bg-background/70 p-4 ring-1 ring-border">
                    <p className="text-label mb-2">PIX Copia e Cola</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-3 py-2.5 rounded-xl font-mono text-muted-foreground truncate border border-border">
                        {pixData.pixCode.slice(0, 40)}...
                      </code>
                      <button onClick={copyPix} className="btn-secondary px-3 py-2.5">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-[var(--apple-green)]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/60 px-3.5 py-3 text-[12px] text-muted-foreground">
                    O gateway retornou apenas o QR Code visual. Escaneie com seu app do banco para concluir o pagamento.
                  </div>
                )}

                <div className="rounded-xl bg-muted/60 p-4 text-[12px] text-muted-foreground">
                  O pagamento sera conferido automaticamente. Assim que o PIX for aprovado, sua assinatura vira ativa e voce entra na plataforma.
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--apple-green)]/15 text-[var(--apple-green)] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-[22px] font-semibold text-foreground">Pagamento aprovado</h2>
              <p className="text-[13px] text-muted-foreground mt-2">
                Sua assinatura foi ativada. Estamos levando voce para o catalogo.
              </p>
            </div>
          )}

          <p className="text-center text-[13px] text-muted-foreground mt-4">
            Ja tem conta?{' '}
            <Link
              href={refCode ? `/login?ref=${encodeURIComponent(refCode)}` : '/login'}
              className="text-[var(--apple-blue)] font-medium hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center text-[12px] text-muted-foreground mt-6">
          © {new Date().getFullYear()} {branding.siteName}
        </p>
      </div>
    </div>
  )
}

function SignupPageFallback() {
  return <div className="min-h-screen bg-background" />
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
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

function formatCpfInput(value: string) {
  const digits = normalizeCpf(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
