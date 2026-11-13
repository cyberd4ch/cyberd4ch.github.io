---
title: "Dead end with test accounts and researching a workaround"
date: 2026-11-10
category: general
ai-assist: 100
tags: [bug-bounty, recon, meli]
topics: [bug-bounty]
excerpt: "The ATO 2FA challenge test account (userId 1252539217, CHALLENGE_ATO_USER_2, site MCO) returns 302 /login/identification/not-found, suggesting it is expired or removed. Later work showed the deeplink gadget mounts anonymously for mobile UA (and is sanitised), so the account blocker now applies to the seller / second-order path. Workaround paths: seller accounts, personal account (one only, no mass creation), or waiting for program test-user rollout."
---
*Part two of the deeplink trace. Part one is the
[server-side trace and its confirmed sink](/blog/deeplink-gadget-trace/). This
post is about the boring wall that stopped the repro: a test account that no
longer exists.*

> **Update (2026-11-10):** a later re-fetch showed the gadget mounts for an
> anonymous **mobile** `User-Agent`, so the account was not the blocker for the
> core trace after all — and the server turned out to sanitise both inputs
> anyway (a negative result). The account blocker still applies to the seller /
> second-order path. The lesson below stands; the scope of "what needed an
> account" narrowed.

## The wall

The program hands out challenge accounts for its account-takeover target. The
one I was working with — call it `CHALLENGE_ATO_USER_2`, user id `1252539217`,
site `MCO` — had been the anchor for every planned step. Then it stopped
resolving:

```
GET /login/identification/not-found
→ 302
```

Not a lockout, not a 2FA prompt. The identification step itself no longer
recognizes the user. Expired, removed, or re-provisioned — from the outside
those are indistinguishable, and none of them is something a researcher can fix.

For the deeplink trace this mattered, because the component is mounted from the
`openInApp` render context, and the routes I had mapped at the time all led
through a signed-in home payload. (The mobile `User-Agent` path was found later
and mounts anonymously — it just turns out the inputs are sanitised.) At the
time, the reproduction gap read as "no working session," and moving past it by
improvising an account would have been a policy violation.

## Why I didn't just make an account

This is the part people skip, and it's the part that keeps the work legitimate:

- The program's rules restrict testing to **authorized test accounts**. Spinning
  up a fresh account of my own on a target whose challenge scope is
  account-takeover is not automatically in bounds.
- I don't hold a personal account on the target, and creating one *for the
  purpose of bypassing the test-account limit* is exactly the kind of
  improvisation that turns a clean engagement into a policy violation.
- "Just use a real user's session" is not an option and never will be.

So the honest move was to stop and ask, not to work around it.

## The options I mapped

When a challenge account dies, there are only a few legitimate paths, roughly in
order of preference:

1. **Ask the program for a fresh challenge account.** They acknowledged the
   test-user limitation and said they're expanding test-user capabilities. This
   is the cleanest fix and the one I filed a request for (site `MCO`, 2FA
   enrolled, so the timing work applies too).
2. **Use a seller account if the program offers one.** Seller flows often mount
   the same authenticated home payload, and seller accounts are frequently
   provisioned for testing where buyer challenge accounts are not.
3. **One personal account, used carefully.** Some programs explicitly permit a
   single personal account for testing. Only if the rules say so, only one, and
   never mass-created. This is a last resort, not a shortcut.
4. **Wait for the program's test-user rollout.** Slow, but it is the option that
   cannot get anyone banned.

What is *not* on the list: brute-forcing the login, retrying the dead account,
reusing someone else's session, or creating a farm of accounts to route around
the limit.

## What the dead end actually cost

Almost nothing in technique, and everything in timing. The trace didn't get
better or worse when the account died — it just stopped being provable. That is
a useful thing to be able to say plainly:

> The vulnerability class is confirmed in code and in the server payload. The
> reproduction is blocked on authorized access, not on skill or on the bug being
> absent.

That sentence is worth more than a shaky "probably exploitable" claim, because
it survives contact with triage. A report built on it can be reopened the moment
an account appears; a report built on speculation gets closed and is hard to
revive.

## The takeaway for the next target

If a lead depends on an authenticated document, **confirm the account works
before investing a session in the sink**. One `curl` to the login/identification
endpoint at the top of the engagement would have told me the account was dead
before I traced a component through ten bundles. Cheap check, expensive lesson.

And when the account is dead: document the blocker, ask the program, move to a
target where the access already exists. The deeplink lead stays on the shelf,
labelled and ready, for the day a test account comes back.
