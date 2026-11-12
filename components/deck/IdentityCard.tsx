import Link from 'next/link'
import { github, totalStars } from '@/lib/github'
import { FaGithub, FaStar, FaUsers } from 'react-icons/fa'

/**
 * Mobile identity card — the hero copy reimagined as the deck's first card,
 * SELA style: pastel role chips, compact data rows for the live GitHub
 * stats, and the nav items as black/outline buttons next to sponsor. "home"
 * stays off the card (the logo in the bar is home).
 */
export default function IdentityCard() {
  const rows = [
    { icon: <FaGithub size={12} />, label: 'public repos', value: String(github.user.publicRepos) },
    { icon: <FaStar size={12} />, label: 'stars earned', value: String(totalStars) },
    { icon: <FaUsers size={12} />, label: 'followers', value: String(github.user.followers) },
  ]

  return (
    <div>
      <h2 className="text-[34px] leading-none font-bold tracking-[-0.035em]">cyber.dach</h2>

      <div className="chips mt-4">
        <span>telecom engineer</span>
        <span>cybersecurity engineer</span>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[var(--muted)]">
        building resilient systems across networks, security, and software — and writing
        down what i learn along the way.
      </p>

      <div className="mt-5 border-t border-[var(--hairline)] pt-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2 py-1.5 text-[13px]">
            <span className="text-[var(--muted)]">{r.icon}</span>
            <span className="text-[var(--muted)]">{r.label}</span>
            <span className="ml-auto font-bold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link href="/projects" className="btn-solid text-center">
          projects
        </Link>
        <Link href="/blog" className="btn-line text-center">
          blog
        </Link>
        <Link href="/freelance" className="btn-line text-center">
          services
        </Link>
        <a
          href="https://github.com/sponsors/cyberd4ch"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-line text-center"
        >
          ♥ sponsor
        </a>
      </div>
    </div>
  )
}
