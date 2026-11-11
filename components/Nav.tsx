'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import MarkGlyph from '@/components/MarkGlyph'

const links = [
  { href: '/', label: 'home' },
  { href: '/projects', label: 'projects' },
  { href: '/blog', label: 'blog' },
  { href: '/freelance', label: 'services' },
]

export default function Nav() {
  const path = usePathname()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check current theme on mount
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark')
    setIsDark(!isDark)
  }

  // One row everywhere: on phones every page's bar carries only the logo and
  // the theme toggle — the deck's cards carry the nav items on home, and the
  // other pages get them back once there's room.
  const hideLinksOnMobile = true

  return (
    <nav className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-x-3 sm:gap-x-5">
        <Link href="/" aria-label="cyber.dach home" className="flex shrink-0 items-center gap-2">
          <MarkGlyph size={26} draw className="text-[var(--fg)]" />
          <span className="logo-word hidden min-[430px]:inline text-sm font-semibold tracking-tight">
            cyber.dach
          </span>
        </Link>
        <div
          className={`no-scrollbar flex min-w-0 items-center gap-x-3 overflow-x-auto sm:gap-x-5 ${
            hideLinksOnMobile ? 'max-md:hidden' : ''
          }`}
        >
          {links.map(({ href, label }) => {
            const active = path === href || (href !== '/' && path.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap max-md:text-[13px] ${
                  active
                    ? 'nav-active text-sm font-medium'
                    : 'text-sm text-[var(--fg)] hover:opacity-70 transition-opacity'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      <button
        onClick={toggleTheme}
        className="shrink-0 rounded p-1.5 text-[var(--fg)] transition-colors hover:bg-[var(--card)]"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  )
}
