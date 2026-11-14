/**
 * Blog views API — a Neon Function next to the portfolio's Postgres, the
 * read-only sibling of the likes API (see neon/likes/index.ts).
 *
 * GET  /?slug=<slug>  → { views: { [slug]: count } }   (omit slug for all)
 * POST /  { slug }    → { slug, count }                (bumps the counter)
 *
 * Counting is passive: the blog detail page pings once per browser session
 * (sessionStorage guard client-side). Guards here: strict slug shape, a
 * per-isolate per-IP+slug throttle, and the same origin allowlist as likes.
 */
import { attachDatabasePool } from '@neon/functions'
import { Pool } from 'pg'

const ALLOWED_ORIGINS = new Set([
  'https://cyberd4ch.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
])

const SLUG_RE = /^[a-z0-9-]{1,80}$/

function cors(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
attachDatabasePool(pool)

/** the table self-heals on first use, so branch resets are safe */
let schema: Promise<void> | null = null
function ensureSchema() {
  schema ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS blog_views (
        slug text PRIMARY KEY,
        count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    )
    .then(() => undefined)
  return schema
}

/** tiny per-isolate throttle: 6 pings per ip+slug per hour (the client
    pings once per session; this only bounds a hand-rolled spammer) */
const hits = new Map<string, { n: number; reset: number }>()
function throttled(ip: string, slug: string) {
  const now = Date.now()
  const h = hits.get(`${ip}:${slug}`)
  if (!h || now > h.reset) {
    hits.set(`${ip}:${slug}`, { n: 1, reset: now + 3_600_000 })
    return false
  }
  h.n += 1
  return h.n > 6
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('origin') ?? ''
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) })
    }

    const url = new URL(request.url)
    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/views')) {
        await ensureSchema()
        const slug = url.searchParams.get('slug')
        const { rows } = slug
          ? await pool.query('SELECT slug, count FROM blog_views WHERE slug = $1', [slug])
          : await pool.query('SELECT slug, count FROM blog_views ORDER BY count DESC LIMIT 200')
        const views: Record<string, number> = {}
        for (const row of rows) views[row.slug as string] = row.count as number
        return Response.json({ views }, { headers: cors(origin) })
      }

      if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '/view')) {
        const body = (await request.json().catch(() => null)) as { slug?: unknown } | null
        const slug = typeof body?.slug === 'string' ? body.slug : ''
        if (!SLUG_RE.test(slug)) {
          return Response.json({ error: 'bad slug' }, { status: 400, headers: cors(origin) })
        }
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
        if (throttled(ip, slug)) {
          return Response.json({ error: 'slow down' }, { status: 429, headers: cors(origin) })
        }
        await ensureSchema()
        const { rows } = await pool.query(
          `INSERT INTO blog_views (slug, count) VALUES ($1, 1)
           ON CONFLICT (slug) DO UPDATE SET count = blog_views.count + 1, updated_at = now()
           RETURNING count`,
          [slug],
        )
        return Response.json(
          { slug, count: rows[0]?.count ?? 0 },
          { headers: cors(origin) },
        )
      }

      return Response.json({ error: 'not found' }, { status: 404, headers: cors(origin) })
    } catch (err) {
      console.error('[views]', err)
      return Response.json(
        { error: 'view service unavailable' },
        { status: 503, headers: cors(origin) },
      )
    }
  },
}
