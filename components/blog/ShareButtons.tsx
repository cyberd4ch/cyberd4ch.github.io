'use client'

import { useState } from 'react'
import { FaLink } from 'react-icons/fa'
import { FaLinkedinIn, FaRedditAlien, FaHackerNews } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'

/**
 * Social share cluster for a blog post — rides the blog-meta row next to the
 * like button. Every target is a plain share-intent URL (no third-party
 * script, nothing tracks the reader beyond what those networks already do);
 * "copy" writes the post URL to the clipboard and flashes a tiny
 * confirmation. The links render server-side too: the origin is the site's
 * own, no window needed.
 */
const SITE_ORIGIN = 'https://cyberd4ch.github.io'

export default function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const url = `${SITE_ORIGIN}/blog/${slug}/`
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const links = [
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { label: 'HN', href: `https://news.ycombinator.com/submitlink?u=${u}&t=${t}` },
  ]

  async function copy() {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard may be blocked; nothing to show
    }
  }

  return (
    <span className="share-row" aria-label="share this post">
      <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">share:</span>
      {links.map(l => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`share on ${l.label}`}
          title={`share on ${l.label}`}
          className="share-btn"
        >
          {l.label === 'X' && <FaXTwitter size={11} />}
          {l.label === 'LinkedIn' && <FaLinkedinIn size={11} />}
          {l.label === 'Reddit' && <FaRedditAlien size={12} />}
          {l.label === 'HN' && <FaHackerNews size={12} />}
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label="copy link"
        title="copy link"
        className="share-btn"
      >
        {copied ? <span className="share-copied">copied</span> : <FaLink size={11} />}
      </button>
    </span>
  )
}
