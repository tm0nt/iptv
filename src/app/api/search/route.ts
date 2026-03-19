import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  })

  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ results: [], series: [] })

  // Search channels (live + movies)
  const channels = await prisma.channel.findMany({
    where: {
      active: true,
      contentType: { in: ['LIVE', 'MOVIE'] },
      OR: [
        { name:    { contains: q, mode: 'insensitive' } },
        { tvgName: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: { category: { select: { name: true } } },
    orderBy: [{ isFeatured: 'desc' }, { viewCount: 'desc' }],
    take: 16,
  })

  // Search series
  const series = await prisma.series.findMany({
    where: {
      active: true,
      OR: [
        { title:    { contains: q, mode: 'insensitive' } },
        { provider: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: {
      _count: { select: { seasons: true } },
      seasons: {
        select: { _count: { select: { episodes: true } } },
      },
    },
    orderBy: { title: 'asc' },
    take: 8,
  })

  const seriesResults = series.map(s => ({
    id:          s.id,
    title:       s.title,
    slug:        s.slug,
    posterUrl:   s.posterUrl,
    provider:    s.provider,
    seasonCount: s._count.seasons,
    episodeCount: s.seasons.reduce((acc, sea) => acc + sea._count.episodes, 0),
  }))

  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'catalog.search.performed',
    entityType: 'CATALOG',
    message: `Busca realizada por "${q}"`,
    actor: session.user,
    ...ctx,
    metadata: {
      query: q,
      channelResults: channels.length,
      seriesResults: seriesResults.length,
      hasSubscription: !!sub,
    },
  })

  return NextResponse.json({
    results: channels.map(ch => ({
      uuid:       ch.uuid,
      name:       ch.name,
      logoUrl:    ch.logoUrl,
      isFeatured: ch.isFeatured,
      viewCount:  ch.viewCount,
      contentType: ch.contentType,
      category:   ch.category || { name: ch.groupTitle || 'Geral' },
    })),
    series:          seriesResults,
    hasSubscription: !!sub,
  })
}
