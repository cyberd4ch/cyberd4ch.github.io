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
    <section className="hero full-bleed relative flex min-h-[560px] flex-col overflow-hidden border-b border-[var(--border)] h-[86svh] max-h-[860px] max-md:h-[calc(100svh-72px)] max-md:max-h-none max-md:min-h-[440px]">
      {/* static parked rocket — shown when the live flight layer is off */}
      <div
        className="flight-fallback pointer-events-none absolute inset-x-0 top-[68px] h-[190px] max-md:top-[84px] max-md:origin-top-left max-md:scale-[0.72] md:top-0"
        aria-hidden="true"
      >
        <svg viewBox="0 0 120 190" width="120" height="190" className="absolute -left-4 top-0">
          <defs>
            <clipPath id="flight-fb-hull">
              <path d="M43 40 L77 40 L77 96 Q77 100 73 100 L47 100 Q43 100 43 96 Z" />
            </clipPath>
          </defs>

          {/* launch pad */}
          <g stroke="var(--fg)">
            <line x1="14" y1="130" x2="106" y2="130" strokeWidth="2.5" />
            <line x1="22" y1="130" x2="22" y2="137" strokeWidth="1.5" />
            <line x1="47" y1="130" x2="47" y2="137" strokeWidth="1.5" />
            <line x1="73" y1="130" x2="73" y2="137" strokeWidth="1.5" />
            <line x1="98" y1="130" x2="98" y2="137" strokeWidth="1.5" />
          </g>
          <circle cx="8" cy="127" r="2.2" fill="var(--red)" />
          <circle cx="112" cy="127" r="2.2" fill="var(--red)" />

          {/* fins + engine sit under the hull */}
          <path d="M45 72 L29 110 L45 106 Z" fill="var(--red)" stroke="var(--fg)" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M75 72 L91 110 L75 106 Z" fill="var(--red)" stroke="var(--fg)" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M49 100 L71 100 L75 116 L45 116 Z" fill="var(--fg)" stroke="var(--fg)" strokeWidth="1.75" strokeLinejoin="round" />

          {/* nose cone */}
          <path d="M60 2 Q73 10 76.5 28 L77 40 L43 40 L43.5 28 Q47 10 60 2 Z" fill="var(--red)" stroke="var(--fg)" strokeWidth="1.75" strokeLinejoin="round" />

          {/* hull, band, porthole */}
          <path d="M43 40 L77 40 L77 96 Q77 100 73 100 L47 100 Q43 100 43 96 Z" fill="var(--rocket-hull)" />
          <rect x="43" y="40" width="34" height="14" fill="var(--red)" clipPath="url(#flight-fb-hull)" />
          <path d="M43 40 L77 40 L77 96 Q77 100 73 100 L47 100 Q43 100 43 96 Z" fill="none" stroke="var(--fg)" strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="60" cy="68" r="6.5" fill="var(--blue-bright)" stroke="var(--fg)" strokeWidth="2" />
          <circle cx="58" cy="66" r="1.6" fill="var(--rocket-hull)" />
        </svg>
      </div>

      {/* ship fleet forms the portrait over the hero (see ShipCanvas) */}

      {/* overlay copy — plain DOM, always readable. on phones the title block
          hides: the first screen is the portrait + telemetry only, and the copy
          rides the deck's identity card instead (components/deck) */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[680px] flex-1 flex-col px-6 max-md:justify-between">
        {/* top telemetry */}
        <div className="flex items-center justify-between pt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <span className="cursor">mission control</span>
          <LocalClock />
        </div>

        {/* title block */}
        <div className="hero-copy flex flex-1 flex-col justify-center py-10 max-md:hidden">
          <p className="hud-label mb-3">// mission brief</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            cyber.dach
          </h1>
          <p className="mt-3 text-sm sm:text-base">
            telecom engineer <span className="text-[var(--muted)]">×</span> cybersecurity engineer
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

        {/* bottom telemetry — the stage (DeckStage) swaps it for the
            propeller affordance, see globals.css [data-stage] */}
        <div className="hero-foot flex items-center justify-between pb-4 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
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
