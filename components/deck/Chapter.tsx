import type { CSSProperties, ReactNode } from 'react'

/**
 * One mobile story chapter. On phones the home page becomes a card deck:
 * each chapter reserves `h` viewport-heights of scroll and its card sticks
 * to the screen for the dwell, then gets pushed up off the top by the next
 * card arriving from below — every card travels upward, in one side and out
 * the other. On desktop the wrappers dissolve via `display: contents`, so
 * the sections flow exactly as they always did.
 */
export default function Chapter({
  children,
  h = 128,
  first = false,
  mobileOnly = false,
}: {
  children: ReactNode
  /** chapter scroll length, in small-viewport heights */
  h?: number
  /** marks the first chapter for the deck driver's lift-off override */
  first?: boolean
  /** chapter exists only on phones (identity card; desktop keeps the hero copy) */
  mobileOnly?: boolean
}) {
  return (
    <div
      className={mobileOnly ? 'chapter chapter-mobile-only' : 'chapter'}
      data-chapter-first={first ? 'true' : undefined}
      style={{ '--chapter-h': `${h}svh` } as CSSProperties}
    >
      <div className="chapter-card">
        <div className="chapter-panel hud-panel no-scrollbar">{children}</div>
      </div>
    </div>
  )
}
