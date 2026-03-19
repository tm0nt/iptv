'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Search, Tv, RefreshCw, ShieldCheck, Star, Trash2, Loader2,
  Check, X, Tag, ChevronLeft, ChevronRight, Filter, Plus, Inbox,
} from 'lucide-react'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PageIntro } from '@/components/admin/PageIntro'

interface Channel {
  uuid: string; name: string; logoUrl?: string | null
  active: boolean; isFeatured: boolean; viewCount: number
  groupTitle?: string | null; categoryId?: string | null
  category?: { id: string; name: string } | null
}
interface Category {
  id: string; name: string; slug: string; icon?: string | null
  _count: { channels: number }
}

const LIMIT = 100

export default function AdminChannels() {
  const [channels,   setChannels]   = useState<Channel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [assigning,  setAssigning]  = useState(false)
  const [page,       setPage]       = useState(1)
  const [searchQ,    setSearchQ]    = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [assignCat,  setAssignCat]  = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('')
  const [addCatOpen, setAddCatOpen] = useState(false)
  const searchRef = useRef<NodeJS.Timeout>()

  const load = useCallback(async (q = searchQ, cat = catFilter, pg = page) => {
    setLoading(true)
    setSelected(new Set())
    const p = new URLSearchParams({ page: String(pg) })
    if (q)   p.set('q',   q)
    if (cat) p.set('cat', cat)
    const res  = await fetch(`/api/admin/channels?${p}`)
    const data = await res.json()
    setChannels(data.channels || [])
    setCategories(data.categories || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [searchQ, catFilter, page])

  useEffect(() => { load() }, [])

  // Debounced search
  function onSearch(v: string) {
    setSearchQ(v)
    setPage(1)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load(v, catFilter, 1), 400)
  }

  function onCatFilter(cat: string) {
    setCatFilter(cat); setPage(1); load(searchQ, cat, 1)
  }

  function onPage(p: number) {
    setPage(p); load(searchQ, catFilter, p)
  }

  // Selection
  const toggleSelect = (uuid: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(uuid) ? next.delete(uuid) : next.add(uuid)
    return next
  })
  const selectAll = () => setSelected(new Set(channels.map(c => c.uuid)))
  const clearSel  = () => setSelected(new Set())

  // Assign category to selected channels
  async function handleAssign() {
    if (!selected.size) return
    setAssigning(true)
    await fetch('/api/admin/channels', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuids:      Array.from(selected),
        categoryId: assignCat || null,
      }),
    })
    setAssigning(false)
    setShowAssign(false)
    setAssignCat('')
    clearSel()
    load()
  }

  // Create new category
  async function handleAddCategory() {
    if (!newCatName.trim()) return
    await fetch('/api/admin/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon || null }),
    })
    setNewCatName(''); setNewCatIcon(''); setAddCatOpen(false)
    load()
  }

  // Delete category
  async function handleDeleteCat(id: string, name: string) {
    if (!confirm(`Excluir categoria "${name}"? Os canais ficam sem categoria.`)) return
    await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' })
    if (catFilter === id) { setCatFilter(''); }
    load(searchQ, catFilter === id ? '' : catFilter, 1)
  }

  const totalPages = Math.ceil(total / LIMIT)
  const uncategorized = channels.filter(c => !c.categoryId).length
  const totalUncategorized = catFilter === 'none' ? total : undefined

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Catálogo de canais"
        description={`${total.toLocaleString()} canais disponíveis e ${categories.length} categoria(s) para organizar a grade.`}
        actions={(
          <>
            <button onClick={() => setAddCatOpen(true)}
              className="btn-secondary py-2.5 px-3 text-[13px]">
              <Plus className="w-3.5 h-3.5" /> Categoria
            </button>
            <a href="/admin/import" className="btn-primary py-2.5 px-3 text-[13px]">
              Importar M3U
            </a>
            <button onClick={() => load()} className="btn-ghost p-2.5">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </>
        )}
      />

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4 -mx-0.5 px-0.5">
        <CategoryPill
          active={!catFilter} label="Todos" count={total}
          onClick={() => onCatFilter('')} />
        <CategoryPill
          active={catFilter === 'none'} label="Sem categoria" count={0}
          onClick={() => onCatFilter('none')}
          className="border-amber-400/40 text-amber-600 dark:text-amber-400"
          activeClass="bg-amber-500 text-white border-amber-500" />
        {categories.map(cat => (
          <div key={cat.id} className="relative group/pill flex-shrink-0">
            <CategoryPill
              active={catFilter === cat.id}
              label={`${cat.icon || ''} ${cat.name}`}
              count={cat._count.channels}
              onClick={() => onCatFilter(cat.id)} />
            <button
              onClick={() => handleDeleteCat(cat.id, cat.name)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity text-[9px] z-10">
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Search + bulk actions bar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQ} onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por nome, grupo M3U..."
            className="field-input pl-9" />
          {searchQ && (
            <button onClick={() => onSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selection controls */}
        {channels.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="btn-secondary py-2 px-3 text-[12px]">
              Selec. todos ({channels.length})
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-[12px] text-muted-foreground">
                  {selected.size} selecionado{selected.size > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowAssign(true)}
                  className="btn-primary py-2 px-3 text-[12px]">
                  <Tag className="w-3.5 h-3.5" /> Atribuir categoria
                </button>
                <button onClick={clearSel} className="btn-ghost p-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {Array.from({ length: 36 }).map((_, index) => (
            <div key={index} className="surface rounded-xl overflow-hidden">
              <Skeleton className="h-12 w-full rounded-none" />
              <div className="p-2 space-y-2">
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && channels.length === 0 && (
        <div className="surface rounded-2xl p-12 text-center">
          <Inbox className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-foreground mb-1">
            {searchQ ? 'Nenhum canal encontrado' : total === 0 ? 'Nenhum canal importado ainda' : 'Nenhum canal nesta categoria'}
          </p>
          <p className="text-[13px] text-muted-foreground mb-4">
            {total === 0 ? 'Importe uma lista M3U para começar.' : 'Tente outra busca ou categoria.'}
          </p>
          {total === 0 && (
            <a href="/admin/import" className="btn-primary py-2.5 px-5 inline-flex">
              Importar M3U
            </a>
          )}
        </div>
      )}

      {/* Channel grid */}
      {!loading && channels.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {channels.map(ch => {
            const isSel = selected.has(ch.uuid)
            return (
              <div
                key={ch.uuid}
                onClick={() => toggleSelect(ch.uuid)}
                className={cn(
                  'surface rounded-xl overflow-hidden group/card cursor-pointer transition-all',
                  'hover:shadow-md hover:-translate-y-0.5 active:scale-[.97]',
                  isSel && 'ring-2 ring-[var(--apple-blue)] shadow-md',
                  !ch.active && 'opacity-40',
                )}>
                {/* Logo */}
                <div className="relative w-full h-12 bg-secondary flex items-center justify-center overflow-hidden">
                  {ch.logoUrl ? (
                    <Image src={ch.logoUrl} alt={ch.name} fill
                      className="object-contain p-1.5" sizes="100px" unoptimized />
                  ) : (
                    <Tv className="w-4 h-4 text-muted-foreground/20" />
                  )}

                  {/* Selection tick */}
                  {isSel && (
                    <div className="absolute inset-0 bg-[var(--apple-blue)]/80 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}

                  {/* Category badge */}
                  {ch.category && !isSel && (
                    <div className="absolute bottom-0 inset-x-0 text-center">
                      <span className="text-[8px] font-bold bg-black/60 text-white px-1 py-0.5 rounded-t-sm">
                        {ch.category.name}
                      </span>
                    </div>
                  )}

                  {ch.isFeatured && (
                    <Star className="absolute top-1 left-1 w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  )}
                </div>

                {/* Name */}
                <div className="px-1.5 py-1.5">
                  <p className="text-[9px] font-medium text-foreground line-clamp-2 leading-tight text-center">
                    {ch.name}
                  </p>
                  {ch.groupTitle && !ch.categoryId && (
                    <p className="text-[8px] text-amber-500 text-center truncate mt-0.5">
                      {ch.groupTitle}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-[13px] text-muted-foreground">
            Página {page} de {totalPages} · {total.toLocaleString()} canais
          </p>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1} onClick={() => onPage(page - 1)}
              className="btn-secondary py-2 px-3 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Page numbers (show 5 around current) */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button key={pg} onClick={() => onPage(pg)}
                  className={cn('w-9 h-9 rounded-xl text-[13px] font-medium transition-all',
                    page === pg ? 'bg-foreground text-background' : 'btn-secondary')}>
                  {pg}
                </button>
              )
            })}
            <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
              className="btn-secondary py-2 px-3 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="mt-5 flex items-start gap-3 surface rounded-xl p-4 border-l-4 border-[var(--apple-blue)]">
        <ShieldCheck className="w-4 h-4 text-[var(--apple-blue)] mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-muted-foreground">
          URLs dos streams nunca expostas ao cliente.
          Capas em <code className="text-[var(--apple-blue)] font-mono">/public/logos/</code> ·
          Proxy em <code className="text-[var(--apple-blue)] font-mono">/api/stream/[uuid]</code>
        </p>
      </div>

      {/* ── Assign category modal ── */}
      {showAssign && (
        <div className="modal-backdrop" onClick={() => setShowAssign(false)}>
          <div className="modal-sheet sm:max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-semibold">Atribuir categoria</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {selected.size} canal{selected.size > 1 ? 'is' : ''} selecionado{selected.size > 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setShowAssign(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
              {/* Remove category option */}
              <button
                onClick={() => setAssignCat('')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all',
                  assignCat === ''
                    ? 'border-[var(--apple-red)]/50 bg-red-500/5'
                    : 'border-border hover:bg-secondary',
                )}>
                <span className="text-lg">✕</span>
                <span className="text-[13px] font-medium text-foreground">Remover categoria</span>
              </button>

              {categories.map(cat => (
                <button key={cat.id}
                  onClick={() => setAssignCat(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all',
                    assignCat === cat.id
                      ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5'
                      : 'border-border hover:bg-secondary',
                  )}>
                  <span className="text-lg w-6 text-center">{cat.icon || '📺'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{cat.name}</p>
                    <p className="text-[11px] text-muted-foreground">{cat._count.channels.toLocaleString()} canais</p>
                  </div>
                  {assignCat === cat.id && <Check className="w-4 h-4 text-[var(--apple-blue)]" />}
                </button>
              ))}
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setShowAssign(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleAssign} disabled={assigning}
                className="btn-primary flex-1 py-2.5">
                {assigning
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : <><Tag className="w-4 h-4" /> Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add category modal ── */}
      {addCatOpen && (
        <div className="modal-backdrop" onClick={() => setAddCatOpen(false)}>
          <div className="modal-sheet sm:max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold">Nova categoria</h2>
              <button onClick={() => setAddCatOpen(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-label mb-1.5 block">Nome</label>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="Ex: Esportes" className="field-input" />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Emoji (opcional)</label>
                <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                  placeholder="⚽" className="field-input text-2xl" maxLength={2} />
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setAddCatOpen(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                className="btn-primary flex-1 py-2.5 disabled:opacity-40">
                <Plus className="w-4 h-4" /> Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryPill({ active, label, count, onClick, className, activeClass }: {
  active: boolean; label: string; count: number; onClick: () => void
  className?: string; activeClass?: string
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-all border',
        active
          ? activeClass || 'bg-foreground text-background border-transparent'
          : `border-border text-muted-foreground hover:text-foreground hover:bg-secondary ${className || ''}`,
      )}>
      {label}
      {count > 0 && <span className="ml-1.5 opacity-60">{count.toLocaleString()}</span>}
    </button>
  )
}
