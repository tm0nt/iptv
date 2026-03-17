import crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Content type detection
// ─────────────────────────────────────────────────────────────────────────────
export type ContentType = 'LIVE' | 'MOVIE' | 'SERIES' | 'RADIO'

export interface ParsedChannel {
  uuid:        string
  name:        string
  tvgId:       string | null
  tvgName:     string | null
  logoUrl:     string | null
  groupTitle:  string | null
  streamUrl:   string
  contentType: ContentType
  // Series metadata (only if contentType === 'SERIES')
  seriesTitle: string | null
  season:      number | null
  episode:     number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Series pattern matchers — ordered by specificity
// Matches: "Black Mirror S01 E01", "Show Name S1E3", "Title T02E05"
// Also:    "Show Name - S01 E01 - Episode Title"
// ─────────────────────────────────────────────────────────────────────────────
const SERIES_PATTERNS = [
  // S01 E01 or S01E01 (most common IPTV pattern)
  /^(.+?)\s*[-–]?\s*S(\d{1,3})\s*E(\d{1,3})\b/i,
  // T01 E01 or T01E01 (PT-BR pattern)
  /^(.+?)\s*[-–]?\s*T(\d{1,3})\s*E(\d{1,3})\b/i,
  // Season 1 Episode 1
  /^(.+?)\s*[-–]?\s*Season\s*(\d{1,3})\s*Episode\s*(\d{1,3})\b/i,
  // Temporada 1 Episodio 1
  /^(.+?)\s*[-–]?\s*Temporada\s*(\d{1,3})\s*Epis[oó]dio\s*(\d{1,3})\b/i,
]

// Movie pattern: "Movie Title (2023)" or "(2023) [Dual]"
const MOVIE_YEAR_PATTERN = /\((\d{4})\)/
const MOVIE_QUALITY      = /\b(720p|1080p|4K|UHD|REMUX|BluRay|WEBRip|WEB-DL|HDRip)\b/i

// Groups that indicate series content
const SERIES_GROUPS = [
  /^netflix$/i, /^max$/i, /^hbo\s/i, /^disney\+$/i, /^disney\+\s/i,
  /^paramount\+$/i, /^prime\s*v[ií]deo$/i, /^apple\s*tv\+$/i,
  /^hulu$/i, /^crunchyroll$/i, /^globoplay/i, /^lionsgate/i,
  /^novelas?\s/i, /^doramas?$/i, /^animes?$/i,
  /^legendad[ao]s?$/i,
]

// Groups that indicate movie content
const MOVIE_GROUPS = [
  /filme|movie|cinema/i,
  /lançamento|lancamento|estreia/i,
  /ação.*crime|com[eé]dia|romance|terror|suspense|fic[çc][aã]o|fantasia|faroeste|guerra/i,
  /drama.*hist[oó]ria/i,
  /fam[ií]lia.*aventura/i,
  /marvel.*dc/i,
  /4k\s*filme/i,
  /anima[çc][aã]o$/i,
  /brasileiro$/i,
]

// Groups that indicate radio
const RADIO_GROUPS = [/^r[aá]dio/i, /\bfm\b/i, /\bam\b.*station/i]

// Groups that are live channels (24h marathon streams count as live)
const LIVE_24H_GROUPS = [/24\s*h/i, /maratona/i, /^shows?\s*24/i]

function detectContentType(name: string, groupTitle: string | null): ContentType {
  const g = groupTitle?.trim() || ''

  // 1. Radio detection
  if (RADIO_GROUPS.some(p => p.test(g))) return 'RADIO'

  // 2. 24h marathon streams → LIVE (they look like series but are live loops)
  if (LIVE_24H_GROUPS.some(p => p.test(g))) return 'LIVE'

  // 3. Series detection by name pattern (S01E01 etc.)
  if (SERIES_PATTERNS.some(p => p.test(name))) return 'SERIES'

  // 4. Series detection by group
  if (SERIES_GROUPS.some(p => p.test(g))) {
    // But only if name also has S##E## pattern — otherwise it might be a movie on Netflix
    if (SERIES_PATTERNS.some(p => p.test(name))) return 'SERIES'
    // Check if name has year pattern → movie on streaming platform
    if (MOVIE_YEAR_PATTERN.test(name)) return 'MOVIE'
    // Default for streaming groups with episode patterns
    return 'SERIES'
  }

  // 5. Movie detection by group
  if (MOVIE_GROUPS.some(p => p.test(g))) return 'MOVIE'

  // 6. Movie detection by name (has year)
  if (MOVIE_YEAR_PATTERN.test(name) && MOVIE_QUALITY.test(name)) return 'MOVIE'
  if (MOVIE_YEAR_PATTERN.test(name) && !SERIES_PATTERNS.some(p => p.test(name))) {
    // Name has (2023) but no S01E01 → likely a movie
    return 'MOVIE'
  }

  return 'LIVE'
}

/**
 * Extract series info from channel name.
 * Returns { title, season, episode } or null if not a series.
 */
export function extractSeriesInfo(name: string): {
  title: string; season: number; episode: number
} | null {
  for (const pattern of SERIES_PATTERNS) {
    const match = name.match(pattern)
    if (match) {
      const title   = match[1].replace(/[-–]\s*$/, '').trim()
      const season  = parseInt(match[2], 10)
      const episode = parseInt(match[3], 10)
      if (title && season > 0 && episode > 0) {
        return { title, season, episode }
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// High-performance streaming M3U parser
// Designed for files with 500k+ channels.
// ─────────────────────────────────────────────────────────────────────────────
export function parseM3U(content: string): ParsedChannel[] {
  const channels: ParsedChannel[] = []
  const lines = content.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.startsWith('#EXTINF:')) { i++; continue }

    const tvgId      = extractAttr(line, 'tvg-id')
    const tvgName    = extractAttr(line, 'tvg-name')
    const logoUrl    = extractAttr(line, 'tvg-logo')
    const groupTitle = extractAttr(line, 'group-title')

    const name = extractChannelName(line) || tvgName || 'Canal'

    // Find URL on the next non-empty, non-comment line
    let url = ''
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j].trim()
      if (next && !next.startsWith('#')) { url = next; break }
      if (next.startsWith('#EXTINF:')) break
      j++
    }

    if (url && isStreamUrl(url)) {
      const uuid        = channelUuidKey(url)
      const contentType = detectContentType(name.trim(), groupTitle)
      const seriesInfo  = contentType === 'SERIES' ? extractSeriesInfo(name.trim()) : null

      channels.push({
        uuid,
        name:        name.trim().slice(0, 120) || 'Canal',
        tvgId:       tvgId   || null,
        tvgName:     tvgName || null,
        logoUrl:     logoUrl && isHttpUrl(logoUrl) ? logoUrl : null,
        groupTitle:  groupTitle ? groupTitle.trim().slice(0, 100) : null,
        streamUrl:   url,
        contentType,
        seriesTitle: seriesInfo?.title || null,
        season:      seriesInfo?.season || null,
        episode:     seriesInfo?.episode || null,
      })
      i = j + 1
    } else {
      i++
    }
  }

  return channels
}

// Stable, collision-free UUID key from stream URL
export function channelUuidKey(streamUrl: string): string {
  return 'ch-' + crypto.createHash('md5').update(streamUrl).digest('hex')
}

// Slugify for category / series names
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'outros'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractAttr(line: string, attr: string): string | null {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, 'i')
  const m  = line.match(re)
  if (!m) return null
  return m[1].trim() || null
}

function extractChannelName(line: string): string {
  const attrEnd = line.lastIndexOf('"')
  if (attrEnd >= 0) {
    const after    = line.slice(attrEnd + 1)
    const commaIdx = after.indexOf(',')
    if (commaIdx >= 0) return after.slice(commaIdx + 1).trim()
  }
  const lastComma = line.lastIndexOf(',')
  return lastComma >= 0 ? line.slice(lastComma + 1).trim() : ''
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

function isStreamUrl(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return ['http:', 'https:', 'rtmp:', 'rtsp:'].includes(u.protocol)
  } catch { return false }
}
