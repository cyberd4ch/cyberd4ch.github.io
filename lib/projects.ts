export type ProjectCategory = 'open source' | 'personal' | 'work'

export interface Project {
  id: string
  name: string
  category: ProjectCategory
  description: string
  stack: string[]
  github?: string
  live?: string
  featured?: boolean
}

export const projects: Project[] = [
  {
    id: 'cportscan',
    name: 'cportscan',
    category: 'open source',
    description: 'a fast, lightweight port scanner written in C. uses raw sockets and multithreaded scanning to enumerate open ports on a target host with minimal overhead.',
    stack: ['C', 'POSIX sockets', 'pthreads'],
    github: 'https://github.com/cyberd4ch/cportscan',
    featured: true,
  },
  {
    id: 'handyman',
    name: 'Handyman',
    category: 'personal',
    description: 'a utility platform for on-demand home service bookings. connecting skilled tradespeople to clients through a streamlined digital marketplace.',
    stack: ['Next.js', 'TypeScript', 'Node.js', 'PostgreSQL'],
    live: 'https://cyberdach.bearblog.dev/handyman.io',
    featured: true,
  },
  {
    id: 'network-monitor',
    name: 'net-watch',
    category: 'personal',
    description: 'a real-time network traffic monitor and anomaly detector built for linux. visualises packet flows, flags suspicious behaviour and logs alerts.',
    stack: ['Python', 'libpcap', 'Flask', 'Chart.js'],
    github: 'https://github.com/cyberd4ch',
    featured: false,
  },
  {
    id: 'dns-resolver',
    name: 'dns-resolve',
    category: 'open source',
    description: 'a minimal dns resolver from scratch in python to understand the dns protocol internals. supports A, AAAA, MX, and CNAME record lookups.',
    stack: ['Python', 'UDP/TCP', 'DNS protocol'],
    github: 'https://github.com/cyberd4ch',
    featured: false,
  },
  {
    id: 'sec-dashboard',
    name: 'SecDash',
    category: 'work',
    description: 'an internal security operations dashboard for monitoring network health indicators, incident tickets, and threat feeds in real time.',
    stack: ['React', 'Node.js', 'MongoDB', 'Express'],
    featured: false,
  },
]