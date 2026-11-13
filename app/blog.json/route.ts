import { posts } from '@/lib/posts'

// Static JSON so external consumers (the profile README sync) read the same
// article list the site renders, instead of scraping HTML.
export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    posts: posts.map(post => ({
      title: post.title,
      url: post.url,
      date: post.date,
      dateISO: post.dateISO,
      category: post.category,
      excerpt: post.excerpt ?? '',
      external: post.url.startsWith('http'),
      readMinutes: post.readMinutes,
      aiAssist: post.aiAssist,
      tags: post.tags,
      topics: post.topics,
    })),
  })
}
