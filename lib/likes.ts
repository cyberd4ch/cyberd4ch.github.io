/**
 * Blog likes — anonymous global counters served by a Neon Function next to
 * the portfolio's Postgres (see neon/likes/index.ts). The site is a static
 * export, so runtime state lives there; the invocation URL is public and
 * baked in. CORS covers the live origin and local preview ports.
 */
export const LIKES_URL =
  'https://br-proud-sound-bcxqaoz9-likes.compute.c-16.us-east-1.aws.neon.tech/'

export async function fetchLikes(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`${LIKES_URL}?slug=${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { likes?: Record<string, number> }
    const count = data.likes?.[slug]
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

export async function postLike(slug: string): Promise<number | null> {
  try {
    const res = await fetch(LIKES_URL, {
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
