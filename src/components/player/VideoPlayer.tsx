'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Loader2, AlertCircle, ArrowLeft, RefreshCw, Bug, Lightbulb, LightbulbOff, PanelRightClose, PanelBottomClose,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  channelUuid: string
  channelName: string
  contentType?: 'LIVE' | 'MOVIE' | 'SERIES'
  logoUrl?: string | null
  layoutExpanded?: boolean
  onToggleLayout?: () => void
}

interface LogEntry { ts: string; msg: string; level: 'info'|'ok'|'warn'|'error' }

interface DebugStats {
  status: 'connecting' | 'live' | 'unstable' | 'buffering' | 'error'
  statusLabel: string
  connectionMode: string
  levels: number
  currentLevel: string
  bandwidthKbps: number | null
  bufferAhead: number
  latency: number | null
  droppedFrames: number | null
  decodedFrames: number | null
  stalls: number
  recoveries: number
  fatalErrors: number
  fragmentErrors: number
  fragmentsBuffered: number
  totalBufferingMs: number
  readyState: number
  networkState: number
  lastError: string | null
  lastHeartbeatAt: number
  lastStallAt: number | null
}

type DebugStatsPatch = Partial<DebugStats> | ((current: DebugStats) => DebugStats)

const INITIAL_DEBUG_STATS: DebugStats = {
  status: 'connecting',
  statusLabel: 'Conectando',
  connectionMode: 'Transmissao protegida',
  levels: 0,
  currentLevel: 'auto',
  bandwidthKbps: null,
  bufferAhead: 0,
  latency: null,
  droppedFrames: null,
  decodedFrames: null,
  stalls: 0,
  recoveries: 0,
  fatalErrors: 0,
  fragmentErrors: 0,
  fragmentsBuffered: 0,
  totalBufferingMs: 0,
  readyState: 0,
  networkState: 0,
  lastError: null,
  lastHeartbeatAt: 0,
  lastStallAt: null,
}

