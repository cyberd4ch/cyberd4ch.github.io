import RepoList from './RepoList'
import {
  repos,
  languages,
  github,
  totalStars,
  syncLabel,
  isStale,
  syncAgeHours,
} from '@/lib/github'

export const metadata = {
  title: 'projects — cyber.dach',
  description: 'Public repositories from github.com/cyberd4ch, synced automatically.',
}

export default function ProjectsPage() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-medium stagger-1">projects</h1>
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
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

      <div className="stagger-2">
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
    </div>
  )
}
