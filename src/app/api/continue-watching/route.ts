import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  ensurePlaybackTables,
  getActiveSubscription,
  getContinueWatching,
  getProfileCookieName,
  resolveActiveProfile,
} from '@/lib/account-playback'
import { getPlanDeviceLimit } from '@/lib/plan-utils'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensurePlaybackTables()
  const activeSubscription = await getActiveSubscription(session.user.id)
  const maxProfiles = getPlanDeviceLimit(activeSubscription?.plan)
  const requestedProfileId = request.cookies.get(getProfileCookieName())?.value || null
  const { activeProfile } = await resolveActiveProfile(session.user.id, requestedProfileId, maxProfiles)

  if (!activeProfile) return NextResponse.json({ items: [] })

  const items = await getContinueWatching(session.user.id, activeProfile.id)
  return NextResponse.json({ items, activeProfileId: activeProfile.id })
}
