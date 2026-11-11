import Link from 'next/link'
import PageCol from '@/components/PageCol'
import { caseStudies } from '@/lib/caseStudies'

export const metadata = {
  title: 'security review — cyber.dach',
  description:
    'Independent security review of web applications: nonce/CSP laundering, DOM XSS, deep-link handlers and pre-2FA token flows. Evidence-backed reports, no scanner dumps.',
}

const services = [
  {
    title: 'JavaScript / SPA review',
    body: 'Static analysis of your production bundles for source→sink paths, nonce-copy primitives, innerHTML/insertAdjacentHTML sinks, and Trusted Types gaps.',
  },
  {
    title: 'CSP & nonce assessment',
    body: 'Is the policy actually protecting anything? I measure the enforced policy and find where a trusted script does the injection for you.',
  },
  {
    title: 'Auth & 2FA flows',
    body: 'Pre-authentication token timing and session issuance — whether a first-factor session is honoured before the second factor.',
  },
  {
    title: 'Finding triage',
    body: 'A second pair of eyes before you report: is it real, in scope, what is the impact, and how do you prove it.',
  },
]

const steps = [
  ['01', 'scope', 'Written scope, allowed hosts, test accounts, rules of engagement.'],
  ['02', 'recon', 'Public assets first — bundles, headers, policies — then authenticated paths.'],
  ['03', 'analysis', 'Manual review plus small purpose-built tooling. Every claim tied to a line of code or a request.'],
  ['04', 'proof', 'A deterministic reproduction with the minimum impact needed to show the issue.'],
  ['05', 'report', 'Root cause, impact, evidence, remediation, and a plain-language summary.'],
]

export default function FreelancePage() {
  return (
    <PageCol>
      <div className="space-y-12">
        <section className="reveal">
          <h1 className="text-2xl font-medium leading-snug">
            security review, from the shipped code.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed">
            I find and explain client-side security bugs in modern web applications —
            nonce and CSP laundering, DOM XSS, deep-link and redirect handlers, and
            pre-authentication token flows. I work from the code you actually ship,
            prove impact with reproducible evidence, and write reports your engineers
            can act on.
          </p>
          <p className="mt-3 text-[13px] text-[var(--muted)] leading-relaxed">
            Independent research on authorized bug-bounty programs and engagements.
            Manual, scoped, and honest about the difference between a lead and a bug.
          </p>
        </section>

      <section className="reveal">
        <h2 className="sec-label mb-4">
          what I do
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="hud-panel border border-[var(--border)] rounded-sm p-3">
              <h3 className="text-sm font-medium">{s.title}</h3>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed mt-1">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="reveal">
        <h2 className="sec-label mb-4">
          how an engagement runs
        </h2>
        <ol className="space-y-3">
          {steps.map(([n, title, body]) => (
            <li key={n} className="flex gap-4">
              <span className="text-[11px] text-[var(--red)] pt-0.5 shrink-0 font-medium">{n}</span>
              <div>
                <span className="text-sm font-medium">{title}</span>
                <p className="text-[13px] text-[var(--muted)] leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="reveal d1">
        <h2 className="sec-label mb-4">
          case studies
        </h2>
        <ul className="space-y-3">
          {caseStudies.map((study) => (
            <li key={study.slug}>
              <Link
                href={`/freelance/case-studies/${study.slug}/`}
                className="underline-link text-sm"
              >
                {study.title}
              </Link>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">{study.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="reveal d2">
        <h2 className="sec-label mb-4">
          selected work
        </h2>
        <ul className="space-y-3">
          <li>
            <Link href="/blog/bounty-program-landscape/" className="underline-link text-sm">
              where the deeplink work can make money — and the reporting trap that kills it
            </Link>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              desk research on which programs pay for nonce-laundering XSS.
            </p>
          </li>
          <li>
            <Link href="/blog/deeplink-gadget-trace/" className="underline-link text-sm">
              server-side trace of the deeplink gadget
            </Link>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              a real sink, a real mount, and a sanitiser that held — reported as a negative, with evidence.
            </p>
          </li>
          <li>
            <Link href="/projects" className="underline-link text-sm">
              the security toolkit
            </Link>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              a dependency-free scanner and fetcher for the nonce-laundering class.
            </p>
          </li>
        </ul>
      </section>

      <section className="reveal d2">
        <h2 className="sec-label mb-4">
          what I will not do
        </h2>
        <ul className="text-[13px] text-[var(--muted)] leading-relaxed space-y-1">
          <li>· test outside the agreed scope or against accounts I do not own</li>
          <li>· run automated or mass scanning, brute force, or denial-of-service testing</li>
          <li>· inflate a finding or report a “missing header” as a vulnerability</li>
          <li>· touch real user data</li>
        </ul>
      </section>

      <section className="reveal d3 border-t border-[var(--border)] pt-6">
        <h2 className="sec-label mb-3">
          get in touch
        </h2>
        <p className="text-[14px] leading-relaxed">
          Tell me what you are building and what worries you. I will reply with a
          scope and a fixed price for the first pass.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
          <a href="mailto:cyberdachh@proton.me" className="underline-link">
            cyberdachh@proton.me
          </a>
          <a
            href="https://github.com/cyberd4ch"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-link"
          >
            github.com/cyberd4ch
          </a>
          <a
            href="https://cyberd4ch.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-link"
          >
            cyberd4ch.github.io
          </a>
        </div>
      </section>
      </div>
    </PageCol>
  )
}
