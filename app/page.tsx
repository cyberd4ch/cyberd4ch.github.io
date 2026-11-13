import Link from 'next/link'
import {
  FaGithub,
  FaMailchimp,
  FaStar,
  FaCodeBranch,
  FaHeart,
  FaUserAstronaut,
  FaBullseye,
  FaRocket,
  FaChartLine,
  FaBolt,
  FaSatelliteDish,
  FaBroadcastTower,
} from 'react-icons/fa'
import { repos, activity, timeAgo, languageColor, github, syncLabel, isStale, totalStars } from '@/lib/github'
import { posts } from '@/lib/posts'
import AIRing from '@/components/blog/AIRing'
import Hero from '@/components/hero/Hero'
import PageCol from '@/components/PageCol'
import Chapter from '@/components/deck/Chapter'
import IdentityCard from '@/components/deck/IdentityCard'
import DeckStage from '@/components/deck/DeckStage'
import { Squiggle } from '@/components/Deco'

// Home shows what actually moved recently — pinning only orders the projects page.
// 6 repos / 12 activity items: enough that both cards' bodies overflow and
// scroll inside the open sheet, like the transmissions card does.
const recentRepos = [...repos].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, 6)
const latestActivity = activity.slice(0, 12)
const latestPosts = posts.slice(0, 4)

