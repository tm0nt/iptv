import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  authorizePlaybackAccess,
  getProfileCookieName,
  getViewerKeyFromRequest,
  resolveActiveProfile,
} from '@/lib/account-playback'
import { ensurePlanSchema, getPlanFlags } from '@/lib/plan-schema'
import { getPlanDeviceLimit } from '@/lib/plan-utils'

const SYNTHETIC_SEGMENT_MS = 8500

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  await ensurePlanSchema()
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    include: { plan: { select: { id: true, maxDevices: true } } },
  })
  if (!sub) return new NextResponse('Forbidden', { status: 403 })

  const requestedProfileId = req.cookies.get(getProfileCookieName())?.value || null
  const maxDevices = getPlanDeviceLimit({ ...sub.plan, ...(await getPlanFlags(sub.plan.id)) })
  const { activeProfile } = await resolveActiveProfile(userId, requestedProfileId, maxDevices)
  const viewerKey = getViewerKeyFromRequest(req)
  if (!activeProfile) return new NextResponse('Perfil não encontrado', { status: 400 })

  const access = await authorizePlaybackAccess({
    userId,
    subscriptionId: sub.id,
    maxDevices,
    viewerKey,
    profileId: activeProfile.id,
    event: 'ts.access',
  })

  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: 409 })
  }

  // Decode URL
  let realUrl: string
  try {
    realUrl = Buffer.from(params.encoded, 'base64url').toString('utf-8')
    const u = new URL(realUrl)
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  console.log('[TS] Iniciando segmento protegido')

  try {
    const ctrl = new AbortController()
    const stopAt = Date.now() + SYNTHETIC_SEGMENT_MS

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

    if (!upstream.ok) {
      return new NextResponse('Transmissao indisponivel', { status: 502 })
    }

    if (!upstream.body) {
      return new NextResponse('Stream body unavailable', { status: 502 })
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()

        try {
          while (Date.now() < stopAt) {
            const remainingMs = stopAt - Date.now()
            if (remainingMs <= 0) break

            let timeoutId: NodeJS.Timeout | null = null
            const timeoutPromise = new Promise<'timeout'>(resolve => {
              timeoutId = setTimeout(() => resolve('timeout'), remainingMs)
            })

            const readResult = await Promise.race([reader.read(), timeoutPromise]).finally(() => {
              if (timeoutId) clearTimeout(timeoutId)
            })

            if (readResult === 'timeout') {
              ctrl.abort()
              break
            }

            if (readResult.done) break
            if (readResult.value?.byteLength) {
              controller.enqueue(readResult.value)
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.error('[TS] Reader error:', err?.message || err)
          }
        } finally {
          try { reader.releaseLock() } catch {}
          try { ctrl.abort() } catch {}
          controller.close()
        }
      },
      cancel() {
        ctrl.abort()
      },
    })

    const h = new Headers()
    h.set('Content-Type', 'video/mp2t')          // HLS.js expects this for TS segments
    h.set('Cache-Control', 'no-cache, no-store')
    h.set('Access-Control-Allow-Origin', '*')
    return new NextResponse(stream, { status: 200, headers: h })

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Normal synthetic segment end — HLS.js will request the next one.
      return new NextResponse('', { status: 200 })
    }
    console.error('[TS] Error:', err.message)
    return new NextResponse('Stream error', { status: 502 })
  }
}
