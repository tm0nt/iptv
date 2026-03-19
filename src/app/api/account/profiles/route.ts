import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  canCreateMoreProfiles,
  createAccountProfile,
  deleteAccountProfile,
  ensurePlaybackTables,
  getActiveSubscription,
  getProfileCookieName,
  getUserPlaybackOverview,
  getViewerKeyFromRequest,
  renameAccountProfile,
  resolveActiveProfile,
} from '@/lib/account-playback'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

function getMaxProfiles(maxDevices?: number | null) {
  return Math.max(1, maxDevices || 1)
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensurePlaybackTables()
  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getMaxProfiles(activeSubscription?.plan.maxDevices)
  const cookieProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const { profiles, activeProfile } = await resolveActiveProfile(session.user.id, cookieProfileId, maxProfiles)
  const viewerKey = getViewerKeyFromRequest(request)
  const playbackOverview = await getUserPlaybackOverview(session.user.id, viewerKey)
  const playbackMap = new Map(playbackOverview.profiles.map(profile => [profile.id, profile]))

  const response = NextResponse.json({
    profiles: profiles.map(profile => ({
      ...profile,
      status: playbackMap.get(profile.id)?.status || 'FREE',
      statusLabel: playbackMap.get(profile.id)?.statusLabel || 'Livre agora',
      activeSessionCount: playbackMap.get(profile.id)?.activeSessionCount || 0,
    })),
    activeProfileId: activeProfile?.id || null,
    maxProfiles,
    canCreateMore: profiles.length < maxProfiles,
    activeSessionsCount: playbackOverview.activeSessionsCount,
  })

  if (activeProfile?.id && activeProfile.id !== cookieProfileId) {
    response.cookies.set(getProfileCookieName(), activeProfile.id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  }

  return response
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const avatarColor = typeof body.avatarColor === 'string' ? body.avatarColor.trim() : null
  if (!name) return NextResponse.json({ error: 'Informe o nome do perfil.' }, { status: 400 })

  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getMaxProfiles(activeSubscription?.plan.maxDevices)
  if (!(await canCreateMoreProfiles(session.user.id, maxProfiles))) {
    return NextResponse.json({ error: 'Seu plano atual já atingiu o limite de perfis.' }, { status: 400 })
  }

  const profileId = await createAccountProfile(session.user.id, name, maxProfiles, avatarColor)
  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'account.profile.created',
    entityType: 'ACCOUNT_PROFILE',
    entityId: profileId,
    message: `Perfil criado: ${name}`,
    actor: session.user,
    ...ctx,
    metadata: { maxProfiles, avatarColor },
  })

  return GET(new NextRequest(request.url, { headers: request.headers }))
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '')
  const profileId = String(body.profileId || '').trim()

  if (!profileId) {
    return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
  }

  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getMaxProfiles(activeSubscription?.plan.maxDevices)
  const { profiles } = await resolveActiveProfile(session.user.id, profileId, maxProfiles)
  const target = profiles.find(profile => profile.id === profileId)

  if (!target) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
  }

  const ctx = getAuditRequestContext(request)

  if (action === 'rename') {
    const name = String(body.name || '').trim()
    const avatarColor = typeof body.avatarColor === 'string' ? body.avatarColor.trim() : null
    if (!name) return NextResponse.json({ error: 'Informe um nome para o perfil.' }, { status: 400 })
    await renameAccountProfile(session.user.id, profileId, name, avatarColor)
    await logAuditEvent({
      action: 'account.profile.renamed',
      entityType: 'ACCOUNT_PROFILE',
      entityId: profileId,
      message: `Perfil renomeado para ${name}`,
      actor: session.user,
      ...ctx,
      metadata: { avatarColor },
    })
  }

  const response = await GET(new NextRequest(request.url, { headers: request.headers }))
  response.cookies.set(getProfileCookieName(), profileId, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })

  await logAuditEvent({
    action: action === 'rename' ? 'account.profile.selected' : 'account.profile.selected',
    entityType: 'ACCOUNT_PROFILE',
    entityId: profileId,
    message: `Perfil ativo selecionado: ${target.name}`,
    actor: session.user,
    ...ctx,
  })

  return response
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profileId = request.nextUrl.searchParams.get('profileId')?.trim()
  if (!profileId) return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })

  await deleteAccountProfile(session.user.id, profileId)
  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'account.profile.deleted',
    entityType: 'ACCOUNT_PROFILE',
    entityId: profileId,
    message: 'Perfil removido da conta',
    actor: session.user,
    ...ctx,
  })

  const response = await GET(new NextRequest(request.url, { headers: request.headers }))
  return response
}
