'use client'

import { useState } from 'react'
import { FaGithub, FaLink, FaStar, FaCodeBranch } from 'react-icons/fa'
import { timeAgo, languageColor, type GithubRepo } from '@/lib/github'

interface Props {
  repos: GithubRepo[]
  languages: string[]
}

export default function RepoList({ repos, languages }: Props) {
  const [active, setActive] = useState('all')

  const filtered = active === 'all' ? repos : repos.filter(repo => repo.language === active)

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 mb-8">
        <button
          onClick={() => setActive('all')}
          className={`filter-tab ${active === 'all' ? 'active' : ''}`}
        >
          all <span className="opacity-50">{repos.length}</span>
        </button>
        {languages.map(language => (
          <button
            key={language}
            onClick={() => setActive(language)}
            className={`filter-tab ${active === language ? 'active' : ''}`}
          >
            {language}{' '}
            <span className="opacity-50">{repos.filter(repo => repo.language === language).length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((repo, i) => (
          <article
            key={repo.name}
            className="project-card bg-[var(--card)] rounded-sm overflow-hidden"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-base underline-link"
                >
                  {repo.name}
                </a>
                <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] shrink-0 pt-1">
                  <span className="flex items-center gap-1">
                    <FaStar size={9} /> {repo.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaCodeBranch size={9} /> {repo.forks}
                  </span>
                </div>
              </div>

              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
                {repo.language ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: languageColor(repo.language) }}
                    />
                    {repo.language}
                  </span>
                ) : (
                  'repository'
                )}
                {' · '}updated {timeAgo(repo.pushedAt)}
              </p>

              <p className="text-[13px] text-[var(--fg)] leading-relaxed mb-4">
                {repo.description || 'no description yet — read the code.'}
              </p>

              {repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                  {repo.topics.map(topic => (
                    <span key={topic} className="tag">#{topic}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-60 transition-opacity"
                  aria-label={`${repo.name} on GitHub`}
                >
                  <FaGithub size={17} />
                </a>
                {repo.homepage && (
                  <a
                    href={repo.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-60 transition-opacity"
                    aria-label={`${repo.name} live link`}
                  >
                    <FaLink size={17} />
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
