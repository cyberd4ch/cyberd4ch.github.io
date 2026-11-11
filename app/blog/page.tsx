'use client'

import { useState } from 'react'
import Link from 'next/link'
import { posts, BlogCategory } from '@/lib/posts'

type Filter = 'all' | BlogCategory

const filters: { label: string; value: Filter }[] = [
  { label: 'all', value: 'all' },
  { label: 'technical', value: 'technical' },
  { label: 'general', value: 'general' },
]

export default function BlogPage() {
  const [active, setActive] = useState<Filter>('all')

  const filtered = active === 'all' ? posts : posts.filter(p => p.category === active)

  return (
    <div>
      <h1 className="text-2xl font-medium mb-6 stagger-1">blog</h1>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-8 stagger-2">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setActive(f.value)}
            className={`filter-tab ${active === f.value ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts list */}
      <div className="divide-y divide-[var(--border)] stagger-3">
        {filtered.length === 0 && (
          <p className="text-sm text-[var(--muted)] py-4">no posts in this category yet.</p>
        )}
        {filtered.map((post) => {
          const inner = (
            <>
              <div className="flex-1 min-w-0">
                <span className="text-sm underline-link group-hover:text-[var(--fg)]">
                  {post.title}
                </span>
                {post.excerpt && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed hidden sm:block">
                    {post.excerpt}
                  </p>
                )}
              </div>
              <span className="text-xs text-[var(--muted)] whitespace-nowrap shrink-0">
                {post.date}
              </span>
            </>
          )

          return post.slug ? (
            <Link
              key={post.id}
              href={post.url}
              className="blog-row flex items-baseline justify-between py-4 gap-4 group"
            >
              {inner}
            </Link>
          ) : (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-row flex items-baseline justify-between py-4 gap-4 group"
            >
              {inner}
            </a>
          )
        })}
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border)] stagger-4">
        <p className="text-xs text-[var(--muted)]">
          client-facing{' '}
          <Link href="/freelance" className="underline-link font-medium text-[var(--fg)]">
            case studies
          </Link>{' '}
          live under services.
        </p>
      </div>
    </div>
  )
}
