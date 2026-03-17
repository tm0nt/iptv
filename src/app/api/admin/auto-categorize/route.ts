import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// GROUP-TITLE DIRECT MAPPING
// ─────────────────────────────────────────────────────────────────────────────
interface GroupRule {
  slug:     string
  patterns: RegExp[]
}

const GROUP_RULES: GroupRule[] = [
  // ── Adult ────────────────────────────────────────────────────────────────
  { slug: 'adulto', patterns: [/adult|xxx|18\+|erotic|porno|sex\b/i] },

  // ── Series / VOD ─────────────────────────────────────────────────────────
  {
    slug: 'series',
    patterns: [
      /^netflix$/i, /^max$/i, /^hbo\s/i, /^disney\+/i, /^paramount\+/i,
      /^prime\s*v[ií]deo$/i, /^apple\s*tv\+/i, /^hulu$/i, /^crunchyroll$/i,
      /^globoplay/i, /^lionsgate/i, /^reelshort$/i,
      /^novelas?\s/i, /^doramas?$/i, /^animes?$/i,
      /^legendad[ao]s?$/i, /^legendados$/i,
    ],
  },

  // ── Movies / VOD ─────────────────────────────────────────────────────────
  {
    slug: 'filmes',
    patterns: [
      /filme|movie|cinema/i,
      /lançamento|lancamento|estreia/i,
      /telecine|cinemax/i,
      /4k\s*filme/i,
      /ação.*crime|com[eé]dia|romance|terror|suspense|fic[çc][aã]o|fantasia|faroeste|guerra.*policial/i,
      /drama.*hist[oó]ria/i, /fam[ií]lia.*aventura/i,
      /marvel.*dc/i, /anima[çc][aã]o$/i, /brasileiro$/i,
    ],
  },

  // ── Radio ────────────────────────────────────────────────────────────────
  { slug: 'musica', patterns: [/radio\s*station|rádio station|radio channels/i] },

  // ── Sports ───────────────────────────────────────────────────────────────
  {
    slug: 'esportes',
    patterns: [
      /esporte|sport/i, /futebol|soccer|football/i,
      /ppv|pay.per.view/i, /^espn$/i, /^premiere$/i,
      /hora.*jogo/i,
      /nba.*league|nfl.*game|nhl.*center|mlb.*game|mls.*season/i,
    ],
  },

  // ── News ─────────────────────────────────────────────────────────────────
  { slug: 'noticias', patterns: [/notícia|noticias|news\b|jornal|jornalismo/i] },

  // ── Kids ─────────────────────────────────────────────────────────────────
  {
    slug: 'infantil',
    patterns: [
      /infantil|infantis|kids|criança/i,
      /cartoon/i,
      /desenho/i,
      /disney\+?\s*desenho/i, /netflix\s*desenho/i,
      /prime.*desenho/i, /max\s*desenho/i,
    ],
  },

  // ── Documentary ──────────────────────────────────────────────────────────
  { slug: 'documentarios', patterns: [/document|nat.?geo|discovery\b|history\b/i] },

  // ── Music ────────────────────────────────────────────────────────────────
  { slug: 'musica', patterns: [/música|musica\b|music\b/i] },

  // ── BBB / Reality ────────────────────────────────────────────────────────
  { slug: 'variedades', patterns: [/bbb|big\s*brother|reality/i, /variedades/i, /show/i] },

  // ── Religious ────────────────────────────────────────────────────────────
  { slug: 'religioso', patterns: [/religios|gospel|católic|evangélic/i] },

  // ── BR open TV ───────────────────────────────────────────────────────────
  {
    slug: 'tv-aberta',
    patterns: [
      /^globo\b/i, /^sbt\b/i, /^record\b/i, /^band\b|bandeirantes/i,
      /^redetv\b/i, /^tv\s+cultura/i, /^tv\s+gazeta/i,
      /aberta|abertos/i, /canais\s+abertos/i,
    ],
  },

  // ── 24h Marathons ────────────────────────────────────────────────────────
  { slug: 'maratona-24h', patterns: [/24\s*h|maratona/i, /^especiais\s*24/i, /^filmes\s*24/i, /^shows\s*24/i] },

  // ── Cine Sky ─────────────────────────────────────────────────────────────
  { slug: 'filmes', patterns: [/^cine\s*sky$/i] },

  // ── Discovery+ ───────────────────────────────────────────────────────────
  { slug: 'documentarios', patterns: [/discovery\s*plus/i] },

  // ── International ────────────────────────────────────────────────────────
  {
    slug: 'internacional',
    patterns: [
      /^romania\b/i, /^turkey\b/i, /^france\b/i, /^spain\b/i,
      /^italy\b/i, /^germany\b/i, /^russia\b/i, /^poland\b/i,
      /^greece\b/i, /^arabic\b/i, /^usa\b|estados\s*unidos/i, /^uk\b/i,
      /^india\b/i, /^pakistan\b/i, /^hindi\b/i, /^portugal\b/i,
      /^directv$/i, /^desporto$/i,
    ],
  },
]

