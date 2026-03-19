'use client'
import { useState, useRef, useCallback } from 'react'
import {
  Upload, Link2, FileText, CheckCircle2, AlertCircle,
  Loader2, X, ChevronDown, ChevronUp, Tv, FolderOpen,
  RefreshCw, Eye, Database, Zap, Plus, File, Trash2, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageIntro } from '@/components/admin/PageIntro'

type Mode = 'file' | 'url' | 'paste'
type ImportMode = 'merge' | 'replace'
type Step = 'idle' | 'previewing' | 'previewed' | 'importing' | 'done' | 'error'

interface FileEntry { id: string; file: File; size: string }
interface PreviewData {
  files: Array<{ name: string; count: number }>
  total: number; groups: number; groupNames: string[]; sample: any[]
}
interface ImportResult {
  files: Array<{ name: string; count: number }>
  total: number
  created?: number
  skipped?: number
  elapsed: string
  channels?: {
    created?: number
    skipped?: number
  }
}

const MAX_MB    = 200
const MAX_BYTES = MAX_MB * 1024 * 1024
const fmtBytes  = (b: number) => b < 1024 ? `${b}B` : b < 1024**2 ? `${(b/1024).toFixed(0)}KB` : `${(b/1024**2).toFixed(1)}MB`

export default function AdminImport() {
  const [inputMode,  setInputMode]  = useState<Mode>('file')
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [step,       setStep]       = useState<Step>('idle')
  const [files,      setFiles]      = useState<FileEntry[]>([])
  const [urls,       setUrls]       = useState<string[]>([''])
  const [paste,      setPaste]      = useState('')
  const [preview,    setPreview]    = useState<PreviewData | null>(null)
  const [result,     setResult]     = useState<ImportResult | null>(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [showGroups, setShowGroups] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('idle'); setFiles([]); setUrls(['']); setPaste('')
    setPreview(null); setResult(null); setErrorMsg(''); setProgress(0)
  }

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const toAdd: FileEntry[] = []
    const errs: string[] = []
    Array.from(incoming).forEach(f => {
      if (f.size > MAX_BYTES) { errs.push(`"${f.name}" excede ${MAX_MB}MB`); return }
      if (files.some(e => e.file.name === f.name && e.file.size === f.size)) return
      toAdd.push({ id: `${f.name}-${f.size}`, file: f, size: fmtBytes(f.size) })
    })
    if (errs.length) { setErrorMsg(errs.join('\n')); setStep('error') }
    setFiles(prev => [...prev, ...toAdd])
  }, [files])

  const buildFD = () => { const fd = new FormData(); files.forEach(e => fd.append('files', e.file)); return fd }

  async function handlePreview() {
    setStep('previewing'); setErrorMsg('')
    try {
      let res: Response
      if (inputMode === 'file') {
        res = await fetch('/api/admin/import?preview=1', { method: 'POST', body: buildFD() })
      } else if (inputMode === 'url') {
        res = await fetch('/api/admin/import?preview=1', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: urls.filter(u => u.trim().startsWith('http')) }),
        })
      } else {
        res = await fetch('/api/admin/import?preview=1', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: paste }),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data); setStep('previewed')
    } catch (e: any) { setErrorMsg(e.message); setStep('error') }
  }

  async function handleImport() {
    setStep('importing'); setProgress(0)
    const prog = setInterval(() => setProgress(p => Math.min(p + Math.random() * 4, 90)), 800)
    try {
      let res: Response
      if (inputMode === 'file') {
        res = await fetch(`/api/admin/import?mode=${importMode}`, { method: 'POST', body: buildFD() })
      } else if (inputMode === 'url') {
        res = await fetch(`/api/admin/import?mode=${importMode}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: urls.filter(u => u.trim().startsWith('http')) }),
        })
      } else {
        res = await fetch(`/api/admin/import?mode=${importMode}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: paste }),
        })
      }
      clearInterval(prog); setProgress(100)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data); setStep('done')
    } catch (e: any) { clearInterval(prog); setErrorMsg(e.message); setStep('error') }
  }

  const canPreview =
    (inputMode === 'file' && files.length > 0) ||
    (inputMode === 'url'  && urls.some(u => u.trim().startsWith('http'))) ||
    (inputMode === 'paste' && paste.includes('#EXTINF'))

  const createdCount = result?.created ?? result?.channels?.created ?? 0
  const skippedCount = result?.skipped ?? result?.channels?.skipped ?? 0

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-10 max-w-7xl space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Importação de canais M3U"
        description={`Múltiplos arquivos, URLs ou texto colado. Até ${MAX_MB}MB por arquivo com suporte a grandes volumes.`}
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-[var(--apple-blue)]/8 border border-[var(--apple-blue)]/20 rounded-[24px]">
        <Info className="w-4 h-4 text-[var(--apple-blue)] mt-0.5 flex-shrink-0" />
        <div className="text-[12px] text-foreground space-y-1">
          <p className="font-semibold">Canais importados ficam sem categoria</p>
          <p className="text-muted-foreground">
            Após importar, vá em <strong>Canais</strong> → selecione os canais → clique em{' '}
            <strong>"Atribuir categoria"</strong> para organizá-los em Esportes, Filmes, etc.
          </p>
        </div>
      </div>

      {/* Input tabs */}
      {(step === 'idle' || step === 'previewing' || step === 'previewed' || step === 'error') && (
        <div className="space-y-4">
          <div className="surface rounded-[30px] overflow-hidden">
            <div className="flex border-b border-border">
              {([
                ['file',  FileText, 'Arquivo(s)'],
                ['url',   Link2,    'URL(s)'],
                ['paste', Database, 'Colar texto'],
              ] as const).map(([m, Icon, label]) => (
                <button key={m} onClick={() => setInputMode(m)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-all',
                    inputMode === m
                      ? 'text-[var(--apple-blue)] border-b-2 border-[var(--apple-blue)] bg-[var(--apple-blue)]/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* File upload */}
              {inputMode === 'file' && (
                <div className="space-y-3">
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl py-8 px-6 text-center cursor-pointer transition-all',
                      dragging ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5 scale-[1.01]'
                        : files.length ? 'border-[var(--apple-blue)]/30 hover:border-[var(--apple-blue)]'
                        : 'border-border hover:border-[var(--apple-blue)]/40 hover:bg-secondary/40',
                    )}>
                    <input ref={fileRef} type="file" multiple accept=".m3u,.m3u8,.txt" className="hidden"
                      onChange={e => addFiles(e.target.files)} />
                    <FolderOpen className={cn('w-9 h-9 mx-auto mb-2.5 transition-colors',
                      dragging ? 'text-[var(--apple-blue)]' : 'text-muted-foreground/30')} />
                    <p className="text-[14px] font-medium text-foreground mb-1">
                      {dragging ? 'Solte aqui' : 'Arraste ou clique para selecionar'}
                    </p>
                    <p className="text-[12px] text-muted-foreground">.m3u .m3u8 .txt · múltiplos · até {MAX_MB}MB cada</p>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-label">{files.length} arquivo{files.length > 1 ? 's' : ''} · {fmtBytes(files.reduce((s, e) => s + e.file.size, 0))} total</p>
                        <button onClick={() => setFiles([])} className="text-[11px] text-[var(--apple-red)]">Remover todos</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                        {files.map(e => (
                          <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 bg-secondary rounded-xl border border-border">
                            <File className="w-3.5 h-3.5 text-[var(--apple-blue)] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">{e.file.name}</p>
                              <p className="text-[11px] text-muted-foreground">{e.size}</p>
                            </div>
                            <button onClick={() => setFiles(p => p.filter(x => x.id !== e.id))}
                              className="text-muted-foreground hover:text-[var(--apple-red)]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => fileRef.current?.click()}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:text-[var(--apple-blue)] hover:border-[var(--apple-blue)]/40 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Adicionar mais
                      </button>
                    </div>
                  )}
                </div>
              )}

              {inputMode === 'url' && (
                <div className="space-y-3">
                  <label className="text-label block">URLs das listas M3U</label>
                  {urls.map((u, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={u} onChange={e => setUrls(p => p.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={`http://servidor.com/lista${i > 0 ? i+1 : ''}.m3u8`}
                        className="field-input flex-1" />
                      {urls.length > 1 && (
                        <button onClick={() => setUrls(p => p.filter((_, j) => j !== i))}
                          className="btn-ghost p-2.5 text-muted-foreground hover:text-[var(--apple-red)]">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setUrls(p => [...p, ''])}
                    className="flex items-center gap-1.5 text-[13px] text-[var(--apple-blue)]">
                    <Plus className="w-3.5 h-3.5" /> Adicionar URL
                  </button>
                </div>
              )}

              {inputMode === 'paste' && (
                <div>
                  <label className="text-label mb-1.5 block">Conteúdo M3U</label>
                  <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={10}
                    placeholder={'#EXTM3U\n#EXTINF:-1 group-title="CANAIS",Canal 1\nhttp://...'}
                    className="field-input font-mono text-[11px] resize-none leading-relaxed" />
                  {paste && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {paste.split('\n').filter(l => l.startsWith('#EXTINF')).length.toLocaleString()} entradas detectadas
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Import mode */}
          <div className="surface rounded-2xl p-5">
            <p className="text-[13px] font-semibold text-foreground mb-3">Modo de importação</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['merge',   Zap,       'blue', 'Mesclar',    'Adiciona novos. Canais existentes são mantidos.'],
                ['replace', RefreshCw, 'red',  'Substituir', 'APAGA todos os canais e reimporta do zero.'],
              ] as const).map(([m, Icon, color, title, desc]) => (
                <button key={m} onClick={() => setImportMode(m)}
                  className={cn('text-left p-4 rounded-xl border-2 transition-all',
                    importMode === m
                      ? color === 'blue' ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5'
                        : 'border-[var(--apple-red)] bg-[var(--apple-red)]/5'
                      : 'border-border hover:bg-secondary/50')}>
                  <div className={cn('flex items-center gap-2 mb-1.5 font-semibold text-[13px]',
                    importMode === m && color === 'blue' ? 'text-[var(--apple-blue)]' :
                    importMode === m && color === 'red'  ? 'text-[var(--apple-red)]'  : 'text-foreground')}>
                    <Icon className="w-3.5 h-3.5" /> {title}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {step === 'error' && errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-400/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-red-400 whitespace-pre-line">{errorMsg}</p>
            </div>
          )}

          <button onClick={handlePreview} disabled={!canPreview || step === 'previewing'}
            className="btn-primary w-full py-3 text-[14px] disabled:opacity-40">
            {step === 'previewing'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
              : <><Eye className="w-4 h-4" /> Analisar antes de importar</>}
          </button>

          {/* Preview result (inline below button) */}
          {step === 'previewed' && preview && (
            <div className="surface rounded-2xl overflow-hidden animate-fade-in">
              <div className="px-5 py-4 bg-[var(--apple-blue)]/5 border-b border-border flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--apple-blue)]" />
                <div>
                  <p className="text-[14px] font-semibold text-foreground">
                    {preview.total.toLocaleString()} canais encontrados
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {preview.groups} grupos M3U · Serão importados SEM categoria
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {preview.files.length > 1 && (
                  <div className="space-y-1.5">
                    {preview.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-[12px]">
                        <File className="w-3 h-3 text-muted-foreground" />
                        <span className="flex-1 text-foreground truncate">{f.name}</span>
                        <span className="badge badge-blue text-[10px]">{f.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => setShowGroups(v => !v)}
                  className="w-full flex items-center justify-between text-[12px] text-muted-foreground py-1">
                  <span>Grupos M3U ({preview.groups})</span>
                  {showGroups ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showGroups && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.groupNames.map(g => (
                      <span key={g} className="badge badge-gray text-[10px]">{g}</span>
                    ))}
                    {preview.groups > preview.groupNames.length && (
                      <span className="badge badge-gray text-[10px]">+{preview.groups - preview.groupNames.length} mais</span>
                    )}
                  </div>
                )}

                {importMode === 'replace' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-400/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-400">
                      <strong>Atenção:</strong> Modo Substituir apagará todos os canais existentes.
                    </p>
                  </div>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button onClick={reset} className="btn-secondary flex-1 py-2.5"><X className="w-4 h-4" /> Cancelar</button>
                  <button onClick={handleImport} className="btn-primary flex-1 py-2.5 text-[13px]">
                    <Upload className="w-4 h-4" />
                    Importar {preview.total.toLocaleString()} canais
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="surface rounded-2xl p-8 text-center animate-fade-in">
          <div className="w-14 h-14 bg-[var(--apple-blue)]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--apple-blue)]" />
          </div>
          <p className="text-[16px] font-semibold text-foreground mb-1">Importando canais...</p>
          <p className="text-[13px] text-muted-foreground mb-6">
            Inserindo no banco de dados em lotes de 1.000 canais
          </p>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mb-2">
            <div className="h-2 bg-[var(--apple-blue)] rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[12px] text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <div className="space-y-4 animate-fade-in">
          <div className="surface rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[var(--apple-green)]" />
            </div>
            <p className="text-[18px] font-bold text-foreground mb-1">Importação concluída!</p>
            <p className="text-[13px] text-muted-foreground">
              {createdCount.toLocaleString()} canais adicionados em {result.elapsed}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ['Criados',  createdCount, 'text-[var(--apple-green)]'],
              ['Ignorados', skippedCount, 'text-muted-foreground'],
              ['Total',    result.total,    'text-[var(--apple-blue)]'],
            ] as const).map(([label, value, cls]) => (
              <div key={label} className="surface rounded-xl p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums', cls)}>{(value as number).toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-400/20 rounded-xl">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-[12px] text-amber-400">
              <p className="font-semibold mb-0.5">Próximo passo: atribuir categorias</p>
              <p>Vá em <strong>Canais</strong>, pesquise e selecione os canais, depois clique em "Atribuir categoria" para organizar sua grade.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary flex-1 py-2.5">
              <Upload className="w-4 h-4" /> Nova importação
            </button>
            <a href="/admin/channels" className="btn-primary flex-1 py-2.5 inline-flex items-center justify-center gap-2 text-[14px]">
              <Tv className="w-4 h-4" /> Organizar canais
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
