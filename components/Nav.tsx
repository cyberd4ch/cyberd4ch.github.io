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

  return (
    <nav className="flex flex-wrap items-center justify-between gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
        <Link href="/" aria-label="cyber.dach home" className="flex items-center gap-2">
          <MarkGlyph size={24} className="text-[var(--fg)]" />
          <span className="hidden min-[430px]:inline text-sm font-semibold tracking-tight">cyber.dach</span>
        </Link>
        {links.map(({ href, label }) => {
          const active = path === href || (href !== '/' && path.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={active ? 'nav-active text-sm font-medium' : 'text-sm text-[var(--fg)] hover:opacity-70 transition-opacity'}
            >
              {label}
            </Link>
          )
        })}
      </div>
      
      <button 
        onClick={toggleTheme} 
        className="p-1.5 rounded hover:bg-[var(--card)] transition-colors text-[var(--fg)]"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  )
}