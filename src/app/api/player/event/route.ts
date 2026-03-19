import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import {
  authorizePlaybackAccess,
  getActiveSubscription,
  getProfileCookieName,
  getViewerKeyFromRequest,
  releasePlaybackSession,
  resolveActiveProfile,
} from '@/lib/account-playback'

const ALLOWED_EVENTS = new Set([
  'player.playing',
  'player.paused',
  'player.error',
  'player.retry',
])

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as
    | {
        action?: string
        channelUuid?: string
        channelName?: string
        metadata?: Record<string, unknown>
      }
    | null

  if (!body?.action || !ALLOWED_EVENTS.has(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const ctx = getAuditRequestContext(request)
  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = Math.max(1, activeSubscription?.plan.maxDevices || 1)
  const requestedProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const { activeProfile } = await resolveActiveProfile(session.user.id, requestedProfileId, maxProfiles)
  const viewerKey = getViewerKeyFromRequest(request)

  if (body.action === 'player.playing' && activeSubscription && activeProfile) {
    const access = await authorizePlaybackAccess({
      userId: session.user.id,
      subscriptionId: activeSubscription.id,
      maxDevices: activeSubscription.plan.maxDevices,
      viewerKey,
      profileId: activeProfile.id,
      channelUuid: body.channelUuid || null,
      channelName: body.channelName || null,
      contentType: typeof body.metadata?.contentType === 'string' ? body.metadata.contentType : null,
      event: body.action,
    })

    if (!access.ok) {
      return NextResponse.json({ error: access.message, code: access.code }, { status: 409 })
    }
  }

  if (body.action === 'player.paused' && activeProfile) {
    await releasePlaybackSession(session.user.id, activeProfile.id, viewerKey)
  }

  await logAuditEvent({
    action: body.action,
    entityType: 'PLAYER',
    entityId: body.channelUuid || null,
    message: `Evento do player: ${body.action}${body.channelName ? ` (${body.channelName})` : ''}`,
    actor: session.user,
    ...ctx,
    metadata: {
      channelUuid: body.channelUuid || null,
      channelName: body.channelName || null,
      ...(body.metadata || {}),
    },
  })

  return NextResponse.json({ ok: true })
}
