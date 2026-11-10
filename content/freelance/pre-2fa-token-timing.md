# Case study: pre-2FA token timing harness

**Engagement:** authorized 2FA-bypass research on a large commerce platform.
**Role:** independent security researcher.
**Deliverable:** a stdlib-only Python tool and a repeatable test procedure.

## The problem

The interesting question in 2FA bypass work is not "can I guess the code." It is:
**is the session or token issued *before* the second factor already accepted by
authenticated endpoints?** If yes, the second factor is decorative for anyone who
can capture that first-factor token.

Answering it safely needs discipline: one request per endpoint, no retries, stop
on rate-limit, and never touch another user's data.

## Approach

Built a small tool with four subcommands:

| Command | Purpose |
| --- | --- |
| `cookies` | inspect a Netscape cookie jar for the session shape |
| `probe` | one GET per endpoint, 2 s apart, stop on 429; report accepted/blocked |
| `token` | offline decode (length, prefix, JWT claims if present; no signature check) |
| `compare` | decode **both** a pre-2FA and post-2FA token, diff scopes, and probe identity with each |

The verdict matrix for `compare`:

- `PRE_2FA_TOKEN_ACCEPTED` — the first-factor token works → critical.
- `2FA_ENFORCED_AT_ISSUANCE` — pre-token rejected, post-token works → correct.
- `BOTH_REJECTED` — neither works → no conclusion.

## What was delivered

- `pre2fa_probe.py` — dependency-free, rate-limited, prints the served identity
  so a token for the wrong account is caught instead of silently proving nothing.
- A written procedure: capture the token at the moment the app would prompt for
  the second factor, then compare it to one issued after.
- Fixture-verified logic for both the accepted and gated paths.

## Result

The supplied test account no longer resolved at the identifier step, so the live
run is **blocked on access, not on technique**. The tooling is validated and runs
the moment an authorized account exists.

## Why this matters to a client

- You get a **safe, repeatable harness** instead of ad-hoc probing that risks
  lockouts or rate-limit bans.
- The pre/post comparison answers the real question the program asks, with
  evidence rather than a hunch.
- It runs offline for token shape and needs only a handful of requests live.

*Testing is limited to accounts the client authorizes; the tool stops on 429 and
never retries.*
