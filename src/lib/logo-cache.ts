import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Logo cache — downloads channel logos once and serves them from /public/logos/
//
// Flow:
//   1. Hash the original URL → deterministic filename
//   2. If /public/logos/<hash>.<ext> already exists → return local path
//   3. Otherwise → fetch, save to disk → return local path
//   4. On any error → return the original URL (graceful fallback)
// ─────────────────────────────────────────────────────────────────────────────

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos')

// Ensure directory exists at startup
function ensureDir() {
  if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true })
  }
}

function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex')
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext      = path.extname(pathname).toLowerCase()
    // Only allow safe image extensions
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) return ext
  } catch {}
  return '.png'
}

// Main entry: returns the public path to serve, or original URL on failure
export async function cacheLogo(originalUrl: string | null): Promise<string | null> {
  if (!originalUrl) return null

  try {
    ensureDir()

    const hash     = hashUrl(originalUrl)
    const ext      = extFromUrl(originalUrl)
    const filename = `${hash}${ext}`
    const filepath = path.join(LOGOS_DIR, filename)
    const publicPath = `/logos/${filename}`

    // ── Already cached ──────────────────────────────────────────────────
    if (fs.existsSync(filepath)) {
      return publicPath
    }

    // ── Download ─────────────────────────────────────────────────────────
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 8000) // 8s timeout per logo

    const res = await fetch(originalUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'StreamBox-LogoCache/1.0' },
    })
    clearTimeout(tid)

    if (!res.ok) return originalUrl // fallback

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return originalUrl // not an image

    const buffer = Buffer.from(await res.arrayBuffer())

    // Sanity check: reject files > 2MB (probably not a logo)
    if (buffer.length > 2 * 1024 * 1024) return originalUrl

    fs.writeFileSync(filepath, buffer)
    return publicPath

  } catch {
    // Always fall back gracefully
    return originalUrl
  }
}

// Batch version — processes N logos with concurrency limit
export async function cacheLogoBatch(
  logos: Array<string | null>,
  concurrency = 10
): Promise<Array<string | null>> {
  ensureDir()

  const results: Array<string | null> = new Array(logos.length).fill(null)
  let   idx = 0

  async function worker() {
    while (idx < logos.length) {
      const i    = idx++
      results[i] = await cacheLogo(logos[i])
    }
  }

  // Run `concurrency` workers in parallel
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}
