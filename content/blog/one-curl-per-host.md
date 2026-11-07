*Part 1 of 3 from a bug-bounty engagement log. Part 2 covers [the DNS watcher
I built to survive this hunt](/blog/building-dns-watch/); part 3 is the
[honest math of 6,665 templates finding zero](/blog/when-templates-find-zero/).*

## The setup

Nineteen hosts on one administrative suffix, all fronted by some combination
of CloudFront, Envoy and a zero-trust gate. Nuclei had already run the whole
estate and found nothing. Most hunters would call that "the wall." The actual
wall is closer, and thinner: everything interesting was visible in the
**302 responses**, and every one of them required exactly one HTTPS request
per host to see.

The discipline I settled on: **one curl per host, budgeted**, everything
logged, no fuzzing. Not because aggressive scanning is inherently wrong, but
because (a) the program's triage rewards understanding, not volume, and (b)
on an estate like this the useful signal lives in a single response — what
the gate *names* in its redirect, which cookies get cleared, which SSO
provider each flow remembers. Those come free with `curl -sSI`.

## The taxonomy fell out of one evening

Sorting nineteen `Location:` headers produced three clean groups:

* **Group A (10 hosts):** 302 → Google IAP OAuth. Same `client_id` across all
  ten, PKCE S256, a ~1.7k-character `state`. One shared entrypoint IP.
* **Group B (3 hosts):** 302 → `<self>/app/UserHome?iss=<self>&session_hint=AUTHENTICATED`
  (an Okta enduser hop, it turned out), clearing `sid`/`xids` cookies first.
  Two of the three were test/preprod custom domains on an Okta *preview* org.
* **Group C (4 hosts):** uniform **403 at the CloudFront edge**, no upstream
  visible at all.

Three reads, and the estate had a shape. That is the whole pitch for
low-and-slow: you can hold a 19-host attack surface in your head, and then
actually browse the two or three flows that matter instead of automating
noise.

## The 403 wall that wasn't

Group C deserved a paragraph of humility. Every tool and every default curl
UA got the same edge 403; it looked like geo-blocking or WAF-on-content.
Retested from a browser: **wide open**. The edge was filtering on the
**User-Agent and HTTP version fingerprint**, not the content. Browser UA +
HTTP/1.1, and all four hosts answered `200`/`302`/`400` sensibly.

Lesson, and it cost me two sessions of assuming a dead surface: before you
label any gate "locked," replay one request with `-A "Mozilla/5.0 ..."` and
note `--http1.1` versus h2. If you run through a VM with a NAT resolver
(see part 2 — this hunt's DNS confusion was the same species of false wall),
re-test assumptions that "failed" once. Flapping infrastructure is not a
finding, but it will happily impersonate one.

## What the cheap intel bought

Gate anatomy is not a vulnerability. It's a map, and the map is what makes
the manual work cheap:

* the **apex** had a Route53 zone but *no A record, no MX* — explaining a
  curl that failed silently the previous session;
* **no wildcard A** on the zone, so the subdomain surface was exactly the
  enumerated set (no phantom surface);
* one **10-second, client-IP-bound RS256 token** minted by one host for the
  next step of an SSO dance — read-only decoded for context, never tampered;
* Group B turned out to be Okta-native, which redirected a planned "generic
  PingFederate hint-trust" test into a much more precise one — that closed
  clean too, but *only after* the reclassification.

Total probes fired for all of this: **about one-and-a-half per host.**

## What I'd tell a younger me

1. **Kill volume, buy depth.** One scripted retry per host per session, and
   the notes file becomes an actual picture instead of a haystack.
2. **Map the SSO.** In 2026, "which identity provider, which org, which flow
   shape plagiarizes which" is recon. The redirect chain is a config
   disclosure that vendors leave out for legitimate reasons.
3. **Fingerprint errors are findings-shaped noise.** The two-wrong-readings
   bugs in this engagement (UA filter, resolver flapping) were both fixed by
   *adding one controlled variation*, not by hammering harder.
4. **Log everything, including clean results.** "Checked, secure" is an
   asset. Two things that look closed-clean today (a CSP-mentioned
   `login-beta` bar hostname, an apex with zone-but-no-records) are standing
   watch items precisely *because* they were logged as unresolved leads
   instead of failures.

Nothing in this post admits a finding — that's on purpose. Some sessions a
hardened estate just tells you who built it well. The rewardable work came
from the manual flows on top of this map, and from realizing the estate's
DNS is a *live document* that nobody re-reads — which is what part 2 is about.

## One commitment from this series

The tools that fell out of this engagement ship free and MIT — the DNS
watcher of part 2 chief among them — with no freemium future planned and no
premium gates to come. Not because free is a marketing number, but because
the people who most need drift-watching between sessions are running bounty
budgets, not corporate cards. If a script from this series saves you a
session, contribute a feature (its
[CONTRIBUTING guide](https://github.com/cyberd4ch/dns-watch/blob/main/CONTRIBUTING.md) reserves
the good first-timer spots) or sponsor a month of resolver costs. Anyone
else pays what you paid: zero.
