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

export async function GET(
  request: NextRequest,
  { params }: { params: { encoded: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  await ensurePlanSchema()
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    include: { plan: { select: { id: true, maxDevices: true } } },
  })

  if (!subscription) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 403 })
  }

  const requestedProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const maxDevices = getPlanDeviceLimit({ ...subscription.plan, ...(await getPlanFlags(subscription.plan.id)) })
  const { activeProfile } = await resolveActiveProfile(userId, requestedProfileId, maxDevices)
  const viewerKey = getViewerKeyFromRequest(request)
  if (!activeProfile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 400 })
  }

  const access = await authorizePlaybackAccess({
    userId,
    subscriptionId: subscription.id,
    maxDevices,
    viewerKey,
    profileId: activeProfile.id,
    event: 'segment.access',
  })

  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: 409 })
  }

  try {
    const realUrl = Buffer.from(params.encoded, 'base64url').toString('utf-8')

    // Validate it's a proper URL (prevent SSRF to internal network)
    const parsed = new URL(realUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const upstream = await fetch(realUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamProxy/1.0)',
        Range: request.headers.get('range') || '',
      },
    })

    const responseHeaders = new Headers()
    responseHeaders.set(
      'Content-Type',
      upstream.headers.get('content-type') || 'video/mp2t'
    )
    responseHeaders.set('Cache-Control', 'public, max-age=30')
    responseHeaders.set('Access-Control-Allow-Origin', '*')

    const cl = upstream.headers.get('content-length')
    if (cl) responseHeaders.set('Content-Length', cl)

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json({ error: 'Segment unavailable' }, { status: 502 })
  }
}
