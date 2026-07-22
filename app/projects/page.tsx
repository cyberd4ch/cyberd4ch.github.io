'use client'

import { useState } from 'react'
import { FaGithub, FaLink } from 'react-icons/fa6'
import { projects, ProjectCategory } from '@/lib/projects'

type Filter = 'all' | ProjectCategory

const filters: { label: string; value: Filter }[] = [
  { label: 'all', value: 'all' },
  { label: 'open source', value: 'open source' },
  { label: 'personal', value: 'personal' },
  { label: 'work', value: 'work' },
]

export default function ProjectsPage() {
  const [active, setActive] = useState<Filter>('all')

  const filtered = active === 'all' ? projects : projects.filter(p => p.category === active)

  return (
    <div>
      <h1 className="text-2xl font-medium mb-6 stagger-1">featured projects</h1>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-8 stagger-2">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setActive(f.value)}
            className={`filter-tab ${active === f.value ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.map((project, i) => (
          <article
            key={project.id}
            className="project-card bg-[var(--card)] rounded-sm overflow-hidden"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            {/* Scanlines decoration strip */}
            <div
              className="h-[72px] w-full"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)',
                borderBottom: '1px solid var(--border)',
              }}
            />

            <div className="p-5">
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-semibold text-base">{project.name}</h2>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
                {project.category}
              </p>

              <p className="text-[13px] text-[var(--fg)] leading-relaxed mb-4">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                {project.stack.map(s => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {project.github && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-60 transition-opacity"
                    aria-label="GitHub"
                  >
                    <FaGithub size={17} />
                  </a>
                )}
                {project.live && (
                  <a
                    href={project.live}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-60 transition-opacity"
                    aria-label="Live link"
                  >
                    <FaLink size={17} />
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">
        see more on{' '}
        <a
          href="https://github.com/cyberd4ch"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-link font-medium text-[var(--fg)]"
        >
          github
        </a>
      </p>
    </div>
  )
}
