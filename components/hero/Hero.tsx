'use client'

import Link from 'next/link'
import { github, repos, totalStars } from '@/lib/github'

/**
 * The hero — SELA style: big Alte Haas display type, black on paper, pastel
 * stat chips, dotted-outline actions. The ship fleet (ShipCanvas) forms the
 * portrait over this section; there is no other furniture here.
 */
export default function Hero() {
  const stats = [
    `${github.user.publicRepos} repos`,
    `${totalStars} stars`,
    `${github.user.followers} followers`,
  ]

  return (
    <section className="hero full-bleed relative flex min-h-[420px] flex-col overflow-hidden h-[86svh] max-h-[900px] max-md:h-[calc(100svh-64px)] max-md:max-h-none max-md:min-h-[440px]">
      {/* ship fleet forms the portrait over the hero (see ShipCanvas) */}

      {/* overlay copy — plain DOM, always readable. on phones the title block
          hides: the first screen is the portrait only, and the copy rides the
          deck's identity card instead (components/deck) */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[680px] flex-1 flex-col justify-center px-6">
        <div className="hero-copy flex flex-col justify-center py-8 max-md:hidden">
          <h1 className="text-[44px] leading-[1.02] tracking-[-0.035em] sm:text-6xl md:text-[76px]">
            cyber.dach
          </h1>
          <p className="mt-4 text-lg tracking-[-0.02em] sm:text-xl">
            telecom engineer <span className="text-[var(--muted)]">×</span> cybersecurity engineer
          </p>
          <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-[var(--muted)]">
            building resilient systems across networks, security, and software — and writing
            down what i learn along the way.
          </p>

          <div className="chips pointer-events-auto mt-6 max-w-[420px]">
            {stats.map(s => (
              <span key={s}>{s}</span>
            ))}
          </div>

          <div className="pointer-events-auto mt-7 flex flex-wrap items-center gap-3">
            <Link href="/projects" className="btn-solid">
              view projects →
            </Link>
            <Link href="/blog" className="btn-line">
              read the blog
            </Link>
            <a
              href="https://github.com/sponsors/cyberd4ch"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-line"
            >
              ♥ sponsor
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