export function VideoPlayer({
  channelUuid,
  channelName,
  contentType = 'LIVE',
  logoUrl,
  layoutExpanded = false,
  onToggleLayout,
}: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef       = useRef<any>(null)
  const timerRef     = useRef<NodeJS.Timeout>()
  const attemptRef   = useRef(0)
  const bufferingStartedAtRef = useRef<number | null>(null)
  const lastProgressAtRef = useRef(Date.now())
  const lastCurrentTimeRef = useRef(0)
  const fatalRecoveryAttemptsRef = useRef(0)
  const softRecoveryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const resumeAppliedRef = useRef(false)
  const progressSentAtRef = useRef(0)
  // Track whether HLS.js is managing the video (suppress native video errors)
  const hlsActiveRef = useRef(false)
  // Track actual playing state to suppress spurious errors on working streams
  const hasPlayedRef = useRef(false)
  const tearingDownRef = useRef(false)
  const eventRef     = useRef<Record<string, number>>({})
  const router       = useRouter()

  const [playing,   setPlaying]   = useState(false)
  const [muted,     setMuted]     = useState(false)
  const [volume,    setVolume]    = useState(1)
  const [buffering, setBuffering] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [fullscreen,setFullscreen]= useState(false)
  const [lightsOff, setLightsOff] = useState(false)
  const [showCtrl,  setShowCtrl]  = useState(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [debugStats, setDebugStats] = useState<DebugStats>(INITIAL_DEBUG_STATS)
  const [attempt,   setAttempt]   = useState(0)
  const [resumeAt,  setResumeAt]  = useState<number | null>(null)

  const proxyUrl = `/api/stream/${channelUuid}`

  const saveProgress = useCallback((currentTime?: number, duration?: number | null) => {
    fetch('/api/player/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({
        channelUuid,
        contentType,
        progressSeconds: contentType === 'LIVE' ? 0 : Math.max(0, currentTime || 0),
        durationSeconds: contentType === 'LIVE' ? null : duration || null,
      }),
    }).catch(() => {})
  }, [channelUuid, contentType])

  const sanitizeDebugMessage = useCallback((message: string) => {
    return message
      .replace(/https?:\/\/[^\s]+/gi, '[oculto]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[oculto]')
      .replace(/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?::\d+)?/g, '[oculto]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, '[oculto]')
  }, [])

  const publicPlaybackError = useCallback((kind: 'network' | 'media' | 'generic' | 'unsupported') => {
    return {
      network: 'A transmissao esta oscilando. Tente novamente em instantes.',
      media: 'A transmissao encontrou um erro de reproducao.',
      generic: 'A transmissao esta indisponivel no momento.',
      unsupported: 'Este navegador nao suporta streams ao vivo.',
    }[kind]
  }, [])

  const log = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const ts = new Date().toISOString().slice(11, 19)
    const safeMsg = sanitizeDebugMessage(msg)
    setLogs(l => [{ ts, msg: safeMsg, level }, ...l.slice(0, 39)])
    console.log(`[Player ${level}] ${safeMsg}`)
  }, [sanitizeDebugMessage])

  const sendPlayerEvent = useCallback((action: string, metadata?: Record<string, unknown>, cooldownMs = 10000) => {
    const now = Date.now()
    const lastAt = eventRef.current[action] || 0
    if (now - lastAt < cooldownMs) return
    eventRef.current[action] = now

    fetch('/api/player/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({
        action,
        channelUuid,
        channelName,
        metadata,
      }),
    }).catch(() => {})
  }, [channelName, channelUuid])

  const isAbortLikeError = useCallback((value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const error = value as { name?: string; message?: string }
    return error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted') === true
  }, [])

  const updateDebugStats = useCallback((patch: DebugStatsPatch) => {
    setDebugStats(current => (
      typeof patch === 'function'
        ? patch(current)
        : { ...current, ...patch }
    ))
  }, [])

  const destroyHls = useCallback(() => {
    const hls = hlsRef.current
    hlsRef.current = null
    hlsActiveRef.current = false
    tearingDownRef.current = true
    fatalRecoveryAttemptsRef.current = 0

    if (softRecoveryTimerRef.current) {
      clearTimeout(softRecoveryTimerRef.current)
      softRecoveryTimerRef.current = null
    }

    if (hls) {
      try {
        hls.detachMedia()
      } catch {}

      try {
        hls.destroy()
      } catch (error) {
        if (!isAbortLikeError(error)) {
          console.warn('[Player warn] Falha ao destruir HLS', error)
        }
      }
    }

    const video = videoRef.current
    if (video) {
      try { video.pause() } catch {}
      try {
        video.removeAttribute('src')
        video.load()
      } catch {}
    }
  }, [isAbortLikeError])

  const initPlayer = useCallback(async (n = 1) => {
    const video = videoRef.current
    if (!video) return

    attemptRef.current = n
    setAttempt(n)
    setError(null)
    setBuffering(true)
    setPlaying(false)
    bufferingStartedAtRef.current = Date.now()
    lastProgressAtRef.current = Date.now()
    lastCurrentTimeRef.current = 0
    fatalRecoveryAttemptsRef.current = 0
    hasPlayedRef.current = false
    setDebugStats({
      ...INITIAL_DEBUG_STATS,
      lastHeartbeatAt: Date.now(),
    })
    destroyHls()
    tearingDownRef.current = false

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
        const msg = sanitizeDebugMessage(j.error || `HTTP ${probe.status}`)
        log(msg, 'error')
        setError(probe.status === 409 ? msg : publicPlaybackError('generic'))
        setBuffering(false)
        updateDebugStats({
          status: 'error',
          statusLabel: 'Falha na transmissao',
          lastError: probe.status === 409 ? msg : publicPlaybackError('generic'),
        })
        return
      }

      const st = probe.headers.get('x-stream-type') || 'detecting'
      updateDebugStats({
        connectionMode: st === 'synthetic-hls' ? 'Transmissao protegida adaptativa' : 'Transmissao protegida',
        status: 'connecting',
        statusLabel: 'Proxy respondeu',
        lastHeartbeatAt: Date.now(),
      })
      log('Proxy conectado com sucesso', 'ok')
    } catch (e: any) {
      const msg = 'Falha de conexao com a transmissao'
      log(msg, 'error')
      setError(publicPlaybackError('network'))
      setBuffering(false)
      updateDebugStats({
        status: 'error',
        statusLabel: 'Falha de rede',
        lastError: publicPlaybackError('network'),
      })
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
          liveDurationInfinity:    true,
          startFragPrefetch:       true,
          maxBufferLength:         45,
          maxMaxBufferLength:      90,
          backBufferLength:        90,
          maxBufferHole:           1.2,
          highBufferWatchdogPeriod: 2,
          liveSyncDurationCount:   4,
          liveMaxLatencyDurationCount: 10,
          maxLiveSyncPlaybackRate: 1.25,
          fragLoadingTimeOut:      30000,
          manifestLoadingTimeOut:  15000,
          levelLoadingTimeOut:     15000,
          fragLoadingMaxRetry:     8,
          manifestLoadingMaxRetry: 6,
          levelLoadingMaxRetry:    6,
          fragLoadingRetryDelay:   1000,
          manifestLoadingRetryDelay: 1000,
          levelLoadingRetryDelay:  1000,
          nudgeOffset:             0.15,
          nudgeMaxRetry:           8,
          // Critical: allow longer TS segments for live streams
          maxFragLookUpTolerance:  0.5,
        })
        hlsRef.current = hls

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          const lvls = data.levels?.length || 0
          updateDebugStats({
            levels: lvls,
            status: 'connecting',
            statusLabel: lvls > 0 ? 'Manifest carregado' : 'Live detectado',
            lastHeartbeatAt: Date.now(),
          })
          log(`Manifest OK — ${lvls > 0 ? `${lvls} qualidade(s)` : 'live protegido'}`, 'ok')
          setBuffering(false)
          video.play().catch(e => log(`Autoplay bloqueado: ${e.message}`, 'warn'))
        })

        hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          const level = typeof data.level === 'number' && data.level >= 0 ? String(data.level + 1) : 'auto'
          updateDebugStats({
            currentLevel: level,
            lastHeartbeatAt: Date.now(),
          })
          log(`Qualidade ativa: ${level}`, 'info')
        })

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          // First fragment buffered = stream is actually working
          hasPlayedRef.current = true
          fatalRecoveryAttemptsRef.current = 0
          updateDebugStats(current => ({
            ...current,
            fragmentsBuffered: current.fragmentsBuffered + 1,
            status: 'live',
            statusLabel: 'Fluxo recebendo segmentos',
            lastHeartbeatAt: Date.now(),
          }))
          log('Fragmento bufferizado ✓', 'ok')
        })

        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          const fatal = data.fatal
          const message = `${data.type}/${data.details}`
          updateDebugStats(current => ({
            ...current,
            fatalErrors: current.fatalErrors + (fatal ? 1 : 0),
            fragmentErrors: current.fragmentErrors + (data.type === Hls.ErrorTypes.NETWORK_ERROR ? 1 : 0),
            stalls: current.stalls + (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ? 1 : 0),
            lastStallAt: data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ? Date.now() : current.lastStallAt,
            lastError: fatal ? publicPlaybackError('generic') : 'Oscilacao detectada e controlada',
            status: fatal ? 'error' : 'unstable',
            statusLabel: fatal ? 'Erro fatal no stream' : 'Oscilação detectada',
            lastHeartbeatAt: Date.now(),
          }))
          log(
            `${fatal ? '❌ FATAL' : '⚠'} ${message}`,
            fatal ? 'error' : 'warn'
          )
          if (fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Don't show error if stream was playing — just try to recover silently
              if (hasPlayedRef.current) {
                log('Recuperando rede...', 'warn')
                updateDebugStats(current => ({
                  ...current,
                  recoveries: current.recoveries + 1,
                  status: 'unstable',
                  statusLabel: 'Recuperando rede',
                }))
                if (softRecoveryTimerRef.current) clearTimeout(softRecoveryTimerRef.current)
                setBuffering(true)
                softRecoveryTimerRef.current = setTimeout(() => {
                  if (hlsRef.current !== hls) return
                  try {
                    hls.startLoad(-1)
                    video.play().catch(() => {})
                  } catch {}
                }, 750)
              } else {
                setError(publicPlaybackError('network'))
                setBuffering(false)
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (hasPlayedRef.current) {
                log('Recuperando erro de mídia...', 'warn')
                updateDebugStats(current => ({
                  ...current,
                  recoveries: current.recoveries + 1,
                  status: 'unstable',
                  statusLabel: 'Recuperando mídia',
                }))
                setBuffering(true)
                try {
                  hls.recoverMediaError()
                  video.play().catch(() => {})
                } catch {}
              } else {
                setError(publicPlaybackError('media'))
                setBuffering(false)
              }
            } else {
              fatalRecoveryAttemptsRef.current += 1
              if (hasPlayedRef.current && fatalRecoveryAttemptsRef.current <= 2) {
                log('Erro fatal fora do padrao, reinicializando stream suavemente...', 'warn')
                if (softRecoveryTimerRef.current) clearTimeout(softRecoveryTimerRef.current)
                setBuffering(true)
                softRecoveryTimerRef.current = setTimeout(() => {
                  initPlayer(attemptRef.current + 1)
                }, 900)
              } else {
                setError(publicPlaybackError('generic'))
                setBuffering(false)
              }
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
        updateDebugStats({
          status: 'connecting',
          statusLabel: 'HLS nativo do Safari',
          connectionMode: 'Transmissao protegida nativa',
          currentLevel: 'nativo',
          lastHeartbeatAt: Date.now(),
        })
        video.src = proxyUrl
        video.load()
        video.play().catch(() => {})

      } else {
        setError(publicPlaybackError('unsupported'))
        setBuffering(false)
        updateDebugStats({
          status: 'error',
          statusLabel: 'Navegador sem suporte',
          lastError: publicPlaybackError('unsupported'),
        })
      }
    } catch (e: any) {
      const msg = 'Erro ao iniciar a transmissao'
      log(msg, 'error')
      setError(publicPlaybackError('generic'))
      setBuffering(false)
      updateDebugStats({
        status: 'error',
        statusLabel: 'Erro ao iniciar player',
        lastError: publicPlaybackError('generic'),
      })
    }
  }, [proxyUrl, log, destroyHls, updateDebugStats, publicPlaybackError, sanitizeDebugMessage])

  useEffect(() => {
    resumeAppliedRef.current = false
    if (contentType === 'LIVE') {
      setResumeAt(null)
      return
    }

    fetch(`/api/player/progress?channelUuid=${encodeURIComponent(channelUuid)}`)
      .then(r => (r.ok ? r.json() : { resumeAt: null }))
      .then(data => setResumeAt(typeof data.resumeAt === 'number' ? data.resumeAt : null))
      .catch(() => setResumeAt(null))
  }, [channelUuid, contentType])

  // ── Video element events ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onWaiting = () => {
      // Only show buffering if HLS.js isn't handling it after play started
      if (!bufferingStartedAtRef.current) bufferingStartedAtRef.current = Date.now()
      if (!hasPlayedRef.current) setBuffering(true)
      updateDebugStats({
        status: 'buffering',
        statusLabel: 'Buffering',
        lastHeartbeatAt: Date.now(),
      })
      log('Buffering...')
    }
    const onPlaying = () => {
      const bufferingElapsed = bufferingStartedAtRef.current ? Date.now() - bufferingStartedAtRef.current : 0
      bufferingStartedAtRef.current = null
      lastProgressAtRef.current = Date.now()
      setBuffering(false)
      setPlaying(true)
      hasPlayedRef.current = true
      setError(null) // Clear any lingering error once video actually plays
      updateDebugStats(current => ({
        ...current,
        totalBufferingMs: current.totalBufferingMs + bufferingElapsed,
        status: 'live',
        statusLabel: 'Reprodução estável',
        lastHeartbeatAt: Date.now(),
      }))
      log('▶ Reproduzindo', 'ok')
      sendPlayerEvent('player.playing', { attempt: attemptRef.current, contentType }, 15000)
      if (contentType === 'LIVE') {
        saveProgress(0, null)
      }
    }
    const onPause = () => {
      setPlaying(false)
      sendPlayerEvent('player.paused', { attempt: attemptRef.current, contentType }, 5000)
      if (contentType !== 'LIVE') {
        saveProgress(video.currentTime, Number.isFinite(video.duration) ? video.duration : null)
      }
    }
    const onTimeUpdate = () => {
      lastCurrentTimeRef.current = video.currentTime
      lastProgressAtRef.current = Date.now()

      if (contentType !== 'LIVE' && !resumeAppliedRef.current && resumeAt && video.currentTime < 2 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 5))
        resumeAppliedRef.current = true
      }

      if (contentType !== 'LIVE' && Date.now() - progressSentAtRef.current > 12000) {
        progressSentAtRef.current = Date.now()
        saveProgress(video.currentTime, Number.isFinite(video.duration) ? video.duration : null)
      }
    }
    const onStalled = () => {
      bufferingStartedAtRef.current = Date.now()
      updateDebugStats(current => ({
        ...current,
        stalls: current.stalls + 1,
        lastStallAt: Date.now(),
        status: 'unstable',
        statusLabel: 'Travamento detectado',
        lastHeartbeatAt: Date.now(),
      }))
      log('⚠ Stream travado', 'warn')
    }
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

      if (tearingDownRef.current || code === 1) {
        log(`Video error ignorado durante cleanup: ${label}`, 'warn')
        return
      }

      log(`❌ Erro de vídeo: ${label}`, 'error')
      setError(publicPlaybackError('media'))
      setBuffering(false)
      updateDebugStats({
        status: 'error',
        statusLabel: 'Erro de mídia',
        lastError: publicPlaybackError('media'),
        lastHeartbeatAt: Date.now(),
      })
      sendPlayerEvent('player.error', { attempt: attemptRef.current, code: label }, 3000)
    }
    const onEnded = () => {
      if (contentType !== 'LIVE') {
        saveProgress(Number.isFinite(video.duration) ? video.duration : video.currentTime, Number.isFinite(video.duration) ? video.duration : null)
      }
    }
    const onLoadedMetadata = () => {
      if (contentType !== 'LIVE' && !resumeAppliedRef.current && resumeAt && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 5))
        resumeAppliedRef.current = true
      }
    }

    video.addEventListener('waiting',  onWaiting)
    video.addEventListener('playing',  onPlaying)
    video.addEventListener('pause',    onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('ended', onEnded)
    video.addEventListener('stalled',  onStalled)
    video.addEventListener('error',    onError)

    initPlayer(1)

    return () => {
      video.removeEventListener('waiting',  onWaiting)
      video.removeEventListener('playing',  onPlaying)
      video.removeEventListener('pause',    onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('stalled',  onStalled)
      video.removeEventListener('error',    onError)
      if (contentType !== 'LIVE' && video.currentTime > 0) {
        saveProgress(video.currentTime, Number.isFinite(video.duration) ? video.duration : null)
      }
      destroyHls()
    }
  }, [initPlayer, destroyHls, log, sendPlayerEvent, publicPlaybackError, contentType, resumeAt, saveProgress])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const video = videoRef.current
      if (!video) return

      let bufferAhead = 0
      for (let i = 0; i < video.buffered.length; i += 1) {
        const start = video.buffered.start(i)
        const end = video.buffered.end(i)
        if (video.currentTime >= start && video.currentTime <= end) {
          bufferAhead = Math.max(0, end - video.currentTime)
          break
        }
      }

      const quality = typeof video.getVideoPlaybackQuality === 'function'
        ? video.getVideoPlaybackQuality()
        : null

      const hls = hlsRef.current as any
      const bandwidthEstimate = typeof hls?.bandwidthEstimate === 'number'
        ? Math.round(hls.bandwidthEstimate / 1000)
        : null
      const latency = typeof hls?.latency === 'number'
        ? Number(hls.latency.toFixed(1))
        : null
      const currentLevel = typeof hls?.currentLevel === 'number' && hls.currentLevel >= 0
        ? String(hls.currentLevel + 1)
        : debugStats.currentLevel

      if (!video.paused && video.currentTime > lastCurrentTimeRef.current + 0.05) {
        lastCurrentTimeRef.current = video.currentTime
        lastProgressAtRef.current = Date.now()
      }

      const stuckForMs = Date.now() - lastProgressAtRef.current
      if (!video.paused && !error && hls && stuckForMs > 12000 && bufferAhead < 1.2) {
        log('Watchdog: stream sem progresso, tentando recuperar sem reiniciar', 'warn')
        lastProgressAtRef.current = Date.now()
        setBuffering(true)
        try {
          hls.startLoad(-1)
          video.play().catch(() => {})
        } catch {}
      }

      let status: DebugStats['status'] = error ? 'error' : 'connecting'
      let statusLabel = 'Conectando'

      if (error) {
        status = 'error'
        statusLabel = 'Erro no stream'
      } else if (buffering) {
        status = 'buffering'
        statusLabel = 'Buffering ativo'
      } else if (playing && (bufferAhead < 1.5 || (debugStats.lastStallAt && Date.now() - debugStats.lastStallAt < 12000))) {
        status = 'unstable'
        statusLabel = bufferAhead < 1.5 ? 'Buffer baixo' : 'Recuperando travamento'
      } else if (playing) {
        status = 'live'
        statusLabel = bufferAhead >= 6 ? 'Conexão muito boa' : 'Conexão estável'
      }

      setDebugStats(current => ({
        ...current,
        status,
        statusLabel,
        currentLevel,
        bandwidthKbps: bandwidthEstimate,
        latency,
        bufferAhead: Number(bufferAhead.toFixed(1)),
        droppedFrames: quality ? quality.droppedVideoFrames : current.droppedFrames,
        decodedFrames: quality ? quality.totalVideoFrames : current.decodedFrames,
        readyState: video.readyState,
        networkState: video.networkState,
        lastHeartbeatAt: Date.now(),
      }))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [buffering, debugStats.currentLevel, debugStats.lastStallAt, error, playing, log])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setLightsOff(false)
      setDebugOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const body = document.body
    if (lightsOff) {
      body.dataset.lightsOff = 'true'
    } else {
      delete body.dataset.lightsOff
    }

    return () => {
      delete body.dataset.lightsOff
    }
  }, [lightsOff])

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

  const statusTone = {
    connecting: 'bg-sky-500/20 text-sky-200 ring-sky-400/30',
    live: 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30',
    unstable: 'bg-amber-500/20 text-amber-200 ring-amber-400/30',
    buffering: 'bg-orange-500/20 text-orange-200 ring-orange-400/30',
    error: 'bg-red-500/20 text-red-200 ring-red-400/30',
  }[debugStats.status]

  const formatMetric = (value: number | null, suffix = '') =>
    value === null || Number.isNaN(value) ? '—' : `${value}${suffix}`

  const renderDebugPanel = (compact = false) => (
    <div className={cn(
      'bg-black/70 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl text-white',
      compact ? 'p-3' : 'p-4 md:p-5',
    )}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1', statusTone)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {debugStats.statusLabel}
        </span>
        <span className="text-[11px] text-white/45">Tentativa #{attempt}</span>
        <span className="text-[11px] text-white/45">{debugStats.connectionMode}</span>
      </div>

      <div className={cn('mt-3 grid gap-2.5', compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Buffer</p>
          <p className="mt-1 text-sm font-semibold">{formatMetric(debugStats.bufferAhead, 's')}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Banda</p>
          <p className="mt-1 text-sm font-semibold">{formatMetric(debugStats.bandwidthKbps, ' kbps')}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Latência</p>
          <p className="mt-1 text-sm font-semibold">{formatMetric(debugStats.latency, 's')}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Qualidade</p>
          <p className="mt-1 text-sm font-semibold">{debugStats.currentLevel}</p>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Travadas</p>
            <p className="mt-1 text-sm font-semibold">{debugStats.stalls}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Recuperações</p>
            <p className="mt-1 text-sm font-semibold">{debugStats.recoveries}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Frames perdidos</p>
            <p className="mt-1 text-sm font-semibold">{formatMetric(debugStats.droppedFrames)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Segmentos OK</p>
            <p className="mt-1 text-sm font-semibold">{debugStats.fragmentsBuffered}</p>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Leitura do player</p>
          <p className="mt-1 text-xs text-white/70">
            readyState {debugStats.readyState} · networkState {debugStats.networkState} · buffering total {Math.round(debugStats.totalBufferingMs / 1000)}s
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Último alerta</p>
          <p className="mt-1 text-xs text-white/70 line-clamp-2">{debugStats.lastError || 'Nenhum erro recente'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-black/35 ring-1 ring-white/10 p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-0.5">
        <p className="text-white/35 mb-1">Eventos em tempo real</p>
        {logs.length > 0 ? logs.map((l, i) => (
          <p key={i} className={cn('leading-snug', levelColor(l.level))}>
            <span className="text-white/20">{l.ts}</span> {l.msg}
          </p>
        )) : (
          <p className="text-white/30">Aguardando eventos do stream...</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      {!fullscreen && (
        <button
          type="button"
          aria-label="Desligar luz desativado ao clicar fora"
          onClick={() => setLightsOff(false)}
          className={cn(
            'fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out',
            lightsOff ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
        />
      )}

      <div
        ref={containerRef}
        onMouseMove={resetHide}
        onMouseLeave={() => !debugOpen && setShowCtrl(false)}
        onClick={e => {
          if ((e.target as HTMLElement).closest('[data-no-toggle]')) return
          togglePlay()
        }}
        className={cn(
          'relative bg-black select-none overflow-hidden transition-[box-shadow,transform] duration-300 ease-out',
          fullscreen ? 'fixed inset-0 z-50' : 'w-full aspect-video rounded-2xl',
          lightsOff && !fullscreen && 'z-[60] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_40px_120px_rgba(0,0,0,0.75)]',
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
              onClick={() => {
                sendPlayerEvent('player.retry', { fromAttempt: attempt, nextAttempt: attempt + 1 }, 0)
                setError(null)
                initPlayer(attempt + 1)
              }}
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
            <div className="w-full max-w-2xl">
              {renderDebugPanel()}
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
          {onToggleLayout && (
            <button
              onClick={onToggleLayout}
              className={cn(
                'h-8 rounded-full px-3 flex items-center gap-2 transition-colors text-[11px] font-medium',
                layoutExpanded ? 'bg-sky-500/20 text-sky-100' : 'bg-black/20 text-white/55 hover:text-white hover:bg-black/40',
              )}
              title={layoutExpanded ? 'Voltar layout lateral' : 'Jogar relacionados para baixo'}
            >
              {layoutExpanded ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelBottomClose className="w-3.5 h-3.5" />}
              {layoutExpanded ? 'Layout lateral' : 'Centralizar'}
            </button>
          )}
          <button
            onClick={() => setLightsOff(v => !v)}
            className={cn(
              'h-8 rounded-full px-3 flex items-center gap-2 transition-colors text-[11px] font-medium',
              lightsOff ? 'bg-amber-500/20 text-amber-200' : 'bg-black/20 text-white/55 hover:text-white hover:bg-black/40',
            )}
          >
            {lightsOff ? <LightbulbOff className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
            {lightsOff ? 'Luzes apagadas' : 'Desligar luz'}
          </button>
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
          {debugOpen && (
            <div className="mb-3">
              {renderDebugPanel(true)}
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
            <button
              onClick={() => setLightsOff(v => !v)}
              className={cn(
                'text-white/70 hover:text-white transition-colors text-[11px] uppercase tracking-[0.18em]',
                lightsOff && 'text-amber-200',
              )}
            >
              {lightsOff ? 'Luz On' : 'Luz Off'}
            </button>
            <button onClick={toggleFS} className="text-white/70 hover:text-white transition-colors">
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
