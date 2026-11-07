/**
 * Snapshot the public GitHub account into data/github.json.
 *
 * Runs before `next build` (locally and in the Pages workflow) so the site is a
 * reflection of the account rather than a hand-maintained list. A scheduled run
 * of the workflow refreshes it, which is how new activity reaches the site.
 *
 * Network/API failures are non-fatal: the previously committed snapshot is kept.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const USER = process.env.GITHUB_USER || 'cyberd4ch'
const OUT = path.join(process.cwd(), 'data', 'github.json')

// The profile-README repo and this site itself are not portfolio projects.
const EXCLUDE = new Set([USER, `${USER}.github.io`])

// Stars/forks/watches are noise in a "what is he building" feed.
const NOISE = new Set(['WatchEvent', 'ForkEvent', 'PublicEvent'])

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USER}-portfolio`,
  'X-GitHub-Api-Version': '2022-11-28',
}
if (token) headers.Authorization = `Bearer ${token}`

async function api(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

function describe(event) {
  const repo = event.repo?.name || ''
  const repoUrl = `https://github.com/${repo}`
  const p = event.payload || {}
  const base = { type: event.type, repo, repoUrl, at: event.created_at }

  switch (event.type) {
    case 'PushEvent': {
      const commits = p.commits || []
      const branch = (p.ref || '').replace('refs/heads/', '')
      const subject = commits[commits.length - 1]?.message?.split('\n')[0] || ''
      // Public events often omit commit detail; `size` is still the real count.
      const count = typeof p.size === 'number' ? p.size : commits.length
      return {
        ...base,
        title: count > 0 ? `pushed ${count} commit${count === 1 ? '' : 's'} to ${repo}` : `pushed to ${repo}`,
        detail: branch ? `${branch}${subject ? ` — ${subject}` : ''}` : subject,
        url: commits.length ? `${repoUrl}/commit/${commits[commits.length - 1].sha}` : `${repoUrl}/commits`,
      }
    }
    case 'ReleaseEvent':
      return {
        ...base,
        title: `released ${p.release?.tag_name || 'a version'} in ${repo}`,
        detail: p.release?.name || '',
        url: p.release?.html_url || `${repoUrl}/releases`,
      }
    case 'PullRequestEvent': {
      const pr = p.pull_request || {}
      const action = p.action === 'closed' && pr.merged_at ? 'merged' : p.action
      return {
        ...base,
        title: `${action} pull request #${p.number} in ${repo}`,
        detail: pr.title || '',
        url: pr.html_url || repoUrl,
      }
    }
    case 'IssuesEvent':
      return {
        ...base,
        title: `${p.action} issue #${p.issue?.number} in ${repo}`,
        detail: p.issue?.title || '',
        url: p.issue?.html_url || repoUrl,
      }
    case 'IssueCommentEvent':
      return {
        ...base,
        title: `commented on #${p.issue?.number} in ${repo}`,
        detail: p.issue?.title || '',
        url: p.comment?.html_url || p.issue?.html_url || repoUrl,
      }
    case 'CreateEvent':
      return {
        ...base,
        title: `created ${p.ref_type}${p.ref ? ` ${p.ref}` : ''} in ${repo}`,
        detail: '',
        url: repoUrl,
      }
    default:
      return null
  }
}

/** Pinned repositories, in the order they appear on the profile. Needs a token. */
async function fetchPinned() {
  if (!token) return []
  const query = `query($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes { ... on Repository { name } }
      }
    }
  }`
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for graphql pinnedItems`)
  const json = await res.json()
  const nodes = json.data?.user?.pinnedItems?.nodes || []
  return nodes.map(node => node?.name).filter(Boolean)
}

async function main() {
  if (!token) {
    console.warn('[github] no GITHUB_TOKEN set — using anonymous rate limits (60/hr)')
  }

  const [user, rawRepos, rawEvents, pinned] = await Promise.all([
    api(`https://api.github.com/users/${USER}`),
    api(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`),
    api(`https://api.github.com/users/${USER}/events/public?per_page=50`),
    // Pinning is optional polish; a failure must not lose repos/activity.
    fetchPinned().catch(err => {
      console.warn(`[github] pinned lookup skipped: ${err.message}`)
      return []
    }),
  ])

  const publicRepos = rawRepos
    .filter(r => !r.fork && !r.archived && !EXCLUDE.has(r.name))
    .map(r => ({
      name: r.name,
      description: r.description || '',
      url: r.html_url,
      homepage: r.homepage || '',
      language: r.language || '',
      topics: r.topics || [],
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
      createdAt: r.created_at,
      pinned: false,
    }))
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))

  // Pinned repos lead the list in profile order; the rest stay newest-push first.
  const byName = new Map(publicRepos.map(repo => [repo.name, repo]))
  const pinnedRepos = pinned.map(name => byName.get(name)).filter(Boolean)
  const repos = [
    ...pinnedRepos.map(repo => ({ ...repo, pinned: true })),
    ...publicRepos.filter(repo => !repo.pinned && !pinnedRepos.some(p => p.name === repo.name)),
  ]

  const seen = new Set()
  const activity = rawEvents
    .filter(e => !NOISE.has(e.type))
    .map(describe)
    .filter(Boolean)
    .filter(e => {
      const key = `${e.type}:${e.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 12)

  const snapshot = {
    generatedAt: new Date().toISOString(),
    user: {
      login: user.login,
      name: user.name || user.login,
      bio: user.bio || '',
      avatarUrl: user.avatar_url,
      url: user.html_url,
      publicRepos: user.public_repos,
      followers: user.followers,
    },
    pinned,
    repos,
    activity,
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`[github] ${repos.length} repos, ${activity.length} activity items → ${path.relative(process.cwd(), OUT)}`)
}

main().catch(err => {
  // Keep the committed snapshot rather than failing the deploy.
  console.warn(`[github] sync failed, keeping existing snapshot: ${err.message}`)
  process.exit(0)
})
