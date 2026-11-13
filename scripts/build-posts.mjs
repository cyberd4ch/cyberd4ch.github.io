/**
 * Build data/posts.json from content/blog/*.md frontmatter — the same pattern
 * as fetch-github.mjs: the site reflects the content files rather than a
 * hand-maintained list. Runs before `next build` (npm prebuild + a step in the
 * Pages workflow), so publishing a post is: drop an .md with frontmatter,
 * rebuild. Read time is derived from the body word count.
 *
 * Frontmatter keys: title, date (ISO), category, ai-assist (0-100, optional —
 * the share of the published text that came from AI drafts; human% = 100−n),
 * tags[], topics[], excerpt. Parsing is deliberately tiny (no yaml dep).
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'content', 'blog')
const OUT = path.join(process.cwd(), 'data', 'posts.json')
const WORDS_PER_MIN = 220

/** minimal frontmatter parser: `key: value` lines between --- fences */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { meta: {}, body: text }
  const end = text.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: text }
  const block = text.slice(3, end)
  const body = text.slice(text.indexOf('\n', end + 1) + 1)
  const meta = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-z-]+):\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[m[1]] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (value.startsWith('"') && value.endsWith('"')) {
      meta[m[1]] = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else if (/^\d+$/.test(value)) {
      meta[m[1]] = Number(value)
    } else {
      meta[m[1]] = value
    }
  }
  return { meta, body }
}

const files = fs
  .readdirSync(DIR)
  .filter(f => f.endsWith('.md'))
  .sort()

const posts = []
for (const file of files) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8')
  const { meta, body } = parseFrontmatter(raw)
  const slug = file.replace(/\.md$/, '')
  if (!meta.title || !meta.date) {
    console.warn(`[posts] ${file}: missing title/date frontmatter — skipped`)
    continue
  }
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`_\[\]()!-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  posts.push({
    id: slug,
    slug,
    title: meta.title,
    date: new Date(`${meta.date}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    dateISO: meta.date,
    category: meta.category || 'technical',
    url: `/blog/${slug}/`,
    excerpt: meta.excerpt || '',
    /** 0-100: how much of the published text is the AI draft as written.
        absent/null = hand-written or not yet assessed — no ring. */
    aiAssist: typeof meta['ai-assist'] === 'number' ? meta['ai-assist'] : null,
    tags: meta.tags || [],
    topics: meta.topics || [],
    readMinutes: Math.max(1, Math.round(words / WORDS_PER_MIN)),
  })
}

posts.sort((a, b) => b.dateISO.localeCompare(a.dateISO))
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(posts, null, 2)}\n`)
console.log(`[posts] ${posts.length} posts → ${path.relative(process.cwd(), OUT)}`)
