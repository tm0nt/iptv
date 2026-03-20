import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ensurePlaybackTables,
  getActiveSubscription,
  getProfileCookieName,
  getResumeProgress,
  resolveActiveProfile,
  saveWatchProgress,
} from '@/lib/account-playback'
import { getPlanDeviceLimit } from '@/lib/plan-utils'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelUuid = request.nextUrl.searchParams.get('channelUuid')?.trim()
  if (!channelUuid) return NextResponse.json({ resumeAt: null })

  await ensurePlaybackTables()
  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getPlanDeviceLimit(activeSubscription?.plan)
  const requestedProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const { activeProfile } = await resolveActiveProfile(session.user.id, requestedProfileId, maxProfiles)

  if (!activeProfile) return NextResponse.json({ resumeAt: null })

  const resumeAt = await getResumeProgress(session.user.id, activeProfile.id, channelUuid)
  return NextResponse.json({ resumeAt, profileId: activeProfile.id })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as
    | {
        channelUuid?: string
        contentType?: 'LIVE' | 'MOVIE' | 'SERIES'
        progressSeconds?: number
        durationSeconds?: number | null
      }
    | null

  if (!body?.channelUuid || !body?.contentType) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  await ensurePlaybackTables()
  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getPlanDeviceLimit(activeSubscription?.plan)
  const requestedProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const { activeProfile } = await resolveActiveProfile(session.user.id, requestedProfileId, maxProfiles)

  if (!activeProfile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })
  }

  const channel = await prisma.channel.findUnique({
    where: { uuid: body.channelUuid },
    select: { uuid: true, contentType: true },
  })

  if (!channel) return NextResponse.json({ error: 'Conteúdo não encontrado.' }, { status: 404 })

  await saveWatchProgress({
    userId: session.user.id,
    profileId: activeProfile.id,
    channelUuid: channel.uuid,
    contentType: channel.contentType as 'LIVE' | 'MOVIE' | 'SERIES',
    progressSeconds: Number(body.progressSeconds || 0),
    durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : null,
  })

  return NextResponse.json({ ok: true })
}