// ── NAME FALLBACK ────────────────────────────────────────────────────────────
interface NameRule { slug: string; keywords: string[]; brOnly?: boolean }

const NAME_RULES: NameRule[] = [
  { slug: 'adulto', keywords: ['xxx', '18+', 'erotic', 'porn', 'adult'] },
  {
    slug: 'esportes',
    keywords: [
      'sportv', 'espn', 'fox sport', 'combate', 'ufc', 'premiere',
      'futebol', 'nba', 'nfl', 'formula 1', 'f1 ', 'mma', 'boxe',
    ],
  },
  {
    slug: 'noticias',
    keywords: [
      'globonews', 'band news', 'record news', 'jovem pan news',
      'cnn brasil', 'bbc brasil', 'jornal',
    ],
  },
  {
    slug: 'infantil',
    keywords: [
      'cartoon network', 'disney channel', 'disney junior', 'nickelodeon',
      'nick jr', 'boomerang', 'gloob', 'discovery kids',
    ],
  },
  {
    slug: 'documentarios',
    keywords: ['national geographic', 'nat geo', 'discovery', 'history channel', 'animal planet'],
  },
  {
    slug: 'filmes',
    keywords: ['telecine', 'hbo', 'cinemax', 'cine', 'paramount', 'warner', 'mgm'],
  },
  { slug: 'musica', keywords: ['multishow', 'vh1', 'mtv', 'bis ', 'music'] },
  {
    slug: 'tv-aberta', brOnly: true,
    keywords: ['globo', 'sbt', 'record', 'band', 'redetv', 'tv cultura'],
  },
]

// ── Foreign detection ──────────────────────────────────────────────────────
const FOREIGN_GROUP_PATTERNS = [
  /^romania\b/i, /^turk/i, /^france\b/i, /^spain\b|^espana\b/i,
  /^italy\b|^italia\b/i, /^german/i, /^russia\b/i, /^poland\b|^polsk/i,
  /^greece\b|^greek\b/i, /^arabic\b|^arab\b/i, /^usa\b|^united states/i,
  /^uk\b|^united kingdom/i, /^india\b|^hindi\b/i, /^pakistan\b/i,
  /^colombia\b/i, /^argentina\b/i, /^mexico\b/i, /^peru\b/i,
  /^venezuela\b/i, /^chile\b/i, /^portugal\b/i,
]

const BR_GROUP_PATTERNS = [
  /^globo\b/i, /^sbt\b/i, /^record\b/i, /^band\b/i, /^redetv\b/i,
  /\bbr\b/i, /brasil|brazil/i, /nordeste|sudeste|sul |norte |centro.oeste/i,
]

function isForeignGroup(g: string | null): boolean {
  if (!g) return false
  const t = g.trim()
  if (BR_GROUP_PATTERNS.some(p => p.test(t))) return false
  return FOREIGN_GROUP_PATTERNS.some(p => p.test(t))
}

function categorize(name: string, groupTitle: string | null, contentType: string): string | null {
  // Series channels are categorized under their provider or "series"
  if (contentType === 'SERIES') return 'series'
  if (contentType === 'MOVIE')  return 'filmes'
  if (contentType === 'RADIO')  return 'musica'

  if (isForeignGroup(groupTitle)) return 'internacional'

  if (groupTitle) {
    for (const rule of GROUP_RULES) {
      if (rule.patterns.some(p => p.test(groupTitle))) return rule.slug
    }
  }

  const nameLower = name.toLowerCase()
  const isForeign = isForeignGroup(groupTitle)
  for (const rule of NAME_RULES) {
    if (rule.brOnly && isForeign) continue
    if (rule.keywords.some(kw => nameLower.includes(kw.toLowerCase()))) return rule.slug
  }

  return null
}

