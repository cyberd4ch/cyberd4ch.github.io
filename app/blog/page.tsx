'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import PageCol from '@/components/PageCol'
import AIRing from '@/components/blog/AIRing'
import { posts, allTags, allTopics, BlogCategory, Post } from '@/lib/posts'

type Filter = 'all' | BlogCategory

const filters: { label: string; value: Filter }[] = [
  { label: 'all', value: 'all' },
  { label: 'technical', value: 'technical' },
  { label: 'general', value: 'general' },
]

/**
 * The blog rendered like SELA's logo archive: entries grouped into numbered
 * chapters (topics), each entry carrying the archive's signature brief
 * description under its name, plus the working metadata — read time, the
 * AI-assist ring (full ring = published as the AI drafted it; the gap is the
 * human share) and the tags it qualifies under.
 */
export default function BlogPage() {
  const [category, setCategory] = useState<Filter>('all')
  const [topic, setTopic] = useState<string>('all')
  const [tag, setTag] = useState<string>('all')

  const filtered = useMemo(
    () =>
      posts.filter(
        p =>
          (category === 'all' || p.category === category) &&
          (topic === 'all' || p.topics.includes(topic)) &&
          (tag === 'all' || p.tags.includes(tag)),
      ),
    [category, topic, tag],
  )

  // chapters (topics) present in the filtered set, biggest first
  const chapters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of filtered) for (const t of p.topics) counts.set(t, (counts.get(t) || 0) + 1)
    return allTopics.filter(t => counts.has(t)).map(t => [t, counts.get(t)!] as const)
  }, [filtered])

  const groups = useMemo(() => {
    if (topic !== 'all') return [[topic, filtered] as const]
    return chapters.map(([t]) => [t, filtered.filter(p => p.topics.includes(t))] as const)
  }, [chapters, filtered, topic])

  const pickTag = (t: string) => setTag(cur => (cur === t ? 'all' : t))
  const pickTopic = (t: string) => setTopic(cur => (cur === t ? 'all' : t))

  return (
    <PageCol>
      <h1 className="text-2xl font-medium mb-6 stagger-1">blog</h1>

      {/* category tabs */}
      <div className="flex items-center gap-1 mb-3 stagger-2">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setCategory(f.value)}
            className={`filter-tab ${category === f.value ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* topic chapters — SELA's archive sections */}
      <div className="flex flex-wrap items-center gap-1 mb-3 stagger-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mr-1">
          chapters
        </span>
        <button
          onClick={() => setTopic('all')}
          className={`filter-tab ${topic === 'all' ? 'active' : ''}`}
        >
          all
        </button>
        {allTopics.map(t => (
          <button
            key={t}
            onClick={() => pickTopic(t)}
            className={`filter-tab ${topic === t ? 'active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* tags — pick one to sort the archive by it */}
      <div className="flex flex-wrap items-center gap-1.5 mb-8 stagger-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mr-1">tags</span>
        {allTags.map(t => (
          <button
            key={t}
            onClick={() => pickTag(t)}
            className={`tag-chip ${tag === t ? 'active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-[var(--muted)] py-4">no posts match this filter.</p>
      )}

      {/* chapters + entries */}
      {groups.map(([chapter, list], ci) => (
        <section key={chapter} className="stagger-3 mb-10">
          <div className="chapter-head">
            <h2 className="sec-label">
              {topic === 'all' && `chapter ${String(ci + 1).padStart(2, '0')} · `}
              {chapter} <span className="chapter-count">( {list.length} )</span>
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {list.map((post, i) => (
              <BlogRow key={post.id} post={post} index={i} onTag={pickTag} />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-10 pt-6 border-t border-[var(--border)] stagger-4">
        <p className="text-xs text-[var(--muted)]">
          client-facing{' '}
          <Link href="/freelance" className="underline-link font-medium text-[var(--fg)]">
            case studies
          </Link>{' '}
          live under services.
        </p>
      </div>
    </PageCol>
  )
}

function BlogRow({
  post,
  index,
  onTag,
}: {
  post: Post
  index: number
  onTag: (tag: string) => void
}) {
  const inner = (
    <>
      <span className="text-[11px] text-[var(--red)] w-7 shrink-0 pt-0.5">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm underline-link group-hover:text-[var(--fg)]">{post.title}</span>
        {/* the SELA archive description: the brief under the name */}
        {post.excerpt && (
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{post.excerpt}</p>
        )}
        <div className="blog-meta">
          <span>{post.date}</span>
          <span className="meta-dot">·</span>
          <span>{post.readMinutes} min read</span>
          {post.aiAssist != null && (
            <>
              <span className="meta-dot">·</span>
              <AIRing pct={post.aiAssist} size={13} label />
            </>
          )}
          {post.tags.slice(0, 3).map(t => (
            <button
              key={t}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onTag(t)
              }}
              className="tag-chip"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  return post.slug ? (
    <Link href={post.url} className="blog-row flex items-start justify-between py-4 gap-4 group">
      {inner}
    </Link>
  ) : (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="blog-row flex items-start justify-between py-4 gap-4 group"
    >
      {inner}
    </a>
  )
}
