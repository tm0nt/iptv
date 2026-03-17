import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 Chrome/120'

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
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  })
  if (!sub) {
    return NextResponse.json({
      error: 'Assinatura inativa',
      debug: `userId=${userId} — sem assinatura ATIVA`,
    }, { status: 403 })
  }

  const channel = await prisma.channel.findUnique({
    where: { uuid: params.id, active: true },
  })
  if (!channel) {
    return NextResponse.json({
      error: 'Canal não encontrado',
      debug: `uuid=${params.id}`,
    }, { status: 404 })
  }

  prisma.channel.update({
    where: { id: channel.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {})

  const rawUrl = channel.streamUrl
  console.log(`[Stream] ${channel.name} → ${rawUrl.slice(0, 70)}`)

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
        error: `Upstream indisponível (HTTP ${rawRes.status})`,
        debug: `Canal "${channel.name}"`,
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
      error: isTimeout ? 'Timeout (15s)' : 'Erro no proxy',
      debug: isTimeout
        ? `Canal "${channel.name}" não respondeu em 15s`
        : `${err?.message || err}`,
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
  // Sequence number changes every 8s → HLS.js re-polls and extends the live window
  const seq = Math.floor(Date.now() / 8000)
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:10',
    `#EXT-X-MEDIA-SEQUENCE:${seq}`,
    '#EXT-X-DISCONTINUITY-SEQUENCE:0',
    // No codec hints here — HLS.js will detect from the TS stream itself
    '#EXTINF:10.0,live',
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
