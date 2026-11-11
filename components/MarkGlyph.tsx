/**
 * Orbit-d mark, inlined so it inherits currentColor in any context
 * (nav, hero fallback, footer). Geometry matches public/brand/2026/mark.svg:
 * bowl r=44 @ (128,135), ring arc r=84 open at one o'clock, mast x=172.
 */
export default function MarkGlyph({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth={20} strokeLinecap="butt">
        {/* celestial bowl (the d bowl) */}
        <circle cx={128} cy={135} r={44} />
        {/* orbit ring: one sweep, open at one o'clock where the mast rises through */}
        <path d="M 205.1 101.7 A 84 84 0 1 1 123 51.1" />
        {/* mast / stem rising through the orbit */}
        <path d="M 172 179 L 172 27" />
      </g>
    </svg>
  )
}