function SectionHeading({ label, link, linkLabel }: { label: string; link?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="sec-label">{label}</h2>
      {link && (
        <Link href={link} className="text-xs underline-link text-[var(--muted)]">
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <div>
      <DeckStage />
      <Hero />

      {/* the opaque paper column; the aircraft lives in the margins.
          on phones this column is a gesture-driven card stage (see
          components/deck) — each chapter is one card, collapsed to its bar,
          opened by its button; on desktop the wrappers dissolve and this
          flows exactly as before. */}
      <PageCol>
        {/* identity card: the hero copy as the deck's first card (phones only;
            desktop keeps the hero copy up in the hero) */}
        <Chapter mobileOnly index={1} total={9} label="identity card" icon={<FaUserAstronaut size={15} />}>
          <IdentityCard />
        </Chapter>

        {/* Mission brief — one card per paragraph on phones */}
        <Chapter index={2} total={9} label="mission brief" icon={<FaBullseye size={15} />}>
          <section className="reveal pt-4 max-md:pt-0">
            <h2 className="sec-label mb-4">mission brief</h2>
            <p className="text-[15px] leading-relaxed text-[var(--fg)]">
              i&apos;m a <strong>telecom engineer</strong> &amp; <strong>cybersecurity expert</strong> with
              experience in software engineering, building and managing large to small scale
              networks and securing IT infrastructure.
            </p>
          </section>
        </Chapter>
        <Chapter index={3} total={9} label="mission brief" icon={<FaBullseye size={15} />}>
          <section className="reveal mt-4 max-md:mt-0">
            <p className="text-[15px] leading-relaxed text-[var(--fg)]">
              i&apos;m also a builder — i write code across the stack and care about systems that are{' '}
              <strong>resilient</strong>, <strong>efficient</strong>, and actually useful.
              here, i document my learnings, projects, and occasional deep-dives.
            </p>
          </section>
        </Chapter>
        <Chapter index={4} total={9} label="mission brief" icon={<FaBullseye size={15} />}>
          <section className="reveal mt-4 max-md:mt-0">
            <p className="text-[15px] leading-relaxed text-[var(--fg)]">
              everything on this site is pulled live from{' '}
              <a
                href={github.user.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-link font-medium"
              >
                my github
              </a>
              {' '}— the projects below are the actual repositories, and the activity log is what i&apos;ve
              been pushing, opening, and shipping.
            </p>
          </section>
        </Chapter>

        {/* Payload stack — derived from the languages in the account */}
        <Chapter index={5} total={9} label="payload stack" icon={<FaRocket size={15} />}>
          <section className="reveal pt-10 border-t border-[var(--hairline)] mt-10 max-md:pt-0 max-md:mt-0 max-md:border-t-0">
            <h2 className="sec-label mb-3">payload stack</h2>
            <div className="chips">
              {repos
                .flatMap(repo => [repo.language, ...repo.topics])
                .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index)
                .slice(0, 12)
                .map(t => (
                  <span key={t}>{t}</span>
                ))}
            </div>
          </section>
        </Chapter>

        {/* Recent telemetry — most recently pushed repos */}
        <Chapter index={6} total={9} label="recent telemetry" icon={<FaChartLine size={15} />}>
          <section className="reveal d1 pt-10 border-t border-[var(--hairline)] mt-10 max-md:pt-0 max-md:mt-0 max-md:border-t-0">
            <SectionHeading label="recent telemetry" link="/projects" linkLabel="all projects" />
            <div className="space-y-3">
              {recentRepos.map((repo, i) => (
                <a
                  key={repo.name}
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hud-panel block p-3 hover:border-[var(--border)] hover:border-solid transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[var(--navy)] font-bold">{String(i + 1).padStart(2, '0')}</span>
                    <FaGithub size={13} className="text-[var(--muted)]" />
                    <span className="font-bold text-sm tracking-[-0.02em]">{repo.name}</span>
                    {repo.language && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: languageColor(repo.language) }}
                        />
                        {repo.language}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--muted)]">{timeAgo(repo.pushedAt)}</span>
                  </div>
                  <p className="text-[13px] text-[var(--fg)] leading-relaxed">
                    {repo.description || 'no description yet — read the code.'}
                  </p>
                  {(repo.stars > 0 || repo.forks > 0) && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--muted)]">
                      {repo.stars > 0 && (
                        <span className="flex items-center gap-1">
                          <FaStar size={9} /> {repo.stars}
                        </span>
                      )}
                      {repo.stars > 0 && repo.forks > 0 && ' · '}
                      {repo.forks > 0 && (
                        <span className="flex items-center gap-1">
                          <FaCodeBranch size={9} /> {repo.forks}
                        </span>
                      )}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        </Chapter>

        {/* Activity log — refreshed by the scheduled build */}
        <Chapter index={7} total={9} label="activity log" icon={<FaBolt size={15} />}>
          <section className="reveal d1 pt-10 border-t border-[var(--hairline)] mt-10 max-md:pt-0 max-md:mt-0 max-md:border-t-0">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="sec-label">activity log</h2>
              <span className="text-[10px] text-[var(--muted)]">
                {isStale && <span aria-hidden>⚠ </span>}
                {syncLabel}
              </span>
            </div>
            {isStale && (
              <p className="text-[11px] text-[var(--fg)] border border-[var(--hairline)] rounded-lg px-3 py-2 mb-3">
                the scheduled GitHub sync may have stopped — this feed is from the last successful
                build.
              </p>
            )}
            {latestActivity.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">no public activity in the last 90 days.</p>
            ) : (
              <ul className="space-y-2.5">
                {latestActivity.map(item => (
                  <li key={`${item.type}-${item.url}`} className="text-[13px] leading-snug">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="blog-row block"
                    >
                      <span className="text-[var(--fg)]">{item.title}</span>
                      {item.detail && (
                        <span className="block text-[11px] text-[var(--muted)] truncate">{item.detail}</span>
                      )}
                    </a>
                    <span className="text-[10px] text-[var(--muted)]">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Chapter>

        {/* Transmissions — latest writing */}
        <Chapter index={8} total={9} label="transmissions" icon={<FaSatelliteDish size={15} />}>
          <section className="reveal d2 pt-10 border-t border-[var(--hairline)] mt-10 max-md:pt-0 max-md:mt-0 max-md:border-t-0">
            <SectionHeading label="transmissions" link="/blog" linkLabel="all posts" />
            <div className="space-y-4">
              {latestPosts.map(post => {
                const external = post.url.startsWith('http')
                return (
                  <Link key={post.id} href={post.url} className="blog-row block" target={external ? '_blank' : undefined}>
                    <h3 className="text-sm font-bold tracking-[-0.02em]">{post.title}</h3>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-0.5 mb-1 flex items-center gap-1.5">
                      {post.date} · {post.category} · {post.readMinutes} min
                      {post.aiAssist != null && <AIRing pct={post.aiAssist} size={12} />}
                    </p>
                    {post.excerpt && (
                      <p className="text-[13px] text-[var(--muted)] leading-relaxed">{post.excerpt}</p>
                    )}
                  </Link>
                )
              })}
            </div>
            <Link
              href="/freelance"
              className="inline-block mt-3 text-xs underline-link text-[var(--muted)]"
            >
              client case studies →
            </Link>
          </section>
        </Chapter>

        {/* Ground stations — where to find me */}
        <Chapter index={9} total={9} label="ground stations" icon={<FaBroadcastTower size={15} />}>
          <section className="reveal d2 pt-10 border-t border-[var(--hairline)] mt-10 pb-2 max-md:pt-0 max-md:mt-0 max-md:border-t-0">
            <h2 className="sec-label mb-3">ground stations</h2>
            <div className="flex items-center gap-2">
              <a
                href={github.user.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-line p-2"
                aria-label="GitHub"
              >
                <FaGithub size={16} />
              </a>
              <a
                href="mailto:hello@cyberdach.dev"
                className="btn-line p-2"
                aria-label="Email"
              >
                <FaMailchimp size={16} />
              </a>
              <a
                href="https://github.com/sponsors/cyberd4ch"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-line p-2"
                aria-label="Sponsor"
                title="Sponsor"
              >
                <FaHeart size={16} />
              </a>
            </div>
            <p className="mt-4 text-[11px] text-[var(--muted)]">
              {totalStars > 0 && `${repos.length} public repos · ${totalStars} stars · `}
              uplink synced every 6 hours.
            </p>
            <Squiggle className="mt-8" width={130} />
          </section>
        </Chapter>
      </PageCol>
    </div>
  )
}
