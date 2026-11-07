import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  return { post, body: fs.readFileSync(file, 'utf8') }
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
    <article className="stagger-1">
      <Link href="/blog" className="text-xs text-[var(--muted)] underline-link">
        ← all posts
      </Link>

      <header className="mt-5 mb-8">
        <p className="text-xs text-[var(--muted)] mb-2">
          {found.post.date} · {found.post.category}
        </p>
        <h1 className="text-2xl font-medium leading-snug">{found.post.title}</h1>
        {found.post.excerpt && (
          <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">{found.post.excerpt}</p>
        )}
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
  )
}
