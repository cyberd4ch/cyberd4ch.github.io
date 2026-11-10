export interface CuratedProject {
  id: string
  name: string
  description: string
  /** internal route ("/blog/...") or absolute URL */
  url: string
  tags: string[]
  status: string
}

/**
 * Hand-curated work that is not a public GitHub repo — research, engagements and
 * write-ups. The projects page renders these above the auto-synced repo list.
 */
export const curatedProjects: CuratedProject[] = [
  {
    id: 'bug-bounty-research',
    name: 'bug-bounty research',
    description:
      'Nonce-laundering XSS and pre-2FA token timing from an authorized engagement: a server-side deeplink trace, a reusable CSP-bypass report template, and desk research on the programs that actually pay for the class.',
    url: '/blog/bounty-program-landscape/',
    tags: ['security', 'web', 'research'],
    status: 'ongoing',
  },
  {
    id: 'security-toolkit',
    name: 'security-toolkit',
    description:
      'Dependency-free tooling for the nonce-laundering bug class: nonce_scan.py flags nonce-copy helpers, script-literal interpolation and DOM sinks; bundle_fetch.sh is a reproducible, rate-limited recon fetcher. MIT licensed.',
    url: 'https://github.com/cyberd4ch/security-toolkit',
    tags: ['security', 'tooling', 'python'],
    status: 'shipped',
  },
  {
    id: 'basecamp-recon',
    name: 'basecamp / hey recon',
    description:
      'Public-surface recon for the Basecamp/HEY program: what the marketing site exposes (no CSP nonce at all), and why the nonce-laundering class only becomes testable once the authenticated app is in reach.',
    url: '/blog/bounty-program-landscape/',
    tags: ['security', 'recon', 'research'],
    status: 'ongoing',
  },
]
