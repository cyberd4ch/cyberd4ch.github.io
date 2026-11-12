'use client'

/**
 * Three-state theme: system / light / dark. The mode persists in localStorage
 * under `theme`; the pre-paint inline script in app/layout.tsx applies it
 * before first paint (github.io sets no CSP, so the inline script is safe)
 * and keeps `system` live via a matchMedia listener. Nav cycles the mode and
 * everything else reads the document: `.dark` class (resolved scheme) and
 * `data-theme` (raw mode — the aircraft picker keys off this).
 */

export type ThemeMode = 'system' | 'light' | 'dark'
export const THEME_KEY = 'theme'
/** cycle order for the nav toggler */
export const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark']

export function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  let v: string | null = null
  try {
    v = localStorage.getItem(THEME_KEY)
  } catch {}
  return v === 'light' || v === 'dark' ? v : 'system'
}

/** Apply a mode to the document: data-theme attr + resolved .dark class. */
export function applyMode(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.dataset.theme = mode
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

/** Persist + apply. */
export function writeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {}
  applyMode(mode)
}

export function nextMode(mode: ThemeMode): ThemeMode {
  const i = THEME_ORDER.indexOf(mode)
  return THEME_ORDER[(i + 1) % THEME_ORDER.length]
}
