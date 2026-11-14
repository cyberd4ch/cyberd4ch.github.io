import type { CSSProperties, ReactNode } from 'react'
import { Children } from 'react'

/**
 * One mobile story chapter. On the presentation stage (DeckStage, phones)
 * chapters are fixed full-screen layers: the card shows COLLAPSED — just its
 * bottom bar (tile, label, index, drawer button) — and the button springs
 * the sheet open (children revealing in a stagger driven by --cardP).
 * DeckStage owns all animation state; this component is pure markup.
 *
 * On desktop (and without the stage) every wrapper dissolves via
 * `display: contents`, so the sections flow exactly as they always did.
 */
const TILE_BG = [
  'var(--chip-blue)',
  'var(--chip-yellow)',
  'var(--chip-pink)',
  'var(--chip-green)',
  'var(--chip-cream)',
]

export default function Chapter({
  children,
  mobileOnly = false,
  peek = false,
  index,
  total,
  label,
  icon,
}: {
  children: ReactNode
  /** chapter exists only on phones (identity card; desktop keeps the hero copy) */
  mobileOnly?: boolean
  /** the landing overlay: its bar parks at the bottom edge at pos 0 — it is
      not a deck stop, and the sheet opens in place over the portrait */
  peek?: boolean
  /** 1-based card index / deck size — renders the bar + header */
  index?: number
  total?: number
  /** chapter name for the bar + header */
  label?: string
  /** small glyph for the header tile */
  icon?: ReactNode
}) {
  const n = index ?? 1
  const tileBg = TILE_BG[(n - 1) % TILE_BG.length]
  const showToggle = index != null || peek
  return (
    <div
      className={
        mobileOnly ? 'chapter chapter-mobile-only' : peek ? 'chapter chapter-peek' : 'chapter'
      }
    >
      <div className="chapter-card">
        <div className="deck-card">
          <div className="deck-sheet">
            <div className="deck-head">
              {icon && (
                <span className="deck-tile" style={{ background: tileBg } as CSSProperties}>
                  {icon}
                </span>
              )}
              {label && <span className="deck-head-label">{label}</span>}
            </div>
            <div className="deck-body">
              {Children.map(children, (child, i) => (
                <div style={{ '--n': i } as CSSProperties}>{child}</div>
              ))}
            </div>
          </div>
          <div className={`deck-bar${index == null ? ' deck-bar-entry' : ''}`}>
            {icon && (
              <span className="deck-tile" style={{ background: tileBg } as CSSProperties}>
                {icon}
              </span>
            )}
            {label && <span className="deck-bar-label">{label}</span>}
            {index != null && total != null && (
              <span className="deck-bar-idx">
                {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            )}
            {showToggle && (
              <button
                type="button"
                className="deck-toggle"
                aria-expanded={false}
                aria-label={label ? `open ${label}` : 'open card'}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path
                    d="M3 6l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
