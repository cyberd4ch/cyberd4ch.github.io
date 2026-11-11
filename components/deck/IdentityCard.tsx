import Link from 'next/link'
import { github, totalStars } from '@/lib/github'
import { FaGithub, FaStar, FaUsers } from 'react-icons/fa'

/**
 * Mobile identity card — the hero copy reimagined as the deck's first card,
 * restyled on the watermelon profile-card: tinted pill chips for the roles,
 * compact icon+label/value data rows for the live GitHub stats, and the nav
 * items that leave the phone navbar (projects / blog / services) as its
 * action buttons next to sponsor. "home" stays off the card (the logo in
 * the bar is home). Replaces the old view projects / read the blog link
 * pair on small screens.
 */
export default function IdentityCard() {
  const rows = [
    { icon: <FaGithub size={12} />, label: 'public repos', value: String(github.user.publicRepos) },
    { icon: <FaStar size={12} />, label: 'stars earned', value: String(totalStars) },
    { icon: <FaUsers size={12} />, label: 'followers', value: String(github.user.followers) },
  ]

  return (
    <div>
      <h2 className="text-4xl font-semibold tracking-tight">cyber.dach</h2>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[var(--red)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--red)]">
          telecom engineer
        </span>
        <span className="rounded-full border border-[var(--red)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--red)]">
          cybersecurity engineer
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
        building resilient systems across networks, security, and software — and writing
        down what i learn along the way.
      </p>

      <div className="mt-4 border-t border-[var(--border)] pt-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2 py-1.5 text-[13px]">
            <span className="text-[var(--muted)]">{r.icon}</span>
            <span className="text-[var(--muted)]">{r.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/projects"
          className="rounded-lg bg-[var(--red)] px-3 py-2.5 text-center text-sm font-medium text-[var(--on-red)] transition-opacity hover:opacity-85"
        >
          projects
        </Link>
        <Link
          href="/blog"
          className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--fg)]"
        >
          blog
        </Link>
        <Link
          href="/freelance"
          className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--fg)]"
        >
          services
        </Link>
        <a
          href="https://github.com/sponsors/cyberd4ch"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--red)]"
        >
          ♥ sponsor
        </a>
      </div>
    </div>
  )
}
