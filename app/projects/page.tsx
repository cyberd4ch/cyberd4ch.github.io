import RepoList from './RepoList'
import { repos, languages, github, shortDate } from '@/lib/github'

export const metadata = {
  title: 'projects — cyber.dach',
  description: 'Public repositories from github.com/cyberd4ch, synced automatically.',
}

export default function ProjectsPage() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-medium stagger-1">projects</h1>
        <span className="text-[10px] text-[var(--muted)]">synced {shortDate(github.generatedAt)}</span>
      </div>

      <p className="text-[13px] text-[var(--muted)] mb-8 stagger-1">
        every public, non-fork repository on{' '}
        <a
          href={`${github.user.url}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-link text-[var(--fg)]"
        >
          @{github.user.login}
        </a>
        , refreshed from the GitHub API. newest push first.
      </p>

      <div className="stagger-2">
        <RepoList repos={repos} languages={languages} />
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">
        {github.user.publicRepos} public repos total, including forks —{' '}
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
