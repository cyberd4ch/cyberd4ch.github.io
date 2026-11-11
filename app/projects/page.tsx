import Link from 'next/link'
import RepoList from './RepoList'
import PageCol from '@/components/PageCol'
import {
  repos,
  languages,
  github,
  totalStars,
  syncLabel,
  isStale,
  syncAgeHours,
} from '@/lib/github'
import { curatedProjects } from '@/lib/projects'

export const metadata = {
  title: 'projects — cyber.dach',
  description: 'Public repositories from github.com/cyberd4ch, synced automatically.',
}

export default function ProjectsPage() {
  return (
    <PageCol>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-medium stagger-1">projects</h1>
        <span className="hud-label">
          {isStale && <span aria-hidden>⚠ </span>}
          {syncLabel}
        </span>
      </div>

      <p className="text-[13px] text-[var(--muted)] mb-4 stagger-1">
        every public, non-fork repository on{' '}
        <a
          href={`${github.user.url}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-link text-[var(--fg)]"
        >
          @{github.user.login}
        </a>
        , pulled from the GitHub API — pinned first, then newest push.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)] mb-6 stagger-1">
        <span>
          <span className="text-[var(--fg)]">{repos.length}</span> tracked repos
        </span>
        <span>
          <span className="text-[var(--fg)]">{totalStars}</span> stars
        </span>
        <span>
          <span className="text-[var(--fg)]">{languages.length}</span> languages
        </span>
        <span className="text-[var(--muted)]">
          of {github.user.publicRepos} public repos
        </span>
      </div>

      {isStale && (
        <p className="text-[11px] text-[var(--fg)] border border-[var(--border)] rounded-sm px-3 py-2 mb-6">
          this snapshot is {Math.round(syncAgeHours / 24)} days old — the scheduled GitHub sync
          may have stopped. showing the last successful build.
        </p>
      )}

      <section className="mb-8 reveal">
        <h2 className="sec-label mb-3">
          research &amp; security
        </h2>
        <div className="space-y-3">
          {curatedProjects.map((project) => (
            <Link
              key={project.id}
              href={project.url}
              target={project.url.startsWith('http') ? '_blank' : undefined}
              rel={project.url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="hud-panel block group border border-[var(--border)] rounded-sm p-3 hover:border-[var(--fg)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{project.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--label)]">
                  {project.status}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed">{project.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] border border-[var(--border)] px-1.5 py-0.5 rounded-sm text-[var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="reveal d1">
        <RepoList repos={repos} languages={languages} />
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">
        refreshed every 6 hours by GitHub Actions —{' '}
        <a
          href={`${github.user.url}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-link font-medium text-[var(--fg)]"
        >
          see all on github
        </a>
      </p>
    </PageCol>
  )
}
