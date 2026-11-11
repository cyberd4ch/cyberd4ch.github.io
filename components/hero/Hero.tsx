'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { github, repos, totalStars } from '@/lib/github'
import MarkGlyph from '@/components/MarkGlyph'
import LocalClock from '@/components/LocalClock'

/** Three.js never runs on the server — static export stays clean. */
const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false })

type Mode = 'loading' | '3d' | 'static'

export default function Hero() {
  const [mode, setMode] = useState<Mode>('loading')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Reduced motion: no animation at all — static console.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode('static')
      return
    }
    // No WebGL: static console (the scene double-checks and can also fail over).
    try {
      const probe = document.createElement('canvas')
      const ok = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
      setMode(ok ? '3d' : 'static')
    } catch {
      setMode('static')
    }
  }, [])

  const stats = [
    `${github.user.publicRepos} repos`,
    `${totalStars} stars`,
    `${github.user.followers} followers`,
  ]

  return (
    <section className="hero full-bleed relative flex min-h-[560px] flex-col overflow-hidden border-b border-[var(--border)] h-[86svh] max-h-[860px]">
      {/* backdrop — CSS starfield shows while loading and in static mode */}
      {mode !== '3d' && <div className="starfield absolute inset-0" aria-hidden="true" />}
      {mode !== '3d' && (
        <div className="absolute inset-0 flex items-start justify-center pt-[12%]" aria-hidden="true">
          <MarkGlyph size={220} className="w-36 text-[var(--fg)] opacity-90 sm:w-44 md:w-52" />
        </div>
      )}

      {/* live 3D backdrop, faded in once the first frame is on screen */}
      {mode === '3d' && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
        >
          <HeroScene onReady={() => setReady(true)} onFail={() => setMode('static')} />
        </div>
      )}

      {/* overlay copy — plain DOM, always readable */}
      <div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-[680px] flex-col px-6">
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
                className="border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]"
              >
                {s}
              </span>
            ))}
          </div>

          <div className="pointer-events-auto mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/projects"
              className="bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-80"
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
        <div className="flex items-center justify-between pb-5 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <span className="flex items-center gap-2">
            sig
            <span className="beacon inline-block h-1.5 w-1.5 rounded-full bg-[var(--mission)]" aria-hidden="true" />
            nominal
          </span>
          <span aria-hidden="true">telemetry ↓</span>
        </div>
      </div>
    </section>
  )
}
