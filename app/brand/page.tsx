export const metadata = {
  title: 'brand — cyber.dach',
  description: 'Three candidate marks for cyber.dach: roofline, hex d, and perimeter.',
}

const candidates = [
  {
    id: 'a',
    name: 'roofline',
    type: 'abstract',
    idea: 'a roof (dach) held over a single node — shelter over the wire.',
    why: [
      'the only concept that carries the name: dach means roof.',
      'reads at 16 px as a ridge plus a point, no fine detail to lose.',
      'calm and architectural rather than alarmist — no padlock, no shield.',
    ],
    risk: 'the roof/chevron family is common in "home" and cloud logos; the floating node is what makes it ours.',
    art: '/brand/art-a-roofline.png',
    svg: '/brand/candidate-a-roofline.svg',
    mark: '/brand/candidate-a-roofline.svg',
  },
  {
    id: 'b',
    name: 'hex d',
    type: 'letterform',
    idea: 'a lowercase d whose counter is a packet — the initial as the object.',
    why: [
      'works as an avatar or favicon with no wordmark attached.',
      'hexagon counter ties to packets and protocol headers without drawing a computer.',
      'the ascender gives it a silhouette no other d.monogram has.',
    ],
    risk: 'the ascender reads slightly detached at poster size; needs a tighter join before production.',
    art: '/brand/art-b-hex-d.png',
    svg: '/brand/candidate-b-trace-d.svg',
    mark: '/brand/candidate-b-trace-d.svg',
  },
  {
    id: 'c',
    name: 'perimeter',
    type: 'abstract',
    idea: 'four boundary brackets around a watched node — scope, then target.',
    why: [
      'most distinct at 16 px: four blocks and a dot, instantly separable.',
      'reads as scanning and perimeter without a single security cliché.',
      'scales cleanly to an app icon tile because the silhouette is already square.',
    ],
    risk: 'crop-mark/focus glyphs exist in camera and design tools; the lone offset node is the differentiator.',
    art: '/brand/art-c-perimeter.png',
    svg: '/brand/candidate-c-perimeter.svg',
    mark: '/brand/candidate-c-perimeter.svg',
  },
]

export default function BrandPage() {
  return (
    <div className="space-y-10">
      <section className="stagger-1">
        <h1 className="text-2xl font-medium mb-4">brand exploration</h1>
        <p className="text-[15px] leading-relaxed mb-3">
          three candidate marks for <strong>cyber.dach</strong>, drawn at 256 × 256 and tested at
          16 px. brief: telecom + security engineer; adjectives — precise, grounded, technical,
          quiet; avoid the category&apos;s padlocks, shields, globes and hooded figures.
        </p>
        <p className="text-[13px] text-[var(--muted)]">
          these are concepts, not final identity files — no trademark clearance has been done, and
          the wordmark is set in type, not drawn.
        </p>
      </section>

      {candidates.map((candidate, index) => (
        <section key={candidate.id} className={`stagger-${index + 2} space-y-3`}>
          <div className="flex items-baseline gap-3">
            <img
              src={candidate.mark}
              alt={`${candidate.name} mark`}
              width={40}
              height={40}
              className="border border-[var(--border)] rounded-sm bg-[var(--card)] p-1"
            />
            <div>
              <h2 className="text-lg font-medium">
                {candidate.id.toUpperCase()} — {candidate.name}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                {candidate.type}
              </p>
            </div>
          </div>

          <a href={candidate.art} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={candidate.art}
              alt={`${candidate.name} brand card`}
              width={1200}
              height={800}
              className="w-full border border-[var(--border)] rounded-sm"
            />
          </a>

          <p className="text-[13px] leading-relaxed">
            <strong>Idea:</strong> {candidate.idea}
          </p>
          <ul className="text-[13px] leading-relaxed list-disc pl-5 space-y-1">
            {candidate.why.map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="text-[12px] text-[var(--muted)]">
            <strong>Risk:</strong> {candidate.risk}
          </p>
          <div className="flex gap-3 text-xs">
            <a href={candidate.svg} download className="underline-link">
              download mark (svg)
            </a>
            <a href={candidate.art} download className="underline-link">
              download card (png)
            </a>
          </div>
        </section>
      ))}

      <section className="stagger-5 border-t border-[var(--border)] pt-6">
        <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
          recommendation
        </h2>
        <p className="text-[13px] leading-relaxed">
          <strong>perimeter (C)</strong> is the strongest identifier — it survives 16 px best and
          says &ldquo;scope, then examine&rdquo; without borrowing security iconography.{' '}
          <strong>roofline (A)</strong> is the stronger story if you want the name itself to carry
          the meaning. <strong>hex d (B)</strong> is the best pure avatar. Pick one and I&apos;ll
          build the full kit: colour palette, one-colour and reversed versions, horizontal and
          stacked lockups, a 16 px small cut, favicon + app icons, mockups, and a usage sheet.
        </p>
      </section>
    </div>
  )
}
