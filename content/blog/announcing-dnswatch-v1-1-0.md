---
title: "announcing dns-watch v1.1.0: your attack surface's DNS, diffed — for free"
date: 2026-11-07
category: technical
ai-assist: 100
tags: [dns, release, shell]
topics: [bug-bounty, tooling]
excerpt: "release notes for a one-file DNS drift watcher: one cron line, a readable log, no dashboard, no API keys, no subscription."
---
*The parts of this series: [part 1](/blog/one-curl-per-host/),
[part 2](/blog/building-dns-watch/) (why and how the tool got built),
[part 3](/blog/when-templates-find-zero/). This post is the release
notes; the repo is the product.*

**dns-watch** is a single-shellfile DNS drift watcher for bug-bounty scopes:
one cron line, one readable log, no dashboard, no API keys, no subscription.
Recon is a snapshot; drift is invisible between sessions — and the
subdomain-takeover window is exactly the interval when nobody is looking.
dns-watch makes that interval legible:

```
CLEAN 20261103T200907Z; canary: none
CHANGES 20261103T214015Z; canary: none   < dead-cdn.example.com
   < dead-cdn.example.com CNAME: d3475823k.jump-video.pages.dev
```

That block above is the whole UX. Sorted multi-record diffs (no IP-shuffle
noise), a resolver health control that logs `SKIP` instead of inventing a
diff during a resolver outage, and a wildcard canary per domain.

## What v1.1.0 adds

**Takeover tagging, opt-in (`-T signatures.tsv`).** After each run, every
watched host's CNAME chain is walked; any chain that answers nothing for
CNAME, A *and* NS gets tagged:

```
takeover-candidate: dead.example.com -> danglbucket.s3.amazonaws.com \
[provider=AWS S3] verify: HTTP GET apex: body says "The specified bucket
does not exist" (NoSuchBucket); the bucket name in the body is the
claimable one
takeover-check: 0 dangling chain(s) of 20 aliased host(s) watched
```

Two rules I refuse to trade away: **the tool never sends HTTP itself** —
the `verify:` hint is the manual step for the human — and the output stays
a *candidate*, never a verdict. A loud wrong "takeover candidate!" is
worse than a quiet one, so the signature table carries the community
reference's honest labels: GitHub Pages, Heroku and Netlify are marked
*edge case*, Fastly is marked *NOT claimable* — the tag still fires, the
row just refuses to lie about confidence. The table ships with 25 rows
sourced from the canonical [can-i-take-over-xyz](https://github.com/EdOverflow/can-i-take-over-xyz)
fingerprints, and it's a plain TSV: extending it is the first-timer
contribution surface in `CONTRIBUTING.md`.

Also in v1.1.0: record-type targets (`name@MX`, `name@NS` — watch an apex
record without inventing a wrapper), the full offline suite runs on every
push (27 assertions across 6 scenarios, network-free, mock-`dig`), and
shellcheck is part of the gate.

## Zero dependencies, zero cost, on purpose

`brew install cyberd4ch/dnswatch/dnswatch` (sha256-pinned release — the
[tap](https://github.com/cyberd4ch/homebrew-dnswatch) verifies the artifact
and drops the signature table in `share/`), or
`git clone https://github.com/cyberd4ch/dns-watch && cd dns-watch` — you
need `bash` and `dig`. That's it. The free plan doc behind this project is
one sentence: stock monitoring seats price out the solo hunter, and the
wedge isn't "cheaper SaaS", it's free and log-first. If it catches a stale
CNAME for you, [the README's sponsor link](https://github.com/cyberd4ch/dns-watch#readme)
funds a month of resolver and hosted-instance costs — and signatures or
packaging PRs count for more than money.

## One live number

The tool has been running every six hours on an actual closed-clean
engagement estate: 21 tracked names, 20 aliased hosts, **0 dangling
chains** across the baseline and every run since. That's the tool doing
its job in the boring direction — being quiet while nothing moves — and
it will say so loudly the day a Route53 corner of that estate starts
dangling.

Install, cron line, targets-file format, and the takeover-drill story are
in the [README](https://github.com/cyberd4ch/dns-watch#readme). Issues
open, first-timer issues flagged, MIT license — break it and tell me.
