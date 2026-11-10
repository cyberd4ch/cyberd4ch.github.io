import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { caseStudies } from '@/lib/caseStudies'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }))
}

function getCaseStudy(slug: string) {
  const study = caseStudies.find((c) => c.slug === slug)
  if (!study) return null
  const file = path.join(process.cwd(), 'content', 'freelance', `${slug}.md`)
  if (!fs.existsSync(file)) return null
  return { study, body: fs.readFileSync(file, 'utf8') }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = getCaseStudy(slug)
  if (!found) return { title: 'case study not found — cyber.dach' }
  return {
    title: `${found.study.title} — cyber.dach`,
    description: found.study.summary,
  }
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params
  const found = getCaseStudy(slug)
  if (!found) notFound()

  return (
    <article className="stagger-1">
      <Link href="/freelance/" className="text-xs text-[var(--muted)] underline-link">
        ← services
      </Link>

      <header className="mt-5 mb-8">
        <p className="text-xs text-[var(--muted)] mb-2">case study</p>
        <h1 className="text-2xl font-medium leading-snug">{found.study.title}</h1>
        <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">{found.study.summary}</p>
      </header>

      <div className="post">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{found.body}</ReactMarkdown>
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--border)]">
        <Link href="/freelance/" className="text-sm underline-link">
          ← back to services
        </Link>
      </div>
    </article>
  )
}
