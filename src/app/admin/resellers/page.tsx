'use client'
import { useEffect, useState } from 'react'
import { Copy, TrendingUp, Users, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { PageIntro } from '@/components/admin/PageIntro'

interface ResellerRow {
  id: string; name: string; email: string; active: boolean
  referralCode?: string; commissionRate?: number; createdAt: string
  _count: { clientsAsReseller: number }
}

export default function AdminResellers() {
  const LIMIT = 12
  const [resellers, setResellers] = useState<ResellerRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/users?role=RESELLER&limit=${LIMIT}&page=${page}`)
      .then(r => r.json())
      .then(d => { setResellers(d.users || []); setTotal(d.total || 0); setLoading(false) })
  }, [page])

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/api/affiliate/${code}`)
    setCopied(code); setTimeout(() => setCopied(null), 2500)
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  if (loading) return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-44 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-3 w-40 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Rede de revendedores"
        description={`${total.toLocaleString()} revendedor(es) com links de afiliado e comissão configurada.`}
      />

      {resellers.length === 0 ? (
        <div className="surface rounded-[30px] p-12 text-center text-muted-foreground text-[13px]">
          Nenhum revendedor ainda. Crie um na página de Usuários com a função Revendedor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resellers.map(r => (
            <div key={r.id} className="surface rounded-[30px] p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 font-semibold text-[14px]">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-[14px]">{r.name}</p>
                    <p className="text-[12px] text-muted-foreground">{r.email}</p>
                  </div>
                </div>
                <span className={cn('badge', r.active ? 'badge-green' : 'badge-red')}>
                  {r.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Users className="w-3 h-3" />
                    <span className="text-[11px]">Clientes</span>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {r._count.clientsAsReseller}
                  </p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[11px]">Comissão</span>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {((r.commissionRate || 0.2) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Affiliate link */}
              {r.referralCode && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] bg-secondary px-3 py-2 rounded-xl font-mono text-muted-foreground truncate border border-border">
                    /api/affiliate/{r.referralCode}
                  </code>
                  <button onClick={() => copyLink(r.referralCode!)}
                    className={cn('btn-secondary px-2.5 py-2 text-[12px] flex-shrink-0',
                      copied === r.referralCode && 'text-[var(--apple-green)]')}>
                    {copied === r.referralCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            Página {page} de {totalPages}
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
  )
}
