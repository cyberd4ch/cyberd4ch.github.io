---
title: "when dig lies: building a DNS drift watcher that survives a NAT'd VM"
date: 2026-11-07
category: technical
ai-assist: 100
tags: [dns, shell, tooling]
topics: [bug-bounty]
excerpt: "five rebuilds, three false walls, and the two design decisions that make a diff trustworthy instead of merely present."
---
*Part 2 of 3. Part 1 is the
[one-curl-per-host methodology](/blog/one-curl-per-host/); part 3 is the
[zero-findings math](/blog/when-templates-find-zero/).*

Repo: https://github.com/cyberd4ch/dns-watch (v1.1.0 — `dnswatch.sh`, MIT,
offline test suite, CI, pluggable takeover-signature table). The story
below is the compressed debug trail that produced it.

## The problem

Between bounty sessions — sometimes two weeks — the DNS posture of a target
estate is a live document nobody is reading:

* a CNAME goes stale → subdomain-takeover candidates;
* a wildcard `*.zone` record appears → new lookupable attack surface for
  credential harvesting
* a pre-launch hostname resolves for the first time
  (this engagement had one: a name existing only inside a **CSP
  `connect-src`** directive and nowhere in DNS);
* an apex with a zone but **no A record** stays "nothing" until the day an
  A record silently appears.

So: watch the zone. Snapshot it, diff it, log it. Sounds like a 10-minute
script.

It was a five-version rebuild, and the failures were the interesting part.

## What broke

### v1 — the system resolver inside the VM flapped

The Kali VM's NAT resolver (`10.0.2.3`, the DHCP default) intermittently
**timed out** on two hosts mid-snapshot, writing them as empty. Two hours
later a snapshot showed the same hosts at full length. First `CHANGES`
block: **garbage**. The watcher had surfaced resolver noise, not drift.

### v2 — no, it wasn't (just) timeouts

Switched to public resolvers (`1.1.1.1`, then `8.8.8.8` on empty) — *still*
generated a spurious `CHANGES`: same host, empty answer in one run, full
answer in the next, with zero local changes. Root causes found:

* multi-record answers arrive in **arbitrary order** per query — my snapshot
  kept the raw order, so "IPs shuffled" outranked "nothing changed";
* a `printf '%s\n' ""` idiom emitted a literal newline, so **empty answers
  tested non-empty** in the canary display.

Fixes: sort every answer before storing (order is resolver noise), and treat
a truly empty answer as empty — "none", not ";".

### v3 — the over-engineered retry

Added a third resolver (9.9.9.9) and three retry epochs per query. Result:
runs took **five minutes and 40 seconds** because 9.9.9.9 was
**black-holed by the NAT** — every NXDOMAIN-shaped query burned 12 dig
timeouts before falling through. Lesson: every "just add a fallback" needs
a budget, or the fallback becomes the new failure mode.

### v4 — the actual engine: TCP

The difference between "flaky" DNS and "reliable" DNS was transport. A
single continuous TCP query (`dig +tcp`) returned the same answer on every
consecutive run for the full estate. That one flag removed *all* of the
flapping. UDP through the NAT was dropping packets under burst load; I was
chasing infrastructure that dig had already solved for me.

### v5 — trust, but verify: the health control

Even with TCP, one failure mode remained: what if a resolver outage
*coincided* with real drift, or produced all-empty output that looked like a
zone wipe? The fix is the health control: every run must first resolve a
**known-stable name that carries a known-stable IP**. If that probe fails,
the run logs `SKIP` and refuses to diff. A watcher that can lie is worse
than no watcher; one that says "SKIP" is honest.

## What the final design does

1. Reads a targets file (one FQDN per line, comments allowed).
2. Resolves A + CNAME per host, TCP, resolver fallback, **sorted answers**.
3. Writes a snapshot whose **content is timestamp-free** (timestamp lives in
   the filename) so the diff is pure value-change.
4. Diffs newest vs previous snapshot; appends `CLEAN` or a `CHANGES` block
   to an append-only log.
5. Wildcard canary: a fresh random label under the watched domain every run,
   logged **outside** the snapshot so it never trips the diff. Non-empty =
   wildcard appeared.
6. Optional `-c name:ip` health control gating every run.

Full debug trail, mock-`dig` test suite (six scenarios, network-free), and CI
config are in the repo.

## Honest positioning

Is it novel? Not centrally. `dnstwist` finds lookalike domains, takeover
checkers test one instant in time, Detectify-style SaaS monitors at prices
solo hunters don't want to justify for one estate. dnswatch is the gap
version: one file, one cron line, a log you can grep in five seconds, zero
cost. For a sustained engagement on a mid-sized estate that's the version
that actually survives the six-week reality check.

If you ship it into your own workflow, the two things I'd insist you keep
from my version are the **health control** and the **sorted-answer diff**.
Everything else is negotiable. Those two are what make the output trustworthy
instead of merely present, and they are exactly the two things I deleted
twice in my own first pass.

## Free, on purpose

The tool is MIT and it stays that way. The reason is not anti-SaaS
posturing — it's who the tool is actually for. Solo hunters and small
volunteer-run orgs watch five to fifty domains on a bounty budget, and the
existing monitoring market is priced for security teams wearing a corporate
card. That split (SaaS monitoring above, one-shot CLI utilities below) is
exactly where dnswatch sits: log-first, precise, and **free forever** — no
freemium tiers, no premium gates, no feature locked behind a signup.

Concretely, that means:

* **The OSS script is the product.** One file, one cron line. If you want
  drift monitoring and you can run cron, you're done — the repo is the
  install, not a funnel into a dashboard.
* **First-timer-friendly contributions are the sustainability plan.** The
  repo's [CONTRIBUTING.md](https://github.com/cyberd4ch/dns-watch/blob/main/CONTRIBUTING.md)
  reserves good first spots for exactly this audience: extending the
  pluggable takeover-fingerprint signature table (match CNAME drift against
  known provider fingerprints — kept deliberately conservative, because a
  wrong "takeover candidate!" flag is worse than a quiet one), and
  packaging so the tool is one install away on any machine.
* **Money is optional and flat.** If dnswatch caught a stale CNAME for you,
  the GitHub Sponsors link funds a month of resolver costs. There is no
  cadence tier, no seat, no card.
* **If a hosted instance ever exists, it's a free community service, not an
  upsell.** Sign-up-by-request, hard domain caps, running this same engine
  unmodified — and if abuse or cost ever forced it to change character, the
  answer would be to shut it down and keep the script, never to monetize
  the cron. The script is the product; that boundary is the point of the
  whole free stance.

The one sentence version, and I'd rather be judged against it later than
quietly walk away from it: *git-diff for your attack surface's DNS — free
forever, because the people who need it most are the ones who can least
afford a SaaS subscription.*
