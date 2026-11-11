import Link from 'next/link'
import { github, totalStars } from '@/lib/github'

/**
 * Mobile identity card — the hero copy reimagined as the deck's first card.
 * The nav items that leave the phone navbar (projects / blog / services)
 * become its action buttons next to sponsor; "home" stays off the card
 * (the logo in the bar is home). Replaces the old view projects / read the
 * blog link pair on small screens.
 */
export default function IdentityCard() {
  const stats = [
    `${github.user.publicRepos} repos`,
    `${totalStars} stars`,
    `${github.user.followers} followers`,
  ]

  return (
    <div>
      <p className="hud-label mb-3">// mission brief</p>
      <h2 className="text-4xl font-semibold tracking-tight">cyber.dach</h2>
      <p className="mt-3 text-sm">
        telecom engineer <span className="text-[var(--muted)]">×</span> cybersecurity engineer
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
        building resilient systems across networks, security, and software — and writing
        down what i learn along the way.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {stats.map(s => (
          <span
            key={s}
            className="border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/projects"
          className="bg-[var(--red)] px-3 py-2.5 text-center text-sm font-medium text-[var(--on-red)] transition-opacity hover:opacity-85"
        >
          projects
        </Link>
        <Link
          href="/blog"
          className="border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--fg)]"
        >
          blog
        </Link>
        <Link
          href="/freelance"
          className="border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--fg)]"
        >
          services
        </Link>
        <a
          href="https://github.com/sponsors/cyberd4ch"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[var(--border)] px-3 py-2.5 text-center text-sm transition-colors hover:border-[var(--red)]"
        >
          ♥ sponsor
        </a>
      </div>
    </div>
  )
}
