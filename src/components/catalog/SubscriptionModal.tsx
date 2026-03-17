'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  Tv2, Check, Loader2, X, Copy, RefreshCw,
  QrCode, Clock, CheckCircle2, Zap,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface Plan {
  id: string; name: string; description?: string | null
  price: number; interval: string; durationDays: number
  maxDevices: number; featured?: boolean
}

type Step = 'plans' | 'pix' | 'waiting' | 'success'

const INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: '/mês', QUARTERLY: '/3 meses',
  SEMIANNUAL: '/6 meses', ANNUAL: '/ano',
}

export function SubscriptionModal({ refCode }: { refCode?: string }) {
  const [step,         setStep]         = useState<Step>('plans')
  const [plans,        setPlans]        = useState<Plan[]>([])
  const [selected,     setSelected]     = useState<Plan | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [pixData,      setPixData]      = useState<{
    paymentId: string; pixCode: string; pixQRCode?: string
    amount: number; planName: string; expiresAt: string
  } | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [pollCount,    setPollCount]    = useState(0)

  // Load plans
  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => { setPlans(d.plans || []); setLoading(false) })
  }, [])

  // Poll payment status every 5s once PIX is shown
  const pollPayment = useCallback(async () => {
    if (!pixData?.paymentId) return
    const res  = await fetch(`/api/payment/pix?paymentId=${pixData.paymentId}`)
    const data = await res.json()
    setPollCount(c => c + 1)
    if (data.subscriptionActive || data.status === 'APPROVED') {
      setStep('success')
      setTimeout(() => window.location.reload(), 2500)
    }
  }, [pixData])

  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(pollPayment, 5000)
    pollPayment() // immediate first check
    return () => clearInterval(interval)
  }, [step, pollPayment])

  async function handleGeneratePix() {
    if (!selected) return
    setGenerating(true)
    try {
      const res = await fetch('/api/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selected.id, resellerId: refCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX')
      setPixData(data)
      setStep('waiting')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function copyPix() {
    if (!pixData?.pixCode) return
    navigator.clipboard.writeText(pixData.pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const timeLeft = pixData
    ? Math.max(0, Math.floor((new Date(pixData.expiresAt).getTime() - Date.now()) / 60000))
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 animate-fade-in z-10"
        style={{ boxShadow: '0 -4px 60px rgba(0,0,0,.35)' }}
      >
        {/* ─── STEP: Plans ─── */}
        {step === 'plans' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Tv2 className="w-5 h-5 text-[var(--apple-blue)]" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Assinar StreamBox Pro</h2>
                <p className="text-xs text-muted-foreground">Escolha seu plano para continuar</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 mb-5">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelected(plan)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      selected?.id === plan.id
                        ? 'border-[var(--apple-blue)] bg-blue-500/5 ring-2 ring-blue-500/20'
                        : 'border-border hover:border-border hover:bg-muted/50',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      selected?.id === plan.id ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]' : 'border-border',
                    )}>
                      {selected?.id === plan.id && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{plan.name}</span>
                        {plan.featured && (
                          <span className="badge badge-blue text-[10px]">Popular</span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-foreground">{formatCurrency(plan.price)}</p>
                      <p className="text-xs text-muted-foreground">{INTERVAL_LABEL[plan.interval]}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setStep('pix')}
              disabled={!selected || loading}
              className="btn-primary w-full py-3 text-base"
            >
              Continuar com PIX
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Pagamento instantâneo e seguro via PIX
            </p>
          </>
        )}

        {/* ─── STEP: Confirm ─── */}
        {step === 'pix' && selected && (
          <>
            <button
              onClick={() => setStep('plans')}
              className="flex items-center gap-1.5 text-sm text-[var(--apple-blue)] mb-5 hover:opacity-70"
            >
              ← Voltar
            </button>
            <h2 className="font-semibold text-foreground mb-1">Confirmar pagamento</h2>
            <p className="text-sm text-muted-foreground mb-5">Revise os detalhes antes de gerar o PIX</p>

            <div className="surface-sm p-4 mb-5 space-y-2.5">
              <SummaryRow label="Plano"    value={selected.name} />
              <SummaryRow label="Duração"  value={`${selected.durationDays} dias`} />
              <SummaryRow label="Dispositivos" value={`${selected.maxDevices}x`} />
              <div className="border-t border-border pt-2.5 mt-1">
                <SummaryRow label="Total" value={formatCurrency(selected.price)} bold />
              </div>
            </div>

            <button
              onClick={handleGeneratePix}
              disabled={generating}
              className="btn-primary w-full py-3 text-base"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PIX...</>
                : <><QrCode className="w-4 h-4" /> Gerar PIX — {formatCurrency(selected.price)}</>
              }
            </button>
          </>
        )}

        {/* ─── STEP: Waiting payment ─── */}
        {step === 'waiting' && pixData && (
          <>
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-semibold mb-3">
                <Clock className="w-3.5 h-3.5" />
                Aguardando pagamento · {timeLeft}min restantes
              </div>
              <h2 className="font-semibold text-foreground mb-1">
                Pague {formatCurrency(pixData.amount)} via PIX
              </h2>
              <p className="text-xs text-muted-foreground">
                Plano {pixData.planName} · Verificação automática ativa
              </p>
            </div>

            {/* QR Code */}
            {pixData.pixQRCode && (
              <div className="flex justify-center mb-4">
                <div className="surface-sm p-3 inline-block">
                  <img
                    src={`data:image/png;base64,${pixData.pixQRCode}`}
                    alt="PIX QR Code"
                    className="w-44 h-44"
                  />
                </div>
              </div>
            )}

            {/* Copia e cola */}
            {pixData.pixCode && (
              <div className="mb-4">
                <p className="text-label mb-2">PIX Copia e Cola</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2.5 rounded-xl font-mono text-muted-foreground truncate border border-border">
                    {pixData.pixCode.slice(0, 40)}...
                  </code>
                  <button
                    onClick={copyPix}
                    className={cn(
                      'btn-secondary px-3 py-2.5 flex-shrink-0 text-xs',
                      copied && 'text-[var(--apple-green)] border-green-400/30',
                    )}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2.5 rounded-xl">
              <RefreshCw className={cn('w-3.5 h-3.5 flex-shrink-0', pollCount > 0 && 'animate-spin')} />
              <span>Verificando pagamento automaticamente... {pollCount > 0 ? `(check #${pollCount})` : ''}</span>
            </div>
          </>
        )}

        {/* ─── STEP: Success ─── */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[var(--apple-green)]" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Assinatura ativada!</h2>
            <p className="text-sm text-muted-foreground mb-1">Pagamento confirmado com sucesso.</p>
            <p className="text-xs text-muted-foreground">Redirecionando para o catálogo...</p>
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto mt-4" />
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm', bold ? 'font-bold text-foreground text-base' : 'text-foreground')}>{value}</span>
    </div>
  )
}
