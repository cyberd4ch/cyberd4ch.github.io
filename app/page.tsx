import Link from 'next/link'
import { FaGithub, FaMailchimp, FaStar, FaCodeBranch, FaHeart } from 'react-icons/fa'
import { repos, activity, timeAgo, languageColor, github, syncLabel, isStale, totalStars } from '@/lib/github'
import { posts } from '@/lib/posts'
import Hero from '@/components/hero/Hero'
import PageCol from '@/components/PageCol'
import { Squiggle } from '@/components/Deco'

// Home shows what actually moved recently — pinning only orders the projects page.
const recentRepos = [...repos].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, 3)
const latestActivity = activity.slice(0, 6)
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
      <Hero />

      {/* the opaque paper column; the paint snake lives in the margins */}
      <PageCol>
        {/* Mission brief */}
        <section className="reveal pt-4">
          <h2 className="sec-label mb-4">mission brief</h2>

          <div className="space-y-4 text-[15px] leading-relaxed text-[var(--fg)]">
            <p>
              i&apos;m a <strong>telecom engineer</strong> &amp; <strong>cybersecurity expert</strong> with
              experience in software engineering, building and managing large to small scale
              networks and securing IT infrastructure.
            </p>

            <p>
              i&apos;m also a builder — i write code across the stack and care about systems that are{' '}
              <strong>resilient</strong>, <strong>efficient</strong>, and actually useful.
              here, i document my learnings, projects, and occasional deep-dives.
            </p>

            <p>
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
          </div>
        </section>

        {/* Payload stack — derived from the languages in the account */}
        <section className="reveal pt-10 border-t border-[var(--border)] mt-10">
          <h2 className="sec-label mb-3">payload stack</h2>
          <div className="flex flex-wrap gap-2">
            {repos
              .flatMap(repo => [repo.language, ...repo.topics])
              .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index)
              .slice(0, 12)
              .map(t => (
                <span
                  key={t}
                  className="text-xs border border-[var(--border)] px-2.5 py-1 text-[var(--muted)] hover:border-[var(--blue-bright)] hover:text-[var(--blue-bright)] transition-colors cursor-default"
                >
                  {t}
                </span>
              ))}
          </div>
        </section>

        {/* Recent telemetry — most recently pushed repos */}
        <section className="reveal d1 pt-10 border-t border-[var(--border)] mt-10">
          <SectionHeading label="recent telemetry" link="/projects" linkLabel="all projects" />
          <div className="space-y-3">
            {recentRepos.map((repo, i) => (
              <a
                key={repo.name}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hud-panel block border border-[var(--border)] p-3 hover:border-[var(--fg)] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-[var(--red)]">{String(i + 1).padStart(2, '0')}</span>
                  <FaGithub size={13} className="text-[var(--muted)]" />
                  <span className="font-semibold text-sm">{repo.name}</span>
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

        {/* Activity log — refreshed by the scheduled build */}
        <section className="reveal d1 pt-10 border-t border-[var(--border)] mt-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="sec-label">activity log</h2>
            <span className="text-[10px] text-[var(--muted)]">
              {isStale && <span aria-hidden>⚠ </span>}
              {syncLabel}
            </span>
          </div>
          {isStale && (
            <p className="text-[11px] text-[var(--fg)] border border-[var(--border)] px-3 py-2 mb-3">
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

        {/* Transmissions — latest writing */}
        <section className="reveal d2 pt-10 border-t border-[var(--border)] mt-10">
          <SectionHeading label="transmissions" link="/blog" linkLabel="all posts" />
          <div className="space-y-4">
            {latestPosts.map(post => {
              const external = post.url.startsWith('http')
              return (
                <Link key={post.id} href={post.url} className="blog-row block" target={external ? '_blank' : undefined}>
                  <h3 className="text-sm font-medium">{post.title}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-0.5 mb-1">
                    {post.date} · {post.category}
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

        {/* Ground stations — where to find me */}
        <section className="reveal d2 pt-10 border-t border-[var(--border)] mt-10 pb-2">
          <h2 className="sec-label mb-3">ground stations</h2>
          <div className="flex items-center gap-4">
            <a
              href={github.user.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-[var(--card)] rounded transition-colors"
              aria-label="GitHub"
            >
              <FaGithub size={18} />
            </a>
            <a
              href="mailto:hello@cyberdach.dev"
              className="p-2 hover:bg-[var(--card)] rounded transition-colors"
              aria-label="Email"
            >
              <FaMailchimp size={18} />
            </a>
            <a
              href="https://github.com/sponsors/cyberd4ch"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-[var(--card)] rounded transition-colors"
              aria-label="Sponsor"
              title="Sponsor"
            >
              <FaHeart size={18} />
            </a>
          </div>
          <p className="mt-4 text-[11px] text-[var(--muted)]">
            {totalStars > 0 && `${repos.length} public repos · ${totalStars} stars · `}
            uplink synced every 6 hours.
          </p>
          <Squiggle className="mt-8" width={130} />
        </section>
      </PageCol>
    </div>
  )
}
