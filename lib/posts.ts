export type BlogCategory = 'technical' | 'general'

export interface Post {
  id: string
  title: string
  date: string
  dateISO: string
  category: BlogCategory
  url: string
  excerpt?: string
  /** present when the article is rendered by this site at /blog/<slug>/ */
  slug?: string
}

export const posts: Post[] = [
  {
    id: 'announcing-dnswatch-v1-1-0',
    slug: 'announcing-dnswatch-v1-1-0',
    title: "announcing dns-watch v1.1.0: your attack surface's DNS, diffed — for free",
    date: 'Nov 7, 2026',
    dateISO: '2026-11-07',
    category: 'technical',
    url: '/blog/announcing-dnswatch-v1-1-0/',
    excerpt:
      'release notes for a one-file DNS drift watcher: one cron line, a readable log, no dashboard, no API keys, no subscription.',
  },
  {
    id: 'one-curl-per-host',
    slug: 'one-curl-per-host',
    title: 'one curl per host: mapping a hardened SSO estate without tripping the alarm',
    date: 'Nov 7, 2026',
    dateISO: '2026-11-07',
    category: 'technical',
    url: '/blog/one-curl-per-host/',
    excerpt:
      'nineteen hosts, one administrative suffix, one HTTPS request each — how redirect headers turned a "nothing here" estate into a map.',
  },
  {
    id: 'building-dns-watch',
    slug: 'building-dns-watch',
    title: "when dig lies: building a DNS drift watcher that survives a NAT'd VM",
    date: 'Nov 7, 2026',
    dateISO: '2026-11-07',
    category: 'technical',
    url: '/blog/building-dns-watch/',
    excerpt:
      'five rebuilds, three false walls, and the two design decisions that make a diff trustworthy instead of merely present.',
  },
  {
    id: 'when-templates-find-zero',
    slug: 'when-templates-find-zero',
    title: 'six thousand templates, zero findings — and other useful lies about hardened targets',
    date: 'Nov 7, 2026',
    dateISO: '2026-11-07',
    category: 'technical',
    url: '/blog/when-templates-find-zero/',
    excerpt:
      '6,665 templates across 16,055 requests matched nothing. that result is data, not a dead end.',
  },
  {
    id: 'dns-attacks',
    title: 'understanding dns protocol attacks',
    date: 'Apr 21, 2026',
    dateISO: '2026-04-21',
    category: 'technical',
    url: 'https://cyberdach.bearblog.dev/the-internets-address-book-under-fire-understanding-dns-protocol-attacks/',
    excerpt:
      'a deep dive into DNS amplification, cache poisoning, and zone transfer attacks — how they work and how to defend against them.',
  },
  {
    id: 'cs-worth',
    title: 'computer science, is it worth anything anymore?',
    date: 'Apr 17, 2026',
    dateISO: '2026-04-17',
    category: 'general',
    url: 'https://cyberdach.bearblog.dev/computer-science-is-it-worth-anything-anymore/',
    excerpt:
      'on the commodification of the CS degree and what actually matters for engineers building real systems.',
  },
]
