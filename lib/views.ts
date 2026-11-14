/**
 * Blog views — anonymous global counters served by a Neon Function next to
 * the portfolio's Postgres (see neon/views/index.ts), the read-only sibling
 * of lib/likes.ts. CORS covers the live origin and local preview ports.
 */
export const VIEWS_URL =
  'https://br-proud-sound-bcxqaoz9-views.compute.c-16.us-east-1.aws.neon.tech/'

export async function fetchViews(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`${VIEWS_URL}?slug=${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { views?: Record<string, number> }
    const count = data.views?.[slug]
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

/**
 * Count one view. The browser pings once per session per slug (the detail
 * page guards with sessionStorage); the server additionally throttles.
 */
export async function postView(slug: string): Promise<number | null> {
  try {
    const res = await fetch(VIEWS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { count?: number }
    return typeof data.count === 'number' ? data.count : null
  } catch {
    return null
  }
}
