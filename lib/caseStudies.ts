export interface CaseStudy {
  slug: string
  title: string
  summary: string
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'csp-policy-and-parsing',
    title: 'CSP policy & parsing analysis',
    summary:
      'Measured a printed policy against live headers and proved the comma semantics with controls — a scope memo instead of a wasted hunt.',
  },
  {
    slug: 'nonce-laundering-trace',
    title: 'Nonce-laundering trace',
    summary:
      "Traced a server value into a nonce'd inline script, then proved the server sanitised it — a documented negative with a reusable scanner.",
  },
  {
    slug: 'pre-2fa-token-timing',
    title: 'Pre-2FA token timing',
    summary:
      'A safe, repeatable harness for testing whether a first-factor token is honoured before the second factor.',
  },
]
