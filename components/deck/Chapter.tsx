import type { CSSProperties, ReactNode } from 'react'

/**
 * One mobile story chapter. On phones the home page becomes a card deck:
 * each chapter reserves `h` viewport-heights of scroll and its card sticks
 * to the screen for the dwell, then gets pushed up off the top by the next
 * card arriving from below — every card travels upward, in one side and out
 * the other. On desktop the wrappers dissolve via `display: contents`, so
 * the sections flow exactly as they always did.
 *
 * On the presentation stage (DeckStage, phones) chapters become fixed
 * full-screen layers shown one at a time instead — the same card content,
 * scrubbed by the gesture. Each chapter renders as a drawer: the card panel
 * plus a trailing meta line underneath, wrapped in `.deck-drawer` so
 * DeckStage can clip it bottom-up in sync with the scroll (--cardP). The
 * header bar above the content (tile + label + index) ports the watermelon
 * profile-card's compact small-screen design.
 */
export default function Chapter({
  children,
  h = 128,
  first = false,
  mobileOnly = false,
  index,
  total,
  label,
  icon,
  tail,
}: {
  children: ReactNode
  /** chapter scroll length, in small-viewport heights */
  h?: number
  /** marks the first chapter for the deck driver's lift-off override */
  first?: boolean
  /** chapter exists only on phones (identity card; desktop keeps the hero copy) */
  mobileOnly?: boolean
  /** 1-based card index / deck size — renders the drawer's header bar + meta */
  index?: number
  total?: number
  /** chapter name for the header bar */
  label?: string
  /** small glyph for the header tile */
  icon?: ReactNode
  /** trailing text under the card — the first thing the drawer reveals */
  tail?: string
}) {
  return (
    <div
      className={mobileOnly ? 'chapter chapter-mobile-only' : 'chapter'}
      data-chapter-first={first ? 'true' : undefined}
      style={{ '--chapter-h': `${h}svh` } as CSSProperties}
    >
      <div className="deck-drawer">
        <div className="chapter-card">
          <div className="chapter-panel no-scrollbar">
            {index != null && total != null && (
              <div className="deck-head">
                {icon && <span className="deck-tile">{icon}</span>}
                {label && <span className="deck-head-label">{label}</span>}
                <span className="deck-head-idx">
                  {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
              </div>
            )}
            {children}
          </div>
        </div>
        {index != null && total != null && (
          <span className="deck-tail">
            {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
            {tail ? ` — ${tail}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
