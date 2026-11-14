'use client'

import { useEffect, useState } from 'react'
import { FaRegEye } from 'react-icons/fa'
import { fetchViews, postView } from '@/lib/views'

/**
 * View counter for a blog post — an eye + count in the blog-meta row. The
 * count is global (Neon Function + Postgres); a visit counts once per
 * browser session (sessionStorage guard), so reloads don't inflate it.
 * Renders nothing until the first count arrives — meta rows never flash.
 */
export default function ViewCounter({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const ping = async () => {
      try {
        if (sessionStorage.getItem(`viewed:${slug}`) !== '1') {
          sessionStorage.setItem(`viewed:${slug}`, '1')
          const bumped = await postView(slug)
          if (alive && bumped !== null) {
            setCount(bumped)
            return
          }
        }
      } catch {
        // storage blocked (private mode) — fall through to a plain read
      }
      const current = await fetchViews(slug)
      if (alive && current !== null) setCount(current)
    }
    void ping()
    return () => {
      alive = false
    }
  }, [slug])

  if (count === null) return null
  return (
    <span className="view-count" aria-label={`${count} views`}>
      <FaRegEye size={11} />
      <span className="tabular-nums">{count}</span>
      <span className="view-count-verb">{count === 1 ? 'view' : 'views'}</span>
    </span>
  )
}
