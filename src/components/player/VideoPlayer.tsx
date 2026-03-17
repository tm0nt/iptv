'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Loader2, AlertCircle, ArrowLeft, RefreshCw, Bug,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  channelUuid: string
  channelName: string
  logoUrl?: string | null
}

interface LogEntry { ts: string; msg: string; level: 'info'|'ok'|'warn'|'error' }

export function VideoPlayer({ channelUuid, channelName, logoUrl }: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef       = useRef<any>(null)
  const timerRef     = useRef<NodeJS.Timeout>()
  // Track whether HLS.js is managing the video (suppress native video errors)
  const hlsActiveRef = useRef(false)
  // Track actual playing state to suppress spurious errors on working streams
  const hasPlayedRef = useRef(false)
  const router       = useRouter()

  const [playing,   setPlaying]   = useState(false)
  const [muted,     setMuted]     = useState(false)
  const [volume,    setVolume]    = useState(1)
  const [buffering, setBuffering] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [fullscreen,setFullscreen]= useState(false)
  const [showCtrl,  setShowCtrl]  = useState(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [attempt,   setAttempt]   = useState(0)

  const proxyUrl = `/api/stream/${channelUuid}`

  const log = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const ts = new Date().toISOString().slice(11, 19)
    setLogs(l => [{ ts, msg, level }, ...l.slice(0, 39)])
    console.log(`[Player ${level}] ${msg}`)
  }, [])

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    hlsActiveRef.current = false
  }, [])

  const initPlayer = useCallback(async (n = 1) => {
    const video = videoRef.current
    if (!video) return

    setAttempt(n)
    setError(null)
    setBuffering(true)
    setPlaying(false)
    hasPlayedRef.current = false
    destroyHls()

    // Reset video without triggering error events
    // Instead of setting src='' (which fires SRC_NOT_SUPPORTED),
    // we pause and wait for HLS.js to take over
    try { video.pause() } catch {}

    log(`Tentativa #${n} — iniciando`)

    // ── Probe the proxy endpoint ──────────────────────────────────────────
    try {
      const probe = await fetch(proxyUrl, {
        credentials: 'include',
        headers: { Range: 'bytes=0-0' },
      })

      if (!probe.ok && probe.headers.get('content-type')?.includes('json')) {
        const j = await probe.json().catch(() => ({}))
        const msg = j.error || `HTTP ${probe.status}`
        const dbg = j.debug ? `\n↳ ${j.debug}` : ''
        log(`${msg}${dbg}`, 'error')
        setError(msg + (dbg ? `\n\n${dbg}` : ''))
        setBuffering(false)
        return
      }

      const ct = probe.headers.get('content-type') || ''
      const st = probe.headers.get('x-stream-type') || 'detecting'
      log(`Proxy OK — ${ct.split(';')[0]} | ${st}`, 'ok')
    } catch (e: any) {
      const msg = `Falha de rede: ${e.message}`
      log(msg, 'error')
      setError(msg)
      setBuffering(false)
      return
    }

    // ── Load with HLS.js ──────────────────────────────────────────────────
    try {
      const Hls = (await import('hls.js')).default

      if (Hls.isSupported()) {
        log('HLS.js iniciando')
        hlsActiveRef.current = true

        const hls = new Hls({
          enableWorker:            true,
          lowLatencyMode:          false,
          maxBufferLength:         20,
          backBufferLength:        30,
          fragLoadingTimeOut:      30000,
          manifestLoadingTimeOut:  15000,
          levelLoadingTimeOut:     15000,
          fragLoadingMaxRetry:     6,
          manifestLoadingMaxRetry: 4,
          fragLoadingRetryDelay:   500,
          // Critical: allow longer TS segments for live streams
          maxFragLookUpTolerance:  0.5,
        })
        hlsRef.current = hls

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          const lvls = data.levels?.length || 0
          log(`Manifest OK — ${lvls > 0 ? `${lvls} qualidade(s)` : 'live stream'}`, 'ok')
          setBuffering(false)
          video.play().catch(e => log(`Autoplay bloqueado: ${e.message}`, 'warn'))
        })

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          // First fragment buffered = stream is actually working
          hasPlayedRef.current = true
          log('Fragmento bufferizado ✓', 'ok')
        })

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          const fatal = data.fatal
          log(
            `${fatal ? '❌ FATAL' : '⚠'} ${data.type}/${data.details}`,
            fatal ? 'error' : 'warn'
          )
          if (fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Don't show error if stream was playing — just try to recover silently
              if (hasPlayedRef.current) {
                log('Recuperando rede...', 'warn')
                setTimeout(() => hls.startLoad(), 1000)
              } else {
                setError(`Falha de rede no stream\n↳ ${data.details}`)
                setBuffering(false)
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (hasPlayedRef.current) {
                log('Recuperando erro de mídia...', 'warn')
                hls.recoverMediaError()
              } else {
                setError(`Erro de mídia\n↳ ${data.details}`)
                setBuffering(false)
              }
            } else {
              setError(`Falha no stream\n↳ ${data.details}\n↳ ${data.type}`)
              setBuffering(false)
            }
          }
        })

        hls.loadSource(proxyUrl)
        hls.attachMedia(video)
        log('HLS.js conectado')

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        log('Safari HLS nativo', 'info')
        hlsActiveRef.current = false
        video.src = proxyUrl
        video.load()
        video.play().catch(() => {})

      } else {
        setError('Este navegador não suporta streams ao vivo.\nUse Chrome, Firefox ou Safari.')
        setBuffering(false)
      }
    } catch (e: any) {
      const msg = `Erro ao inicializar: ${e.message}`
      log(msg, 'error')
      setError(msg)
      setBuffering(false)
    }
  }, [proxyUrl, log, destroyHls])

  // ── Video element events ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onWaiting = () => {
      // Only show buffering if HLS.js isn't handling it after play started
      if (!hasPlayedRef.current) setBuffering(true)
      log('Buffering...')
    }
    const onPlaying = () => {
      setBuffering(false)
      setPlaying(true)
      hasPlayedRef.current = true
      setError(null) // Clear any lingering error once video actually plays
      log('▶ Reproduzindo', 'ok')
    }
    const onPause = () => setPlaying(false)
    const onStalled = () => log('⚠ Stream travado', 'warn')
    const onError = () => {
      const code  = video.error?.code
      const codes: Record<number, string> = {
        1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED',
      }
      const label = code ? (codes[code] || `code ${code}`) : 'desconhecido'

      // KEY FIX: If HLS.js is managing the player OR video has already played,
      // this is a spurious error from the initialization sequence — IGNORE IT.
      // HLS.js resets src internally and the browser fires SRC_NOT_SUPPORTED
      // for the empty/intermediate src state before HLS.js takes over via MSE.
      if (hlsActiveRef.current || hasPlayedRef.current) {
        log(`Video error ignorado (HLS.js gerencia): ${label}`, 'warn')
        return
      }

      log(`❌ Erro de vídeo: ${label}`, 'error')
      setError(`Erro de mídia: ${label}`)
      setBuffering(false)
    }

    video.addEventListener('waiting',  onWaiting)
    video.addEventListener('playing',  onPlaying)
    video.addEventListener('pause',    onPause)
    video.addEventListener('stalled',  onStalled)
    video.addEventListener('error',    onError)

    initPlayer(1)

    return () => {
      video.removeEventListener('waiting',  onWaiting)
      video.removeEventListener('playing',  onPlaying)
      video.removeEventListener('pause',    onPause)
      video.removeEventListener('stalled',  onStalled)
      video.removeEventListener('error',    onError)
      destroyHls()
    }
  }, [initPlayer, destroyHls, log])

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetHide = useCallback(() => {
    setShowCtrl(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => { if (!debugOpen) setShowCtrl(false) },
      3500,
    )
  }, [debugOpen])

  // ── Actions ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return
    v.muted = !v.muted; setMuted(v.muted)
  }
  const setVol = (val: number) => {
    const v = videoRef.current; if (!v) return
    v.volume = val; setVolume(val); setMuted(val === 0)
  }
  const toggleFS = async () => {
    const el = containerRef.current; if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen(); setFullscreen(true)
    } else {
      await document.exitFullscreen(); setFullscreen(false)
    }
  }

  const levelColor = (l: LogEntry['level']) =>
    ({ info: 'text-white/40', ok: 'text-emerald-400', warn: 'text-amber-400', error: 'text-red-400' }[l])

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHide}
      onMouseLeave={() => !debugOpen && setShowCtrl(false)}
      onClick={e => {
        if ((e.target as HTMLElement).closest('[data-no-toggle]')) return
        togglePlay()
      }}
      className={cn(
        'relative bg-black select-none overflow-hidden',
        fullscreen ? 'fixed inset-0 z-50' : 'w-full aspect-video rounded-2xl',
      )}
      style={{ cursor: showCtrl ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted={muted}
        crossOrigin="use-credentials"
      />

      {/* Buffering — only while not yet playing */}
      {buffering && !error && !playing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-white/50" />
          <p className="text-white/30 text-sm">{channelName}</p>
        </div>
      )}

      {/* Error — only shown when video is NOT playing */}
      {error && !playing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 p-6" data-no-toggle>
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-white text-[15px] font-semibold">Erro ao reproduzir</p>
            <p className="text-white/40 text-xs mt-2 whitespace-pre-line leading-relaxed">{error}</p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => { setError(null); initPlayer(attempt + 1) }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </button>
            <button
              onClick={() => setDebugOpen(v => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-colors',
                debugOpen ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 hover:bg-white/20 text-white/70',
              )}
            >
              <Bug className="w-3.5 h-3.5" /> Debug
            </button>
          </div>
          {debugOpen && (
            <div className="w-full max-w-sm bg-black/70 border border-white/10 rounded-xl p-3 font-mono text-[11px] max-h-52 overflow-y-auto space-y-0.5">
              <p className="text-amber-400 font-bold mb-1.5">— Log #{attempt} —</p>
              {logs.map((l, i) => (
                <p key={i} className={cn('leading-snug', levelColor(l.level))}>
                  <span className="text-white/20">{l.ts}</span> {l.msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-between transition-opacity duration-200 pointer-events-none',
          showCtrl ? 'opacity-100 pointer-events-auto' : 'opacity-0',
        )}
        data-no-toggle
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div
          className="px-4 pt-4 pb-10 flex items-center gap-3"
          style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.65) 0%,transparent 100%)' }}
        >
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-white text-[14px] font-semibold flex-1 truncate">{channelName}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/50 text-[10px] font-bold tracking-widest">AO VIVO</span>
          </div>
          <button
            onClick={() => setDebugOpen(v => !v)}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
              debugOpen ? 'bg-amber-500/25 text-amber-300' : 'bg-black/20 text-white/20 hover:text-white/50',
            )}
          >
            <Bug className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom controls */}
        <div
          className="px-4 pb-4 pt-12"
          style={{ background: 'linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)' }}
        >
          {/* Debug log (while playing) */}
          {debugOpen && logs.length > 0 && (
            <div className="mb-3 bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-[10px] max-h-28 overflow-y-auto space-y-0.5">
              {logs.slice(0, 10).map((l, i) => (
                <p key={i} className={cn('leading-snug', levelColor(l.level))}>
                  <span className="text-white/20">{l.ts}</span> {l.msg}
                </p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            >
              {playing
                ? <Pause className="w-4 h-4 fill-white" />
                : <Play  className="w-4 h-4 fill-white ml-0.5" />}
            </button>
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={e => setVol(parseFloat(e.target.value))}
              className="w-20 h-1 accent-white cursor-pointer"
              onClick={e => e.stopPropagation()}
            />
            <div className="flex-1" />
            <button onClick={toggleFS} className="text-white/70 hover:text-white transition-colors">
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
