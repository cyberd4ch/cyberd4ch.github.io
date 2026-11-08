*Release notes. The series: [part 1](/blog/one-curl-per-host/),
[part 2](/blog/building-dns-watch/), [part 3](/blog/when-templates-find-zero/).*

**dns-watch** is one shellfile that diffs DNS for a bug-bounty scope: one cron
line, one readable log, no dashboard, no API keys. v1.1.1 adds no new DNS
behavior — the diff engine, the takeover tagging and the signature table are
byte-identical to v1.1.0. What changed is how the tool reaches you, which for a
dependency-free script is the part that actually decides whether anyone runs
it.

## What v1.1.1 adds

**The tarball is reproducible.** `scripts/build-release-artifact.sh` builds the
release artifact twice and refuses to publish unless both runs land the
identical sha256, the payload's root entry is unchanged, and the tarball name
and version match the engine's own `VERSION` constant. Run it yourself at any
time:

```sh
make release-artifact          # -> /tmp/dnswatch-1.1.1.tar.gz + sha256
```

That check is scenario 8 of the offline suite, so it runs in the same `make
test` as the DNS logic — packaging can't rot quietly between releases.

**The tap bumps itself.** Tagging `vX.Y.Z` now triggers a workflow that builds
the artifact, computes the pin, and commits the formula update to
`cyberd4ch/homebrew-dnswatch`. The sha256 in the tap is the sha256 the test just
reproduced; there is no window where a human copies a hash by hand. Install or
upgrade:

```sh
brew install cyberd4ch/dnswatch/dnswatch     # first time
brew upgrade dnswatch                        # from v1.1.0
```

The formula verifies the pinned artifact and drops `signatures.tsv` into
`share/dnswatch/`, so `-T` works without a checkout.

**Homebrew is the first path in the README, not a footnote.** The docs now lead
with the tap, then the tarball, then `git clone`. All three end in the same
`dnswatch.sh`; only the update story differs.

Also in v1.1.1: the offline suite is **eight scenarios / 33 assertions**, with
shellcheck gating the engine, the tests, the mock `dig` and the artifact script
in CI.

## Why a packaging release counts

A DNS watcher is only useful if it is running on the box you actually hunt
from, on a cron line you wrote months ago and forgot about. Tools that need a
build step, a virtualenv or a "just clone it and remember the path" incantation
get abandoned — and a watcher that got abandoned is worse than no watcher,
because it is a false all-clear on the exact interval where a dangling CNAME
matters.

So the release criteria were about trust, not features:

- **the pin is the point** — a Homebrew formula whose sha256 anyone can
  reproduce is a claim you can check, not a claim you have to believe;
- **the signature table ships with the binary** — `-T` pointing at `share/`
  means the takeover drill works on a fresh laptop with no repo;
- **no new code paths** — v1.1.1 changes nothing that reads DNS. Upgrading from
  v1.1.0 cannot change a verdict, only the install.

## The honest footnote

Reproducibility here means *the recipe is deterministic* — same script, same
input, same bytes, twice. It is not a hermetic build attestation: there is no
compiler and no toolchain, so there is nothing to rebuild from source beyond
`tar` itself. The check is cheap to run and it caught real drift while this
release was being cut, which is the only bar a solo-maintained project has to
clear.

`brew install cyberd4ch/dnswatch/dnswatch`, or
`curl -sSL https://github.com/cyberd4ch/dns-watch/archive/refs/tags/v1.1.1.tar.gz | tar -xz`,
or clone it. Then: one cron line, one log, and the interval when nobody is
looking becomes legible.
