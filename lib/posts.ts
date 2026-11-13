import snapshot from '@/data/posts.json'

export type BlogCategory = 'technical' | 'general'

export interface Post {
  id: string
  slug: string
  title: string
  date: string
  dateISO: string
  category: BlogCategory
  url: string
  excerpt?: string
  /** 0-100: how much of the published text is the AI draft as written.
      human share = 100 − aiAssist. null = hand-written / not assessed. */
  aiAssist: number | null
  tags: string[]
  topics: string[]
  /** derived at build time from the body word count (220 wpm) */
  readMinutes: number
}

export const posts = snapshot as Post[]

/** every tag in use, by frequency then alphabetically */
export const allTags = Array.from(
  posts.reduce((acc, post) => {
    for (const tag of post.tags) acc.set(tag, (acc.get(tag) || 0) + 1)
    return acc
  }, new Map<string, number>()),
)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([tag]) => tag)

/** every topic in use, by frequency then alphabetically — the blog's collections */
export const allTopics = Array.from(
  posts.reduce((acc, post) => {
    for (const topic of post.topics) acc.set(topic, (acc.get(topic) || 0) + 1)
    return acc
  }, new Map<string, number>()),
)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([topic]) => topic)
