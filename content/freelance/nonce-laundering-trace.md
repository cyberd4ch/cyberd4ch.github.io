# Case study: nonce-laundering trace in a production bundle

**Engagement:** authorized web-security research on a large commerce platform.
**Role:** independent security researcher.
**Deliverable:** a verified input map, a reproducible bundle set, and a small
scanner — ending in a documented **negative**.

## The problem

Modern apps routinely build inline `<script nonce="…">` blocks by concatenating
server values. A quote in one of those values breaks out of the string — and the
CSP never sees it, because the script was already trusted. This is
**nonce laundering**: the trusted script does the injection for you.

The question: does this app have that shape, and can an attacker actually reach
it?

## Approach

1. **Pull the real code.** Download the public home bundle and its chunks; record
   SHA-256 for each so every claim is reproducible.
2. **Find the sink.** Static scan for `${…}` interpolated into a template literal
   that also builds `<script>` / `window.location` / `innerHTML`.
3. **Find the call site.** Trace the component's props back to the server render
   context (`_n.ctx.r.openInApp`), including the gate
   (`shouldRedirect`) that decides whether it mounts at all.
4. **Find the source.** Probe each candidate input with a benign marker, then a
   dangerous one, and watch the emitted script:

   | Input | Observed | Verdict |
   | --- | --- | --- |
   | query string → `redirectUrl` | reflected for benign chars | candidate |
   | `'` in query | `redirectUrl` set to `null` | blocked by guard |
   | `\` in query | stays percent-encoded | safe |
   | `</script>` in query | edge block page | safe |
   | `x-d2id` non-UUID | `deeplink` set to `null` | blocked by validation |
   | `x-d2id` with `"` / `</script>` | JSON/HTML-escaped | safe |

5. **Check other chunks.** A second nonce-copy helper existed in a viewability
   bundle, but its input was ad config and the ad path rendered in a
   cross-origin iframe — no in-scope caller.
6. **Compare hosts.** The same quote guard held on the sibling country site; a
   payments host was a different application that never mounted the component.

## What was delivered

- A verified input map: exact props, server origin, mount gate, and the outcome
  for every reachable input.
- A byte-for-byte bundle set with `SHA256SUMS` and a rate-limited fetch script.
- A reusable scanner (`security-toolkit/nonce_scan.py`) that flags
  nonce-copy helpers and script-literal interpolation.
- An honest **negative**: the sink is real, the mount is real, the sanitiser is
  real, and there is no execution on the tested paths.

## Result

No vulnerability. The server validates the deep-link id as a UUID, nulls the
redirect URL when the query contains a quote, and an edge blocks `</script>`.
The value of the work is that the client now **knows** this — instead of a
speculative "looks exploitable" report that triage would close.

## Why this matters to a client

- A rigorous negative is cheaper than a false positive: no wasted triage, no
  credibility hit.
- The input map tells your engineers exactly which fields are guarded and where
  the next bug would have to live.
- The scanner is reusable on every future release.

*Only public assets and in-scope endpoints were fetched; no authenticated
requests, no payloads beyond a benign marker, no scanning.*
