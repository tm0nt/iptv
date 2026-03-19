import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import {
  authorizePlaybackAccess,
  getProfileCookieName,
  getViewerKeyFromRequest,
  resolveActiveProfile,
} from '@/lib/account-playback'

const UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 Chrome/120'
const SYNTHETIC_SEGMENT_SECONDS = 8

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const userId = session.user.id
  const { ipAddress, userAgent } = getAuditRequestContext(req)
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    include: { plan: { select: { maxDevices: true } } },
  })
  if (!sub) {
    return NextResponse.json({
      error: 'Assinatura inativa',
    }, { status: 403 })
  }

  const channel = await prisma.channel.findUnique({
    where: { uuid: params.id, active: true },
  })
  if (!channel) {
    return NextResponse.json({
      error: 'Canal não encontrado',
    }, { status: 404 })
  }

  const requestedProfileId = req.cookies.get(getProfileCookieName())?.value || null
  const { activeProfile } = await resolveActiveProfile(userId, requestedProfileId, sub.plan?.maxDevices || 1)
  const viewerKey = getViewerKeyFromRequest(req)
  if (!activeProfile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 400 })
  }

  const access = await authorizePlaybackAccess({
    userId,
    subscriptionId: sub.id,
    maxDevices: sub.plan?.maxDevices || 1,
    viewerKey,
    profileId: activeProfile.id,
    channelUuid: channel.uuid,
    channelName: channel.name,
    contentType: channel.contentType,
    event: 'stream.watch.started',
  })

  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: 409 })
  }

  prisma.channel.update({
    where: { id: channel.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {})

  logAuditEvent({
    action: 'stream.watch.started',
    entityType: 'CHANNEL',
    entityId: channel.uuid,
    message: `Usuario iniciou reproducao do canal ${channel.name}`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: {
      channelName: channel.name,
      contentType: channel.contentType,
      subscriptionId: sub.id,
    },
  }).catch(() => {})

  const rawUrl = channel.streamUrl
  console.log(`[Stream] Iniciando proxy protegido para ${channel.name}`)

  // ── 1. Try HLS: append .m3u8 to the stream URL ───────────────────────────
  // Xtream-compatible servers expose HLS at the same URL with .m3u8
  const hlsUrl = rawUrl.endsWith('.m3u8') ? rawUrl : `${rawUrl}.m3u8`

  try {
    const hlsRes = await fetchTimeout(hlsUrl, 8000)
    if (hlsRes.ok) {
      const body = await hlsRes.text()
      if (body.trim().startsWith('#EXTM3U')) {
        console.log(`[Stream] ✅ HLS via .m3u8 — ${channel.name}`)
        return new NextResponse(rewriteM3U8(body, hlsUrl), {
          headers: hlsHeaders('hls'),
        })
      }
    }
  } catch {
    // Fall through to next strategy
  }

  // ── 2. Try raw URL as-is ─────────────────────────────────────────────────
  try {
    const rawRes = await fetchTimeout(rawUrl, 12000)

    if (!rawRes.ok) {
      return NextResponse.json({
        error: 'Transmissão temporariamente indisponível',
      }, { status: 502 })
    }

    const ct = rawRes.headers.get('content-type') || ''
    if (ct.includes('mpegurl') || ct.includes('x-mpegurl')) {
      const body = await rawRes.text()
      console.log(`[Stream] ✅ HLS raw — ${channel.name}`)
      return new NextResponse(rewriteM3U8(body, rawUrl), {
        headers: hlsHeaders('hls'),
      })
    }

    // ── 3. MPEG-TS stream → wrap in synthetic HLS ─────────────────────────
    // Browsers can't play video/mp2t via <video src>.
    // We create a live M3U8 playlist pointing to /api/ts/[encoded].
    // HLS.js fetches this M3U8, then requests the TS segment,
    // receiving raw MPEG-TS bytes which it demuxes via MSE. ✅
    console.log(`[Stream] ⚙ Synthetic HLS wrapper — ${channel.name} (${ct.split(';')[0] || 'raw'})`)

    const encoded = Buffer.from(rawUrl).toString('base64url')
    return new NextResponse(buildLiveM3U8(encoded), {
      headers: hlsHeaders('synthetic-hls'),
    })

  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError'
    return NextResponse.json({
      error: isTimeout ? 'Transmissão demorou para responder' : 'Erro ao preparar a transmissão',
    }, { status: 504 })
  }
}

// ── HEAD request — used by the player probe ───────────────────────────────
export async function HEAD(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Reuse GET but return only headers
  const res = await GET(req, { params })
  return new NextResponse(null, { status: res.status, headers: res.headers })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTimeout(url: string, ms: number) {
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      UA,
        Accept:            'application/x-mpegURL, video/mp2t, */*',
        'Accept-Encoding': 'identity',
      },
      redirect: 'follow',
    })
  } finally {
    clearTimeout(tid)
  }
}

function rewriteM3U8(content: string, baseUrl: string): string {
  const base = new URL(baseUrl)
  return content.split('\n').map(line => {
    const t = line.trim()
    if (t === '' || t.startsWith('#')) return line
    const full = t.startsWith('http') ? t : new URL(t, base.href).href
    return `/api/segment/${Buffer.from(full).toString('base64url')}`
  }).join('\n')
}

function buildLiveM3U8(encoded: string): string {
  // Sequence number changes every 8s so each synthetic segment stays short and recoverable.
  const seq = Math.floor(Date.now() / (SYNTHETIC_SEGMENT_SECONDS * 1000))
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${SYNTHETIC_SEGMENT_SECONDS}`,
    `#EXT-X-MEDIA-SEQUENCE:${seq}`,
    '#EXT-X-DISCONTINUITY-SEQUENCE:0',
    // No codec hints here — HLS.js will detect from the TS stream itself
    `#EXTINF:${SYNTHETIC_SEGMENT_SECONDS.toFixed(1)},live`,
    `/api/ts/${encoded}?seq=${seq}`,
    // No EXT-X-ENDLIST = live mode; HLS.js keeps polling every ~targetduration
  ].join('\n')
}

function hlsHeaders(type: string): Record<string, string> {
  return {
    'Content-Type':               'application/vnd.apple.mpegurl',
    'Cache-Control':              'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin':'*',
    'X-Stream-Type':              type,
  }
}
