export type BlogCategory = 'technical' | 'general'

export interface Post {
  id: string
  title: string
  date: string
  category: BlogCategory
  url: string
  excerpt?: string
}

export const posts: Post[] = [
  {
    id: 'dns-attacks',
    title: 'understanding dns protocol attacks',
    date: 'Apr 21, 2026',
    category: 'technical',
    url: 'https://cyberdach.bearblog.dev/the-internets-address-book-under-fire-understanding-dns-protocol-attacks/',
    excerpt: 'a deep dive into DNS amplification, cache poisoning, and zone transfer attacks — how they work and how to defend against them.',
  },
  {
    id: 'cs-worth',
    title: 'computer science, is it worth anything anymore?',
    date: 'Apr 17, 2026',
    category: 'general',
    url: 'https://cyberdach.bearblog.dev/computer-science-is-it-worth-anything-anymore/',
    excerpt: 'on the commodification of the CS degree and what actually matters for engineers building real systems.',
  },
]
