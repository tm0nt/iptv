import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/channels
 *
 * PAGINATED category loading for progressive rendering.
 *
 * Query params:
 *   page   - category page (0-indexed), default 0
 *   limit  - categories per page, default 4
 *   type   - content type filter: 'live' | 'movie' | 'series' | 'all' (default 'live')
 *   cat    - specific category slug filter
 *
 * Returns { categories, page, hasMore, totalCategories }
 */
export async function GET(request: NextRequest) {
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

  const url   = new URL(request.url)
  const page  = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10))
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '4', 10)))
  const type  = url.searchParams.get('type') || 'live'
  const cat   = url.searchParams.get('cat') || undefined

  // Build content type filter for channels
  const contentTypeFilter = type === 'all'
    ? undefined
    : type === 'movie'
      ? 'MOVIE' as const
      : type === 'series'
        ? 'SERIES' as const
        : 'LIVE' as const

  // Count total active categories that have channels
  const categoryWhere = {
    active: true,
    ...(cat ? { slug: cat } : {}),
    channels: {
      some: {
        active: true,
        ...(contentTypeFilter ? { contentType: contentTypeFilter } : {}),
      },
    },
  }

  const totalCategories = await prisma.category.count({ where: categoryWhere })

  // Fetch paginated categories with their channels
  const categories = await prisma.category.findMany({
    where: categoryWhere,
    orderBy: { order: 'asc' },
    skip: page * limit,
    take: limit,
    include: {
      channels: {
        where: {
          active: true,
          ...(contentTypeFilter ? { contentType: contentTypeFilter } : {}),
        },
        orderBy: [
          { isFeatured: 'desc' },
          { viewCount: 'desc' },
          { order: 'asc' },
        ],
        select: {
          uuid: true,
          name: true,
          tvgName: true,
          logoUrl: true,
          isFeatured: true,
          viewCount: true,
          contentType: true,
        },
        take: 60, // max per category per page — client can request more
      },
    },
  })

  // Filter out categories that ended up empty after filtering
  const nonEmpty = categories.filter(c => c.channels.length > 0)

  const hasMore = (page + 1) * limit < totalCategories

  return NextResponse.json({
    categories: nonEmpty,
    page,
    hasMore,
    totalCategories,
  })
}
