'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

const links = [
  { href: '/', label: 'home' },
  { href: '/projects', label: 'projects' },
  { href: '/blog', label: 'blog' },
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
    <nav className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" aria-label="cyber.dach home" className="flex items-center gap-2">
          <svg
            viewBox="0 0 256 256"
            width={26}
            height={26}
            aria-hidden="true"
            className="text-[var(--fg)]"
          >
            <path
              transform="translate(15,-2)"
              d="M162 185 L108 216 L54 185 L54 123 L108 92 L162 123 V44"
              fill="none"
              stroke="currentColor"
              strokeWidth={20}
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </svg>
          <span className="text-sm font-semibold tracking-tight">cyber.dach</span>
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