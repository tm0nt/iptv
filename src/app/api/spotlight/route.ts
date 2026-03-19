import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPublicSystemConfig } from '@/lib/system-config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  })

  if (!sub) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 403 })
  }

  const branding = await getPublicSystemConfig()

  const select = {
    uuid: true,
    name: true,
    tvgName: true,
    logoUrl: true,
    isFeatured: true,
    viewCount: true,
    contentType: true,
    category: { select: { name: true } },
  } as const

  const selectedChannel = branding.featuredChannelUuid
    ? await prisma.channel.findFirst({
        where: {
          uuid: branding.featuredChannelUuid,
          active: true,
          contentType: 'LIVE',
        },
        select,
      })
    : null

  const fallbackChannel = selectedChannel
    ? null
    : await prisma.channel.findFirst({
        where: { active: true, isFeatured: true, contentType: 'LIVE' },
        orderBy: [{ viewCount: 'desc' }, { order: 'asc' }],
        select,
      })

  const channel = selectedChannel || fallbackChannel

  if (!channel) {
    return NextResponse.json({ spotlight: null })
  }

  return NextResponse.json({
    spotlight: {
      channel,
      category: channel.category?.name || 'Destaque',
      bannerUrl: branding.featuredBannerUrl || null,
    },
  })
}
