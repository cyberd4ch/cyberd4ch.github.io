/**
 * The AI-assist ring — a tiny SVG donut that fills with the share of the post
 * that came from AI drafts. Full ring = 100 (published as drafted); the
 * remaining gap is the human share (100 − aiAssist). null renders nothing.
 * Colors come from the theme vars so it adapts to dark mode.
 */
export default function AIRing({
  pct,
  size = 14,
  label = false,
}: {
  pct: number
  size?: number
  /** also print the mono "AI 100" caption next to the ring */
  label?: boolean
}) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  const r = (size - 3) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="ai-ring" title={`AI-assisted ${p}% · human-edited ${100 - p}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* track = the whole possible ring (the unedited 100%) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="2.4"
        />
        {/* the AI share, starting at 12 o'clock */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--navy)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {p === 100 && (
          <circle cx={size / 2} cy={size / 2} r={1.6} fill="var(--navy)" />
        )}
      </svg>
      {label && (
        <span className="ai-ring-label">
          ai {p} · human {100 - p}
        </span>
      )}
    </span>
  )
}
