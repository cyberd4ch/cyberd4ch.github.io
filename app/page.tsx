
import Link from 'next/link'
import { FaGithub, FaLinkedin, FaMailchimp, FaLink, FaExternalLinkAlt } from 'react-icons/fa'

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Greeting */}
      <section className="stagger-1">
        <h1 className="text-2xl font-medium mb-5">
          hi, i&apos;m <span className="font-semibold">cyber.dach</span> 👋
        </h1>

        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--fg)]">
          <p>
            i&apos;m a <strong>telecom engineer</strong> &amp; <strong>cybersecurity expert</strong> from ghana 🇬🇭 with
            experience in software engineering, building and managing large to small scale
            networks and securing IT infrastructure.
          </p>

          <p>
            i&apos;m also a builder — i write code across the stack and care about systems that are{' '}
            <strong>resilient</strong>, <strong>efficient</strong>, and actually useful.
            here, i document my learnings, projects, and occasional deep-dives.
          </p>

          <p>
            currently building{' '}
            <a
              href="https://cyberdach.bearblog.dev/handyman.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-link font-medium"
            >
              Handyman
            </a>{' '}
            & writing on{' '}
            <a
              href="https://cyberdach.bearblog.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-link font-medium"
            >
              the blog
            </a>
            .
          </p>
        </div>
      </section>

      {/* Stack */}
      <section className="stagger-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
          + tech stack +
        </h2>
        <div className="flex flex-wrap gap-2">
          {['C/C++', 'Python', 'JavaScript', 'Next.js', 'React', 'Node.js', 'Express', 'Angular', 'Vue', 'SQL', 'MongoDB'].map(t => (
            <span
              key={t}
              className="text-xs border border-[var(--border)] px-2.5 py-1 rounded-sm text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors cursor-default"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="stagger-3">
        <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
          featured
        </h2>
        <div className="space-y-2">
          <a
            href="https://github.com/cyberd4ch/cportscan"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline-link"
          >
            <FaGithub size={14} />
            <span>cportscan — port scanner built in C</span>
            <FaExternalLinkAlt size={11} className="text-[var(--muted)]" />
          </a>
          <a
            href="https://cyberdach.bearblog.dev/blog/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline-link"
          >
            <FaLink size={14} />
            <span>blog — IT, networking, security & digital forensics</span>
            <FaExternalLinkAlt size={11} className="text-[var(--muted)]" />
          </a>
        </div>
      </section>

      {/* Social */}
      <section className="stagger-4">
        <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3 font-medium">
          find me
        </h2>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/cyberd4ch"
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
            href="https://cyberdach.bearblog.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[var(--card)] rounded transition-colors"
            aria-label="Blog"
          >
            <FaLink size={18} />
          </a>
        </div>
      </section>
    </div>
  )
}
