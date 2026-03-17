'use client'
import { useEffect, useState } from 'react'
import { Copy, TrendingUp, Users, Loader2, Check } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface ResellerRow {
  id: string; name: string; email: string; active: boolean
  referralCode?: string; commissionRate?: number; createdAt: string
  _count: { clientsAsReseller: number }
}

export default function AdminResellers() {
  const [resellers, setResellers] = useState<ResellerRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users?role=RESELLER&limit=50')
      .then(r => r.json())
      .then(d => { setResellers(d.users || []); setLoading(false) })
  }, [])

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/api/affiliate/${code}`)
    setCopied(code); setTimeout(() => setCopied(null), 2500)
  }

  if (loading) return (
    <div className="p-6 pt-20 md:pt-8 flex justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-foreground">Revendedores</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {resellers.length} revendedores cadastrados
        </p>
      </div>

      {resellers.length === 0 ? (
        <div className="surface rounded-2xl p-12 text-center text-muted-foreground text-[13px]">
          Nenhum revendedor ainda. Crie um na página de Usuários com a função Revendedor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resellers.map(r => (
            <div key={r.id} className="surface rounded-2xl p-5">
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
    </div>
  )
}
