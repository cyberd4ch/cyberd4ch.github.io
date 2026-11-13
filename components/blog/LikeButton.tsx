'use client'

import { useEffect, useState } from 'react'
import { FaHeart, FaRegHeart } from 'react-icons/fa'
import { fetchLikes, postLike } from '@/lib/likes'

/**
 * Anonymous like button for a blog post — a small heart + count that rides
 * the blog-meta row. The count is global (Neon Function + Postgres); whether
 * *this* visitor liked it persists in localStorage, so a refresh shows the
 * liked state without re-liking.
 */
export default function LikeButton({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(`liked:${slug}`) === '1')
    } catch {
      // private mode etc. — liking still works, it just won't persist
    }
    let alive = true
    fetchLikes(slug).then(c => {
      if (alive && c !== null) setCount(c)
    })
    return () => {
      alive = false
    }
  }, [slug])

  async function like() {
    if (liked || busy) return
    setBusy(true)
    // optimistic: show it instantly, reconcile with the server's count
    setCount(c => (c ?? 0) + 1)
    setLiked(true)
    try {
      localStorage.setItem(`liked:${slug}`, '1')
    } catch {
      // storage may be blocked — the button already shows liked
    }
    const serverCount = await postLike(slug)
    if (serverCount !== null) setCount(serverCount)
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={like}
      disabled={liked}
      aria-pressed={liked}
      aria-label={liked ? 'liked' : 'like this post'}
      className={`like-btn${liked ? ' liked' : ''}`}
    >
      {liked ? <FaHeart size={11} /> : <FaRegHeart size={11} />}
      <span className="tabular-nums">{count === null ? '·' : String(count)}</span>
      <span className="like-btn-verb">{liked ? 'liked' : 'like'}</span>
    </button>
  )
}
