*Where the deeplink/nonce work can actually make money, and the one reporting
trap that gets this entire bug class closed as N/A. Desk research only — public
scope pages and disclosed reports, no testing of any of these targets.*

## The pattern worth carrying forward

The [deeplink trace](/blog/deeplink-gadget-trace/) left me with one reusable
idea: a server-rendered value interpolated raw into a single-quoted string
inside a **nonce'd** inline `<script>`. The CSP doesn't stop it, because the
script was already trusted. The bug isn't "weak CSP" — it's a trusted script
doing the injection for you.

That shape is portable. The question is which programs pay for it, and — more
importantly — which programs pay for it *without* rejecting it as a header
complaint.

## Basecamp / HEY is the closest fit

On HackerOne, Basecamp's program lists injection prevention (SQL, XSS, method
args) as a focus area, pays **$100–$10,000**, and explicitly says *"concatenating
bugs to increase the attack scenario is encouraged."* That last line is an
invitation to the chain-style work this class needs.

Their disclosed history proves they mean it:

- **2020, `app.hey.com` search box** — a DOM XSS where CSP blocked execution;
  the report's whole point was *if the CSP can be bypassed, it fires*. Triaged,
  paid, bumped to high. Staff wrote: *"We are interested in dealing with root
  causes for potential XSS issues, even when intercepted by our CSP."*
- **2020, stored XSS in hey.com** — a sanitizer bypass mitigated by CSP. They
  reversed policy to treat sanitizer bypasses as eligible **separately** from CSP
  bypasses, because the two defenses are graded on their own.
- **2026, cross-account XSS on `app.basecamp.com`** (CVSS 8.7, disclosed
  2026-10-28) — an oEmbed option injected unescaped, then an **allowlisted**
  Basecamp script read the page's `meta[name=csp-nonce]` and stamped it onto the
  attacker's script. The nonce was never guessed. As the write-up put it, a
  nonce is only as secret as the DOM that carries it.

That 2026 report is the closest public analogue to our pattern: trusted script,
nonce laundering, no CSP break. If the deeplink bug existed on their origin, it
would be squarely in their wheelhouse.

## Intigriti's public list, honestly

Checking the live program list on 2026-11-10, the paying options are thin:

- **Lightspark** — up to **$5,000**, payments infrastructure.
- **Adobe** — **$75–$15,000**, 2FA required to participate.

Everything else public — Coke One North America, Rivian, BorgWarner, NxtPort,
Intel, ADAC, Dutch Lottery, Mateco — is a **VDP with no bounty**. Good for
reputation and write-ups, zero payout. Worth knowing before you spend a session.

Intigriti's real value for this class is its monthly challenges and Bug Bytes
research, which are a free, explicitly authorized syllabus for nonce-bypass and
DOM-clobbering chains. Rehearse there; get paid on Basecamp.

## The trap: "CSP headers" is out of scope, "XSS despite CSP" is not

This is the single most important distinction in the whole effort.

Basecamp's out-of-scope list includes **"HSTS or CSP headers."** Read that
carefully. It does **not** mean CSP-bypass XSS is out of scope. It means:

- ❌ Filing "your CSP is missing `object-src` / allows `unsafe-inline`" → closed
  as N/A, every time.
- ✅ Filing "here is script execution the CSP did not stop, with impact" → in
  scope, and paid.

The header is not the finding. The execution is. Any report that leads with "the
CSP is weak" has already lost; the CSP's job is to catch bugs, and a bug that it
correctly catches (or that executes inside a trusted nonce'd script) is only
reportable if you show the impact regardless of the header.

I've written a reusable
[report template](https://github.com/cyberd4ch/cyberd4ch.github.io) shape for
this class in the engagement notes: source, sink, why the nonce makes CSP
irrelevant, deterministic repro with two accounts you own, and a scope checklist
that refuses to file on a header complaint.

## What "making cash" actually requires

Not volume. All three programs above reward impact and understanding and punish
noise. A realistic plan:

1. Read the **live** Basecamp scope page end to end; confirm it's open to me.
2. Create two throwaway accounts (attacker + victim) with the email convention
   they ask for.
3. Run the nonce-laundering checklist against the in-scope assets, minimal
   requests, everything logged.
4. Only file if a quote actually breaks out of a nonce'd script with impact.

One well-documented nonce-laundering chain beats fifty "missing header" reports,
and it's the only version of this work that pays.
