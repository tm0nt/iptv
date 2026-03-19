import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

/**
 * GET /api/series
 *
 * Query params:
 *   page     - 0-indexed page, default 0
 *   limit    - items per page, default 24
 *   provider - filter by provider (Netflix, HBO, etc.)
 *   q        - search query
 *   id       - get single series detail with seasons + episodes
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url      = new URL(request.url)
  const id       = url.searchParams.get('id')
  const page     = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10))
  const limit    = Math.min(48, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)))
  const provider = url.searchParams.get('provider') || undefined
  const q        = url.searchParams.get('q')?.trim() || undefined
  const ctx = getAuditRequestContext(request)

  // ── Single series detail ──────────────────────────────────────────────────
  if (id) {
    const series = await prisma.series.findUnique({
      where: { id, active: true },
      include: {
        seasons: {
          orderBy: { seasonNumber: 'asc' },
          include: {
            episodes: {
              orderBy: { episodeNumber: 'asc' },
              include: {
                channels: {
                  where: { active: true },
                  select: { uuid: true, name: true, logoUrl: true },
                  take: 1, // Just need one stream per episode
                },
              },
            },
          },
        },
      },
    })

    if (!series) {
      return NextResponse.json({ error: 'Série não encontrada' }, { status: 404 })
    }

    // Transform to clean response
    const detail = {
      id:          series.id,
      title:       series.title,
      slug:        series.slug,
      posterUrl:   series.posterUrl,
      backdropUrl: series.backdropUrl,
      description: series.description,
      provider:    series.provider,
      genre:       series.genre,
      year:        series.year,
      seasons: series.seasons.map(s => ({
        id:           s.id,
        seasonNumber: s.seasonNumber,
        title:        s.title,
        posterUrl:    s.posterUrl,
        episodes: s.episodes
          .filter(e => e.channels.length > 0) // only episodes with working streams
          .map(e => ({
            id:            e.id,
            episodeNumber: e.episodeNumber,
            title:         e.title,
            logoUrl:       e.logoUrl || e.channels[0]?.logoUrl,
            channelUuid:   e.channels[0]?.uuid,
          })),
      })).filter(s => s.episodes.length > 0), // only seasons with episodes
    }

    await logAuditEvent({
      action: 'series.detail.viewed',
      entityType: 'SERIES',
      entityId: series.id,
      message: `Detalhe da serie aberto: ${series.title}`,
      actor: session.user,
      ...ctx,
      metadata: {
        provider: series.provider,
        seasons: detail.seasons.length,
      },
    })

    return NextResponse.json({ series: detail })
  }

  // ── Paginated series list ─────────────────────────────────────────────────
  const where = {
    active: true,
    ...(provider ? { provider: { equals: provider, mode: 'insensitive' as const } } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { provider: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [total, series] = await Promise.all([
    prisma.series.count({ where }),
    prisma.series.findMany({
      where,
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      skip: page * limit,
      take: limit,
      include: {
        _count: {
          select: { seasons: true },
        },
        seasons: {
          select: {
            _count: { select: { episodes: true } },
          },
        },
      },
    }),
  ])

  const items = series.map(s => ({
    id:           s.id,
    title:        s.title,
    slug:         s.slug,
    posterUrl:    s.posterUrl,
    provider:     s.provider,
    genre:        s.genre,
    year:         s.year,
    seasonCount:  s._count.seasons,
    episodeCount: s.seasons.reduce((acc, sea) => acc + sea._count.episodes, 0),
  }))

  // Get available providers for filter UI
  const providers = await prisma.series.findMany({
    where: { active: true },
    select: { provider: true },
    distinct: ['provider'],
  })

  if (page === 0 || provider || q) {
    await logAuditEvent({
      action: 'series.list.viewed',
      entityType: 'SERIES',
      message: 'Lista de series consultada',
      actor: session.user,
      ...ctx,
      metadata: {
        page,
        limit,
        provider: provider || null,
        query: q || null,
        total,
        returned: items.length,
      },
    })
  }

  return NextResponse.json({
    data:      items,
    total,
    page,
    limit,
    hasMore:   (page + 1) * limit < total,
    providers: providers.map(p => p.provider).filter(Boolean).sort(),
  })
}
