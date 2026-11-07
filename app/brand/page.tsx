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
    idea: 'a single d: the bowl is a c-shape and the ascender sits on top of it.',
    why: [
      'one letter, not a monogram: the ascender grows out of the c rather than standing beside it.',
      'the open lower-right aperture is what makes the bowl read as a c inside a d.',
      'at 16 px the aperture closes and it is simply a d, which is the right failure.',
    ],
    risk: 'the aperture reads as a notch below about 20 px; the small cut widens it, but it cannot survive favicon scale.',
    art: '/brand/art-b-cd.png',
    svg: '/brand/candidate-b-cd.svg',
    mark: '/brand/candidate-b-cd.svg',
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

const kit = [
  { file: 'mark-mono.svg', label: 'mark — ink', note: 'one colour, transparent' },
  { file: 'mark-inverse.svg', label: 'mark — paper', note: 'for dark surfaces' },
  { file: 'mark-small.svg', label: 'mark — small cut', note: 'heavier stroke, wider c' },
  { file: 'lockup-horizontal.svg', label: 'lockup — horizontal', note: 'mark + wordmark' },
  { file: 'lockup-horizontal-inverse.svg', label: 'lockup — reversed', note: 'on dark' },
  { file: 'lockup-stacked.svg', label: 'lockup — stacked', note: 'square-ish spaces' },
  { file: 'icon-tile.svg', label: 'app icon — vector', note: '1024 tile' },
  { file: 'icon-1024.png', label: 'app icon — 1024 px', note: 'store upload' },
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

      <section className="stagger-5 border-t border-[var(--border)] pt-6 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] font-medium">
          the kit
        </h2>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          {kit.map(item => (
            <a
              key={item.file}
              href={`/brand/kit/${item.file}`}
              download
              className="border border-[var(--border)] rounded-sm p-3 hover:opacity-70 transition-opacity"
            >
              <span className="block text-[var(--fg)]">{item.label}</span>
              <span className="text-[var(--muted)]">{item.note}</span>
            </a>
          ))}
        </div>
        <p className="text-[12px] text-[var(--muted)]">
          app icon also ships as 512, 256 and 128 px PNGs; favicon as 32 and 16 px.
        </p>
        <ul className="text-[12px] leading-relaxed list-disc pl-5 space-y-1">
          <li>clear space around the mark: one stroke width, about 8% of its height.</li>
          <li>minimum size: 24 px for the full mark, 16 px for the small cut.</li>
          <li>never close the gap between bowl and stem — that is the c.</li>
          <li>one colour only: ink on light, paper on dark. no gradients or shadows.</li>
          <li>the wordmark is set in IBM Plex Mono, not drawn; tracking is −2 at 60 px.</li>
        </ul>
      </section>

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
