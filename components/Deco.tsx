import MarkGlyph from '@/components/MarkGlyph'

/**
 * Retro decorative kit, shared across pages.
 *  - Stamp: rotated roundel patch (mark + circular type), painted in red.
 *  - Squiggle: a short worm-line glyph, the paint snake in miniature.
 */

export function Stamp({ className = '' }: { className?: string }) {
  return (
    <div className={`stamp ${className}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <defs>
          <path
            id="stamp-arc"
            d="M 60,60 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0"
            fill="none"
          />
        </defs>
        <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <text
          fill="currentColor"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '2.2px' }}
        >
          <textPath href="#stamp-arc">CYBER·DACH · FLIGHT LINE · MMXXVI ·</textPath>
        </text>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={20}
          strokeLinecap="butt"
          transform="translate(60,60) scale(0.19) translate(-128,-135)"
        >
          <circle cx={128} cy={135} r={44} />
          <path d="M 205.1 101.7 A 84 84 0 1 1 123 51.1" />
          <path d="M 172 179 L 172 27" />
        </g>
      </svg>
    </div>
  )
}

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