// ── GET preview ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const onlyUncat = new URL(request.url).searchParams.get('only_uncategorized') !== '0'

  const categories = await prisma.category.findMany({ where: { active: true } })
  const slugToId   = Object.fromEntries(categories.map(c => [c.slug, c.id]))

  const channels = await prisma.channel.findMany({
    where: { active: true, ...(onlyUncat ? { categoryId: null } : {}) },
    select: { uuid: true, name: true, groupTitle: true, contentType: true },
  })

  const preview: Record<string, number> = {}
  for (const ch of channels) {
    const slug = categorize(ch.name, ch.groupTitle, ch.contentType)
    if (slug && slugToId[slug]) {
      preview[slug] = (preview[slug] || 0) + 1
    } else {
      preview['_unmatched'] = (preview['_unmatched'] || 0) + 1
    }
  }

  return NextResponse.json({
    total:   channels.length,
    matched: channels.length - (preview['_unmatched'] || 0),
    preview: Object.entries(preview)
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({
        slug,
        name: categories.find(c => c.slug === slug)?.name || slug,
        count,
      })),
  })
}

// ── POST apply ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body    = await request.json().catch(() => ({})) as Record<string, unknown>
  const onlyUncat = body.only_uncategorized !== false
  const dryRun    = body.dry_run === true

  const categories = await prisma.category.findMany({ where: { active: true } })
  const slugToId   = Object.fromEntries(categories.map(c => [c.slug, c.id]))

  // Ensure essential categories exist
  const essentialCategories = [
    { name: 'Séries',          slug: 'series',       icon: '🎬', order: 10 },
    { name: 'Filmes',          slug: 'filmes',       icon: '🎥', order: 20 },
    { name: 'TV Aberta',       slug: 'tv-aberta',    icon: '📺', order: 1 },
    { name: 'Esportes',        slug: 'esportes',     icon: '⚽', order: 5 },
    { name: 'Notícias',        slug: 'noticias',     icon: '📰', order: 6 },
    { name: 'Infantil',        slug: 'infantil',     icon: '🧸', order: 7 },
    { name: 'Documentários',   slug: 'documentarios',icon: '🌍', order: 8 },
    { name: 'Música',          slug: 'musica',       icon: '🎵', order: 9 },
    { name: 'Variedades',      slug: 'variedades',   icon: '🎭', order: 11 },
    { name: 'Maratona 24H',    slug: 'maratona-24h', icon: '🔄', order: 12 },
    { name: 'Internacional',   slug: 'internacional',icon: '🌎', order: 15 },
    { name: 'Religioso',       slug: 'religioso',    icon: '✝️', order: 16 },
    { name: 'Adulto',          slug: 'adulto',       icon: '🔞', order: 99 },
  ]

  if (!dryRun) {
    for (const cat of essentialCategories) {
      if (!slugToId[cat.slug]) {
        const created = await prisma.category.upsert({
          where: { slug: cat.slug },
          create: cat,
          update: {},
        })
        slugToId[cat.slug] = created.id
      }
    }
  }

  const channels = await prisma.channel.findMany({
    where: { active: true, ...(onlyUncat ? { categoryId: null } : {}) },
    select: { id: true, name: true, groupTitle: true, contentType: true },
  })

  const updates: Record<string, string[]> = {}
  let unmatched = 0

  for (const ch of channels) {
    const slug       = categorize(ch.name, ch.groupTitle, ch.contentType)
    const categoryId = slug ? slugToId[slug] : null
    if (categoryId) {
      updates[categoryId] = updates[categoryId] ?? []
      updates[categoryId].push(ch.id)
    } else {
      unmatched++
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dry_run: true, total: channels.length,
      matched: channels.length - unmatched, unmatched,
      breakdown: Object.entries(updates)
        .map(([catId, ids]) => ({
          category: categories.find(c => c.id === catId)?.name ?? catId,
          count: ids.length,
        }))
        .sort((a, b) => b.count - a.count),
    })
  }

  const start = Date.now()
  let total   = 0
  const CHUNK = 5000

  await Promise.all(
    Object.entries(updates).map(async ([categoryId, ids]) => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await prisma.channel.updateMany({
          where: { id: { in: ids.slice(i, i + CHUNK) } },
          data:  { categoryId },
        })
        total += res.count
      }
    })
  )

  return NextResponse.json({
    success: true, total: channels.length, updated: total, unmatched,
    elapsed: `${((Date.now() - start) / 1000).toFixed(1)}s`,
    breakdown: Object.entries(updates)
      .map(([catId, ids]) => ({
        category: [...categories, ...essentialCategories.map(c => ({ ...c, id: slugToId[c.slug] }))].find(c => c.id === catId)?.name ?? catId,
        count: ids.length,
      }))
      .sort((a, b) => b.count - a.count),
  })
}
