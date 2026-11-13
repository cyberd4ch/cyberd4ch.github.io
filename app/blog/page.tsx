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
 * The blog rendered like SELA's logo archive: entries grouped into
 * collections, each entry carrying the archive's signature brief
 * description under its name, plus the working metadata — read time, the
 * AI-assist ring (full ring = published as the AI drafted it; the gap is the
 * human share) and the topics it qualifies under. A "latest" staging area
 * lists the most recent releases whenever no filter is active.
 */
const TOPIC_PREVIEW = 6 // few topic chips at a time; "+N" reveals the rest

export default function BlogPage() {
  const [category, setCategory] = useState<Filter>('all')
  const [topic, setTopic] = useState<string>('all')
  const [tag, setTag] = useState<string>('all')
  const [topicsOpen, setTopicsOpen] = useState(false)

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

  // collections present in the filtered set, biggest first
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

  // the staging area: the most recent releases, shown while no filter is on
  const unfiltered = category === 'all' && topic === 'all' && tag === 'all'
  const latest = useMemo(
    () => [...posts].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 5),
    [],
  )

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

      {/* collections — the archive sections (was "chapters") */}
      <div className="flex flex-wrap items-center gap-1 mb-3 stagger-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mr-1">
          collections
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

      {/* topics — the tag vocabulary, a few at a time with "+N" for the rest */}
      <div className="flex flex-wrap items-center gap-1.5 mb-8 stagger-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mr-1">
          topics
        </span>
        {(topicsOpen ? allTags : allTags.slice(0, TOPIC_PREVIEW)).map(t => (
          <button
            key={t}
            onClick={() => pickTag(t)}
            className={`tag-chip ${tag === t ? 'active' : ''}`}
          >
            {t}
          </button>
        ))}
        {allTags.length > TOPIC_PREVIEW && (
          <button
            onClick={() => setTopicsOpen(o => !o)}
            className="tag-chip text-[var(--muted)]"
            aria-expanded={topicsOpen}
          >
            {topicsOpen ? '· less' : `+${allTags.length - TOPIC_PREVIEW}`}
          </button>
        )}
      </div>

      {/* the staging area: latest releases (only while nothing is filtered) */}
      {unfiltered && latest.length > 0 && (
        <section className="mb-10 stagger-2">
          <div className="chapter-head">
            <h2 className="sec-label">
              latest <span className="chapter-count">( {latest.length} )</span>
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {latest.map(post => (
              <LatestRow key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-[var(--muted)] py-4">no posts match this filter.</p>
      )}

      {/* chapters + entries */}
      {groups.map(([chapter, list]) => (
        <section key={chapter} className="stagger-3 mb-10">
          <div className="chapter-head">
            <h2 className="sec-label">
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

function LatestRow({ post }: { post: Post }) {
  /* the staging manifest: date, title, length — no index, no excerpt, a
     tighter row than the archive so the two lists read differently */
  const inner = (
    <>
      <span className="text-[11px] text-[var(--muted)] w-24 shrink-0 pt-0.5 tabular-nums">
        {post.date}
      </span>
      <span className="flex-1 min-w-0 text-sm underline-link group-hover:text-[var(--fg)]">
        {post.title}
      </span>
      <span className="text-[11px] text-[var(--muted)] shrink-0 pt-0.5">{post.readMinutes} min</span>
    </>
  )
  return post.slug ? (
    <Link href={post.url} className="blog-row flex items-baseline justify-between py-2.5 gap-4 group">
      {inner}
    </Link>
  ) : (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="blog-row flex items-baseline justify-between py-2.5 gap-4 group"
    >
      {inner}
    </a>
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
