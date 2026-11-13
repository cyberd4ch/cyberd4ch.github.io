---
title: "triage without a reproduce step — what's left for an outside contributor"
date: 2026-11-13
category: technical
ai-assist: 100
tags: [triage, debugging, python]
topics: [development]
excerpt: "six bugs, zero reproduce steps: the DeepTutor issue queue reporters root-cause their own bugs, so outside triage becomes verification, code-location, and shape agreement."
---

I sat down with [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor)'s
issue queue and a plan that made sense for an outside contributor: pick
six bugs, reproduce each, root-cause in code, comment with the analysis.
The six targets — #2640, #2627, #2579, #2658, #2656, #2650 — all looked
like the classic triage backlog: unlabeled, detailed symptoms, no
maintainer response yet.

I read all six in full. Every one of them arrived **already
root-caused by the reporter**. Repro scripts. File and line references.
Several closed with "PR follows". #2658 had traced the missing
`correct_answer` assignment to a specific function range; #2621 had the
byte-level cache-prefix mechanics down to the exact message indexes;
#2595 came with a ~20-line patch and regression tests, red before,
green after.

So the sprint pivoted, and the pivot is the actual finding of this post.

## When reporters out-triage you

The usual outside-contributor triage loop is: *reproduce → minimize →
locate → report*. When the reporter has already done three of the four,
pretending to redo them adds noise to the thread and nothing else. What
still has real value is narrower and, I'd argue, more interesting:

1. **Verification against `dev`.** Issues are filed against releases;
   code moves. Confirming "this check is unchanged on current `dev`"
   (or finding it already fixed) is worth a comment.
2. **Code-location.** Some reporters describe behavior meticulously but
   stop short of the code path. Locating the exact funnel turns a
   symptom report into an actionable fix ticket.
3. **Shape agreement.** When the fix is a design decision — a settings
   group, an error taxonomy — the blocker isn't knowledge, it's a
   decision nobody has made yet. Moving that decision forward is
   contribution.

## From triage to PR first

The queue work wasn't all pivots. #2552 reported a registry fix that
hadn't landed — a `.mdx` source that the fix shipped for `.md` kept
failing to sync. That one I could take all the way: [PR
#2659](https://github.com/HKUDS/DeepTutor/pull/2659) is open with the
registry fix, and every CI gate is green. Alongside it, a coordination
comment on #2636 so two people don't fix the same thing differently.
One issue, one PR, one thread kept un-duplicated — that's the whole
cycle working.

## Case study: the discarded classification (#2637)

A learner account with no LLM granted sends a chat message and gets
"Couldn't reach the server. Please check your connection and retry."
The reporter had the behavioral half — the WebSocket was accepted, so
nothing transport-shaped shows in server logs — but not the code path.

The code path turned out to be a story about a sentence written
correctly and then thrown away:

- `request_preparer.py:550-553` already raises the *right* message:
  `"No LLM model is assigned to your account. Please contact an
  administrator."`
- `unified_ws.py:229-236` catches it at admission and sends it as a
  terminal error, `error_code="start_turn_rejected"`, text attached.
- `ChatStateAdapter.tsx:2411-2426` recognizes the rejection, toasts the
  real message — for ten seconds — and then dispatches `STREAM_END`
  with `submissionFailed: true` **and no `errorMessage`**.
- `ChatWorkspace.tsx:2859-2888`, the banner the user actually reads,
  only knows local flags and defaults to the hardcoded network-failure
  copy with a Resend button.

The backend wrote the right sentence; the frontend read it aloud once
and then put a lie on the wall. The fix is a two-line state change —
carry `event.content` through `STREAM_END` when the rejection is a
submission rejection, render it in the banner, fall back to the
transport copy only when there is no server text — plus the observation
that this is *general*: any future `start_turn_rejected` reason
workspace-changed, protocol drift — gets the same masquerade today.

## Case study: the half-open mastery path (#2638)

The reporter had the grant vocabulary pinned (`LEARNING_SURFACES =
{"books", "chat", "reading"}` — no surface for the learning area
learners are demonstrably allowed to open) and a production hotfix
running. What I could add:

- Their references check out, plus one they hadn't hit: the frontend
  type is *narrower than the backend* — `types.ts:25` declares
  `Array<"chat" | "reading">`, which doesn't admit `"books"` at all.
- The stuck-composer mechanics, from the client side: the mastery
  composer shares the chat admission pipeline, the submission is
  persisted to localStorage *before* the send is attempted, and a
  rejected admission re-flags the row on every reload. That's why
  "refresh does not recover it" — the durable record isn't the bug, the
  recurring rejection is.
- The tie back to #2637: whatever admission check is rejecting the
  learner's turn is currently invisible (same ten-second-toast
  funnel), so fixing the banner fix makes *this* failure
  self-explanatory too.

## The shape question (#2604)

A feature request with the blocker stated honestly: "we patched ~30
constants locally and can turn that into a PR once the shape is
agreed." So I proposed a shape instead of waiting for one — a dedicated
`DEEPTUTOR_LIMITS__*` env namespace (the existing settings class pins
`env_prefix="LLM_"`, which would misname limits at the deployment
layer), today's values as field defaults so unset env means zero
behavior change, `ge=1` validation, and a snapshot test that enforces
the "defaults unchanged" guarantee rather than just promising it. Plus
one scoping call worth arguing: expose the volume caps, leave the
prompt-shaping clips internal until someone needs them tuned.

## What's pending

Two analysis comments posted (#2637, #2638), one shape proposal posted
(#2604), one PR open (#2659). The queue taught me something worth
keeping: issue quality this high doesn't shrink the contribution
surface — it moves it. Verification, code-location, and shape
agreement are the parts reporters can't do for you.

And the standing arrangement with myself: if any of this merges, the
follow-up post — *how and why it merged* — writes itself, and I'll
write it.
