import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import PageCol from '@/components/PageCol'
import AIRing from '@/components/blog/AIRing'
import LikeButton from '@/components/blog/LikeButton'
import ViewCounter from '@/components/blog/ViewCounter'
import { posts } from '@/lib/posts'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return posts.filter((p) => p.slug).map((p) => ({ slug: p.slug as string }))
}

function getPost(slug: string) {
  const post = posts.find((p) => p.slug === slug)
  if (!post) return null
  const file = path.join(process.cwd(), 'content', 'blog', `${slug}.md`)
  if (!fs.existsSync(file)) return null
  const raw = fs.readFileSync(file, 'utf8')
  // strip the frontmatter block — metadata renders in the header, not the body
  const body = raw.startsWith('---') ? raw.slice(raw.indexOf('\n---', 3) + 4).replace(/^\n/, '') : raw
  return { post, body }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = getPost(slug)
  if (!found) return { title: 'post not found — cyber.dach' }
  return {
    title: `${found.post.title} — cyber.dach`,
    description: found.post.excerpt,
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const found = getPost(slug)
  if (!found) notFound()

  return (
    <PageCol>
      <article className="stagger-1">
        <Link href="/blog" className="text-xs text-[var(--muted)] underline-link">
          ← all posts
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs text-[var(--muted)] mb-2">
            {found.post.date} · <span className="text-[var(--label)]">{found.post.category}</span> ·{' '}
            {found.post.readMinutes} min read
          </p>
          <h1 className="text-2xl font-medium leading-snug">{found.post.title}</h1>
          {found.post.excerpt && (
            <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">{found.post.excerpt}</p>
          )}
          {/* provenance + filing: the AI-assist ring (full = published as the
              AI drafted it; the gap is the human share) and the archive
              metadata the blog sorts by */}
          <div className="blog-meta mt-4">
            {found.post.aiAssist != null && <AIRing pct={found.post.aiAssist} size={15} label />}
            <ViewCounter slug={found.post.slug} />
            <LikeButton slug={found.post.slug} />
            {found.post.topics.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                topics:
              </span>
            )}
            {found.post.topics.map(t => (
              <span key={t} className="tag-chip static">
                {t}
              </span>
            ))}
            {found.post.tags.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                tags:
              </span>
            )}
            {found.post.tags.map(t => (
              <span key={t} className="tag-chip static">
                {t}
              </span>
            ))}
          </div>
        </header>

        <div className="post">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{found.body}</ReactMarkdown>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <Link href="/blog" className="text-sm underline-link">
            ← back to the blog
          </Link>
        </div>
      </article>
    </PageCol>
  )
}
