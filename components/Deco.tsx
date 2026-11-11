import MarkGlyph from '@/components/MarkGlyph'

/**
 * Retro decorative kit, shared across pages.
 *  - Squiggle: a short worm-line glyph, the paint snake in miniature.
 */

export function Squiggle({ className = '', width = 140 }: { className?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 140 26"
      width={width}
      height={(26 * width) / 140}
      className={`squiggle ${className}`}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M 4 16 C 18 4, 32 4, 46 16 S 74 28, 88 16 S 116 4, 136 14"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export { MarkGlyph }
