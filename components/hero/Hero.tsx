'use client'

import Link from 'next/link'
import { github, repos, totalStars } from '@/lib/github'
import LocalClock from '@/components/LocalClock'

const phrases = [
  'signal nominal',
  'telecom × security × code',
  'painted in real time',
  'paper trails kept',
  'scroll = throttle up',
  'flight line est. 2026',
  'systems resilient',
]

function TickerSegment() {
  return (
    <span className="ticker-seg">
      {phrases.map((p, i) => (
        <span key={i} className="inline-flex items-center">
          <span className="text-[var(--blue-bright)]">{p}</span>
          <span className="px-5 text-[var(--red)]">▸</span>
        </span>
      ))}
    </span>
  )
}

export default function Hero() {
  const stats = [
    `${github.user.publicRepos} repos`,
    `${totalStars} stars`,
    `${github.user.followers} followers`,
  ]

  return (
    <section className="hero full-bleed relative flex min-h-[560px] flex-col overflow-hidden border-b border-[var(--border)] h-[86svh] max-h-[860px]">
      {/* static squiggle — shown when the live paint layer is off */}
      <div className="paint-fallback absolute inset-x-0 top-0 h-[190px]" aria-hidden="true">
        <svg viewBox="0 0 1200 190" preserveAspectRatio="none" className="h-full w-full">
          <path
            d="M -20 36 C 180 -14, 360 120, 590 74 C 670 58, 900 185, 1220 140"
            fill="none"
            stroke="var(--red)"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ship fleet forms the portrait over the hero (see ShipCanvas) */}

      {/* overlay copy — plain DOM, always readable */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[680px] flex-1 flex-col px-6">
        {/* top telemetry */}
        <div className="flex items-center justify-between pt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <span className="cursor">mission control</span>
          <LocalClock />
        </div>

        {/* title block */}
        <div className="hero-copy flex flex-1 flex-col justify-center py-10">
          <p className="hud-label mb-3">// mission brief</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            cyber.dach
          </h1>
          <p className="mt-3 text-sm sm:text-base">
            telecom engineer <span className="text-[var(--muted)]">×</span> cybersecurity expert
          </p>
          <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-[var(--muted)] sm:text-sm">
            building resilient systems across networks, security, and software — and writing
            down what i learn along the way.
          </p>

          <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-2">
            {stats.map(s => (
              <span
                key={s}
                className="border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--red)]"
              >
                {s}
              </span>
            ))}
          </div>

          <div className="pointer-events-auto mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/projects"
              className="bg-[var(--red)] px-4 py-2 text-sm font-medium text-[var(--on-red)] transition-opacity hover:opacity-85"
            >
              view projects →
            </Link>
            <Link href="/blog" className="text-sm underline-link">
              read the blog →
            </Link>
            <a
              href="https://github.com/sponsors/cyberd4ch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline-link"
            >
              ♥ sponsor
            </a>
          </div>
        </div>

        {/* bottom telemetry */}
        <div className="flex items-center justify-between pb-4 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <span className="flex items-center gap-2">
            sig
            <span className="beacon inline-block h-1.5 w-1.5 rounded-full bg-[var(--red)]" aria-hidden="true" />
            nominal
          </span>
          <span aria-hidden="true">telemetry ↓</span>
        </div>
      </div>

      {/* retro ticker strip */}
      <div className="ticker relative z-10" aria-hidden="true">
        <div className="ticker-track">
          <TickerSegment />
          <TickerSegment />
        </div>
      </div>
    </section>
  )
}
