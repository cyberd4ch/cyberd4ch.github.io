import { activity, github } from '@/lib/github'

// Static JSON mirror of the home page feed, so the profile README can show the
// same activity without scraping HTML.
export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    generatedAt: github.generatedAt,
    activity: activity.map(event => ({
      title: event.title,
      detail: event.detail,
      url: event.url,
      repo: event.repo,
      at: event.at,
    })),
  })
}
