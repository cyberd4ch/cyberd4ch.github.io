/**
 * Orbit-d mark, inlined so it inherits currentColor in any context
 * (nav, hero fallback, footer). Geometry matches public/brand/2026/mark.svg:
 * bowl r=44 @ (128,135), ring arc r=84 open at one o'clock, mast x=172.
 *
 * `draw` plays a hand-inked entrance: the orbit ring — the open "c" sweep —
 * is inked first, then the bowl and the mast complete the mark behind it.
 * Dash lengths are hardcoded viewBox units (ring ≈ 426, bowl ≈ 276, mast ≈
 * 152) so the reveal works without relying on pathLength support.
 */
export default function MarkGlyph({
  size = 26,
  className,
  draw = false,
}: {
  size?: number
  className?: string
  draw?: boolean
}) {
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
        <circle cx={128} cy={135} r={44} className={draw ? 'logo-draw logo-draw-bowl' : undefined} />
        {/* orbit ring: one sweep, open at one o'clock where the mast rises through */}
        <path
          d="M 205.1 101.7 A 84 84 0 1 1 123 51.1"
          className={draw ? 'logo-draw logo-draw-ring' : undefined}
        />
        {/* mast / stem rising through the orbit */}
        <path d="M 172 179 L 172 27" className={draw ? 'logo-draw logo-draw-mast' : undefined} />
      </g>
    </svg>
  )
}
