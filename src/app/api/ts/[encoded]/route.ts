import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// /api/ts/[encoded]
// Streams raw MPEG-TS bytes from the upstream IPTV server.
// HLS.js requests this as a "segment" from the synthetic M3U8 playlist.
// It receives the raw TS bytes and demuxes them via MSE — no browser codec needed.

export async function GET(
  req: NextRequest,
  { params }: { params: { encoded: string } }
) {
  // Auth
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const userId = session.user.id
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  })
  if (!sub) return new NextResponse('Forbidden', { status: 403 })

  // Decode URL
  let realUrl: string
  try {
    realUrl = Buffer.from(params.encoded, 'base64url').toString('utf-8')
    const u = new URL(realUrl)
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  console.log(`[TS] → ${realUrl.slice(0, 70)}`)

  try {
    const ctrl = new AbortController()
    // 60s timeout — live streams can be indefinitely long; client reconnects via HLS.js re-poll
    const tid = setTimeout(() => ctrl.abort(), 60000)

    const upstream = await fetch(realUrl, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120',
        Accept:            'video/mp2t, */*',
        'Accept-Encoding': 'identity',
        Connection:        'keep-alive',
      },
      redirect: 'follow',
    })

    clearTimeout(tid)

    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 })
    }

    const h = new Headers()
    h.set('Content-Type', 'video/mp2t')          // HLS.js expects this for TS segments
    h.set('Cache-Control', 'no-cache, no-store')
    h.set('Access-Control-Allow-Origin', '*')
    // Streaming response — no Content-Length
    return new NextResponse(upstream.body, { status: 200, headers: h })

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Normal live stream end — HLS.js will re-request
      return new NextResponse('', { status: 200 })
    }
    console.error('[TS] Error:', err.message)
    return new NextResponse('Stream error', { status: 502 })
  }
}
