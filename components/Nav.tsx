'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'
import MarkGlyph from '@/components/MarkGlyph'
import { nextMode, readMode, writeMode, type ThemeMode } from '@/lib/theme'

const links = [
  { href: '/', label: 'home' },
  { href: '/projects', label: 'projects' },
  { href: '/blog', label: 'blog' },
  { href: '/freelance', label: 'services' },
]

const MODE_META: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  system: { icon: Monitor, label: 'system' },
  light: { icon: Sun, label: 'light' },
  dark: { icon: Moon, label: 'dark' },
}

export default function Nav() {
  const path = usePathname()
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    setMode(readMode())
  }, [])

  const cycle = () => {
    const m = nextMode(mode)
    writeMode(m)
    setMode(m)
  }

  // One row everywhere: on the stage (mobile home) the bar floats above the
  // cards, so the toggler stays reachable mid-deck.
  const Active = MODE_META[mode].icon

  return (
    <header className="nav-bar">
      <Link href="/" className="nav-mark" aria-label="cyber.dach home">
        <MarkGlyph className="h-5 w-5" />
        <span>cyber.dach</span>
      </Link>

      <nav className="nav-links" aria-label="primary">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={
              path === l.href || (l.href !== '/' && path.startsWith(`${l.href}/`))
                ? 'nav-active'
                : undefined
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={cycle}
        className="theme-toggle"
        aria-label={`theme: ${MODE_META[mode].label} — click for ${MODE_META[nextMode(mode)].label}`}
        title={`theme: ${MODE_META[mode].label}`}
      >
        <Active size={14} strokeWidth={2.2} />
        <span aria-hidden="true">{MODE_META[mode].label}</span>
      </button>
    </header>
  )
}
