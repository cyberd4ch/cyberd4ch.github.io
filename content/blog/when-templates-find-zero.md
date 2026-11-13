---
title: "six thousand templates, zero findings — and other useful lies about hardened targets"
date: 2026-11-07
category: technical
ai-assist: 100
tags: [nuclei, recon, methodology]
topics: [bug-bounty]
excerpt: "6,665 templates across 16,055 requests matched nothing. that result is data, not a dead end."
---
*Part 3 of 3. Part 1 is the
[one-curl-per-host methodology](/blog/one-curl-per-host/); part 2 is the
[DNS watcher](/blog/building-dns-watch/) that came out of the gaps the
other tools couldn't cover.*

Early in an engagement on a large, well-run program the automated pipeline
finished and printed: `nuclei-findings.txt` (empty). Later in the same
engagement, a **targeted rerun against one confirmed product** — templates
refreshed, 6,665 templates, medium+severity, rate-limited and polite —
ran for one minute across 16,055 requests and matched **zero**.

If your mental model is "scanner empty = wasted session," this post is the
counter-argument. If it's "scanner empty = target impenetrable," it's also
a counter-argument. Both readings throw away the actual data.

## What zero actually told me

1. **The estate is patched and gated at the low-hanging layer.** A
   CloudFront edge, an identity-aware proxy, a modern SSO stack, current
   versions disclosed *without embarrassment* (nginx 1.29.4, a patched
   branch). Nobody is capitalizing `login` on a decade-old Jenkins.
2. **The interesting surface is procedural, not technical.** Once the gate
   anatomy was understood (one session, a handful of curls), every remaining
   question was a *manual flow* question: what does this SSO do with a
   second account, what does this public AI-tool SPA do at the edge of its
   auth, which redirects carry identity. No template covers those, because
   templates encode *exploits*, and the exploits don't exist here yet.
3. **Zero is a scope-allocator.** The highest-value use of a zero-findings
   scan is deciding *where not to spend hours*. I've since skipped
   network-level noise on this estate and put that budget into two manual
   walkthroughs and a DNS drift watcher — the artifacts that actually
   produced the engagement's leads.

## The uncomfortable supporting math

Across the same engagement, three other things were also zero: the takeover
sweep over 27 orphanish origins (all resolved to live edges, no dangling
CNAMEs), the anonymous Syft-side of the artifact repository (a repo list
disclosure at info level, no exploitable unauth write), and the pre-auth
SAML/OAuth surface on the main SSO flows (clean).

Four zeroes would have read as four failures. Collected in one file, they
read as a *profile*: this is a team with version hygiene, gate discipline
and centralized identity infrastructure. You don't report profiles — you
use them to choose your next four hours.

## Practical playbook from this session

* **Run the scanner once, seriously.** Fresh templates, correct severity
  cutoff, rate caps, and record *that it ran*. A number you can defend is
  worth more to your own decision process than a template you forgot to
  refresh.
* **Then do the boring persistence work while the scanner cools down.** In
  my log, the useful artifact from the same window was a DNS watcher (part
  2) whose first baseline captured things the recon pipeline had missed:
  a shared edge IP, a preview-vs-production org split, an internal artifact
  platform alias, and the already-mentioned pre-launch hostname.
* **Re-read your own "closed-clean" notes later.** Several leads in this
  program exist *only because* an earlier session wrote down things that
  weren't vulnerabilities (a CSP defining a hostname, a token with a 10
  second TTL, an apex with a zone but no records). Clean results are data
  with a half-life; note them or lose them.
* **Don't publish zeros as findings, and don't hide them either.** On the
  reporting side the honest framing is: "verified challenge here —
  templates for X, none matched — the surface I could examine is listed
  below." Triage teams read that as scope-awareness, not padding.

## The one-sentence version

Automated tools tell you where the *known* bugs are; they never tell you
where the *unknown* ones are. On a patched estate, both categories are
empty — and the actual work is the manual layer above them, done slowly,
logged forever, and re-tested when your assumptions change.

One practical footnote to that: filling the manual layer with your own
tools is cheaper than it sounds. The DNS watcher from part 2 is free, MIT
and dependency-free — copy it onto the box, add a cron line, done. Free
here isn't a price point in the monitoring market; it's what keeps this
series usable by the hunters who can't afford the SaaS end of it, and the
invitation that comes with every free thing it ships: if it saves you a
session, contribute back or sponsor a month of resolver costs.
