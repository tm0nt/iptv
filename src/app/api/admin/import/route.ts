import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { parseM3U, extractSeriesInfo, slugify } from '@/lib/m3u-parser'
import type { ParsedChannel } from '@/lib/m3u-parser'

const MAX_SIZE_PER_FILE = 200 * 1024 * 1024

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const qurl    = new URL(request.url)
  const mode    = qurl.searchParams.get('mode')    || 'merge'
  const preview = qurl.searchParams.get('preview') === '1'
  const ct      = request.headers.get('content-type') || ''

  const contents: { name: string; content: string }[] = []

  if (ct.includes('multipart/form-data')) {
    const form  = await request.formData()
    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    for (const f of files) {
      if (f.size > MAX_SIZE_PER_FILE) return NextResponse.json({ error: `"${f.name}" excede 200MB` }, { status: 400 })
      const text = await f.text()
      if (!text.includes('#EXTINF')) continue
      contents.push({ name: f.name, content: text })
    }
    if (!contents.length) return NextResponse.json({ error: 'Nenhum M3U válido encontrado' }, { status: 400 })

  } else if (ct.includes('application/json')) {
    const body = await request.json() as Record<string, unknown>
    const urls: string[] = Array.isArray(body.urls) ? body.urls as string[] : body.url ? [body.url as string] : []

    for (const u of urls) {
      try {
        const res = await fetch(u, { headers: { 'User-Agent': 'StreamBox-Importer/1.0' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        contents.push({ name: u, content: await res.text() })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: `Falha ao baixar "${u}": ${msg}` }, { status: 400 })
      }
    }
    if (body.content) contents.push({ name: 'paste', content: body.content as string })
    if (!contents.length) return NextResponse.json({ error: 'Forneça arquivos, URLs ou conteúdo' }, { status: 400 })
  } else {
    return NextResponse.json({ error: 'Content-Type inválido' }, { status: 400 })
  }

  let allChannels: ParsedChannel[] = []
  const fileStats: Array<{ name: string; count: number }> = []

  for (const { name, content } of contents) {
    const parsed = parseM3U(content)
    fileStats.push({ name, count: parsed.length })
    allChannels = allChannels.concat(parsed)
  }

  if (allChannels.length === 0) return NextResponse.json({ error: 'Nenhum canal encontrado' }, { status: 400 })

  const uniqueGroups = [...new Set(allChannels.map(c => c.groupTitle).filter(Boolean))]
  const seriesChannels = allChannels.filter(c => c.contentType === 'SERIES')
  const movieChannels  = allChannels.filter(c => c.contentType === 'MOVIE')
  const liveChannels   = allChannels.filter(c => c.contentType === 'LIVE')

  if (preview) {
    // Count unique series
    const seriesTitles = new Set<string>()
    seriesChannels.forEach(c => {
      if (c.seriesTitle) seriesTitles.add(c.seriesTitle.toLowerCase())
    })

    return NextResponse.json({
      preview: true,
      files: fileStats,
      total: allChannels.length,
      breakdown: {
        live:   liveChannels.length,
        movies: movieChannels.length,
        series: seriesChannels.length,
        uniqueSeries: seriesTitles.size,
      },
      groups:     uniqueGroups.length,
      groupNames: uniqueGroups.slice(0, 30),
      sample: allChannels.slice(0, 8).map(c => ({
        name: c.name, group: c.groupTitle ?? '—', type: c.contentType, logo: !!c.logoUrl,
      })),
    })
  }

  const start = Date.now()
  let createdChannels = 0
  let skippedChannels = 0
  let createdSeries   = 0
  let createdSeasons  = 0
  let createdEpisodes = 0

  if (mode === 'replace') {
    // Clean everything
    await prisma.channel.deleteMany({})
    await prisma.episode.deleteMany({})
    await prisma.season.deleteMany({})
    await prisma.series.deleteMany({})
  }

  // ── 1. Import all channels in batches ─────────────────────────────────────
  const BATCH = 1000
  for (let i = 0; i < allChannels.length; i += BATCH) {
    const batch = allChannels.slice(i, i + BATCH)
    try {
      const result = await prisma.channel.createMany({
        data: batch.map((ch, bi) => ({
          uuid:        ch.uuid,
          name:        ch.name,
          tvgId:       ch.tvgId,
          tvgName:     ch.tvgName,
          logoUrl:     ch.logoUrl,
          streamUrl:   ch.streamUrl,
          groupTitle:  ch.groupTitle,
          contentType: ch.contentType,
          categoryId:  null,
          active:      true,
          order:       i + bi,
          isFeatured:  false,
          viewCount:   0,
        })),
        skipDuplicates: true,
      })
      createdChannels += result.count
      skippedChannels += batch.length - result.count
    } catch {
      skippedChannels += batch.length
    }
  }

  // ── 2. Build Series → Season → Episode structure ──────────────────────────
  // Group series channels by title
  const seriesMap = new Map<string, {
    title:     string
    provider:  string | null
    posterUrl: string | null
    episodes:  Array<{ season: number; episode: number; uuid: string; logoUrl: string | null }>
  }>()

  for (const ch of seriesChannels) {
    if (!ch.seriesTitle || ch.season == null || ch.episode == null) continue

    const key = ch.seriesTitle.toLowerCase().trim()
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        title:    ch.seriesTitle,
        provider: ch.groupTitle,
        posterUrl: ch.logoUrl,
        episodes: [],
      })
    }

    const entry = seriesMap.get(key)!
    entry.episodes.push({
      season:  ch.season,
      episode: ch.episode,
      uuid:    ch.uuid,
      logoUrl: ch.logoUrl,
    })
    // Update posterUrl if we find one and don't have one
    if (!entry.posterUrl && ch.logoUrl) entry.posterUrl = ch.logoUrl
  }

  // Create Series, Seasons, Episodes in DB
  for (const [, data] of seriesMap) {
    try {
      const seriesSlug = slugify(data.title)

      // Upsert Series
      const series = await prisma.series.upsert({
        where: { slug: seriesSlug },
        create: {
          title:    data.title,
          slug:     seriesSlug,
          posterUrl: data.posterUrl,
          provider: data.provider,
        },
        update: {
          // Update poster if missing
          ...(data.posterUrl ? { posterUrl: data.posterUrl } : {}),
          ...(data.provider  ? { provider:  data.provider }  : {}),
        },
      })
      createdSeries++

      // Group episodes by season
      const seasonMap = new Map<number, typeof data.episodes>()
      for (const ep of data.episodes) {
        if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, [])
        seasonMap.get(ep.season)!.push(ep)
      }

      for (const [seasonNum, episodes] of seasonMap) {
        // Upsert Season
        const season = await prisma.season.upsert({
          where: {
            seriesId_seasonNumber: {
              seriesId:     series.id,
              seasonNumber: seasonNum,
            },
          },
          create: {
            seriesId:     series.id,
            seasonNumber: seasonNum,
            title:        `Temporada ${seasonNum}`,
          },
          update: {},
        })
        createdSeasons++

        // Upsert Episodes and link channels
        for (const ep of episodes) {
          try {
            const episode = await prisma.episode.upsert({
              where: {
                seasonId_episodeNumber: {
                  seasonId:      season.id,
                  episodeNumber: ep.episode,
                },
              },
              create: {
                seasonId:      season.id,
                episodeNumber: ep.episode,
                logoUrl:       ep.logoUrl,
              },
              update: {
                ...(ep.logoUrl ? { logoUrl: ep.logoUrl } : {}),
              },
            })
            createdEpisodes++

            // Link Channel → Episode
            await prisma.channel.updateMany({
              where: { uuid: ep.uuid },
              data:  { episodeId: episode.id },
            })
          } catch {
            // Skip duplicate episode errors
          }
        }
      }
    } catch {
      // Skip series creation errors
    }
  }

  return NextResponse.json({
    success: true,
    mode,
    files: fileStats,
    total:    allChannels.length,
    channels: { created: createdChannels, skipped: skippedChannels },
    series:   { created: createdSeries },
    seasons:  { created: createdSeasons },
    episodes: { created: createdEpisodes },
    elapsed:  `${((Date.now() - start) / 1000).toFixed(1)}s`,
  })
}
