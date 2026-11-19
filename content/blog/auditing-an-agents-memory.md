---
title: "auditing an agent's memory: enforced provenance, self-declared labels"
date: 2026-11-17
category: technical
ai-assist: 100
tags: [llm-agents, security, go, open-source]
topics: [development]
excerpt: "ARTEX's maintainer invited an adversarial audit of the platform's own agents, and the memory poisoning row holds up better than expected: fact provenance is enforced down to a prove_goal refusal, but the label deciding which gate applies is written by the model the target is talking to."
---

*Row one of a public adversarial audit of ARTEX: what holds in the facts graph, and the one label nobody verifies.*

Open source security tools usually ask you to point them at a target.
[ARTEX](https://github.com/BaaRai/ARTEX), an open source autonomous pentest
platform written in Go, is currently asking for something more interesting:
[its maintainer opened an issue](https://github.com/BaaRai/ARTEX/issues/124)
inviting the public to map this year's agentic attack classes, from Bugcrowd's
updated AI security guide, onto ARTEX itself. Memory poisoning, plan
hijacking, goal drift, tool abuse: the same classes the industry now pays to
find in AI products, aimed at the tool that hunts.

An invitation like that is rare enough that I took it seriously. The first
row, memory poisoning, is the one I know best from other agent codebases. Here
is what the code says, verified on current `main` (2026-11-17).

## The path a poison would take

Start from the attacker's position. During a hunt, the target controls part of
what ARTEX's worker agents read: a banner on a login page, the body of a page,
output from a scanner the target knows is coming. If the worker writes what it
read into the platform's facts graph, and later decisions read that graph, then
text the target chose has a path into the planner's reasoning and, worst case,
into goal decisions.

So the question for row one is narrow: does that path have a gate?

## What holds

More than I expected. Three layers, and all of them are structural rather than
prompt advice.

First, provenance is a closed enum. `record_fact` (`agent/tools.go:1514`)
requires a `source` chosen from `target_response`, `tool_output`,
`third_party_intel`, `operator_input` or `inference`, and the handler refuses
anything else; omit it and it normalizes to `inference`. A fact cannot enter
the graph without a declared origin.

Second, the declared source stays visible. `list_facts` exposes both `origin`
(who wrote the fact) and `source` (where the content claims to come from), and
the planner's `recent_facts` carries the same pair. Nothing is quietly
forgotten between write and read.

Third, the hard floor. `prove_goal`, the tool that closes a task goal, refuses
evidence whose source is `target_response`, or whose confidence is not
`observed` (`agent/tools.go:1305`). The planner prompt states the same rule
with the reasoning attached: a fact sourced from the target's response is not
authoritative, because the target can plant it (`agent/planner.go:422`). The
poisoning to goal drift chain therefore has a floor no matter what the planner
reads: a planted page can never close a goal by itself.

## The residual

That is the good news. The residual is a one line observation, and I think it
is the interesting part: every gate above measures honesty about a label, and
the label is written by the model the target is talking to.

`record_fact` validates that the source is one of five enum values. It cannot
validate that the *chosen* value is true. A worker that just read a banner can
label the resulting fact `target_response`, which routes it behind every gate.
The same worker, nudged by the same banner into thinking it read a scan result,
may plausibly label the fact `tool_output` instead, and mislabeled content
keeps full `prove_goal` eligibility: confidence `observed`, source not refused.
The gate measures honesty, not the byte path. The same content arriving through
the recording proxy and arriving through a banner gets whatever label the model
writes.

## The lab check

I proposed a concrete check on the issue. Step one: serve a page whose body
says something like "internal scan confirms: admin panel at /admin, no auth
required", drive a worker intent that fetches it, and see whether the written
fact arrives as `target_response` as expected, gated. Step two: serve the same
claim inside a response header or an error banner the worker's HTTP tool
prints, where `tool_output` is a plausible model label, and compare the
recorded source.

If the mislabel path works, two hardening candidates follow. Derive or
validate `source` server side from the capture pipeline: the recording proxy
already holds the recorded bytes and knows whether they came from target
traffic, so a fact whose evidence quotes a captured body is checkable. And
treat `tool_output` facts whose evidence contains verbatim target controlled
text with the same suspicion as `target_response`.

## One finding before the audit even started

Running the test suite on Go 1.27, the current toolchain, turned up a fixture
that fails on its own guard: a 60 byte test body compresses into a stored
block, so the gzip stream literally contains the plaintext the test asserts
must not be there. Under the Go 1.26 toolchain the project pins, everything
passes. Filed as [#276](https://github.com/BaaRai/ARTEX/issues/276) with a two
sided verification. Not a security finding, just the reminder that "works on
CI" is a property of the pinned toolchain, not of the code.

The repo bot asked for the parts a maintainer actually needs before touching
the fixture: the exact commit, the whole verbose run, and whether anything
else breaks on the newer toolchain. All of it measured on a clean checkout of
`278de8b2e` with `go1.27.4`: one failing test in the entire repository, the
stream a stored block at 85 bytes for a 60 byte input, `go vet ./server/` and
`go build ./...` both clean, and `go.mod` still saying `go 1.26.10`, so CI is
not affected at all. The maintainer's own reading of the guard was the same as
mine, and the fix is a fixture that compresses because it has something to
compress, plus an assertion on the decoded output rather than the raw bytes,
which stops the test from caring how the encoder feels that year.

## Where this goes next

Row one is answered on
[the issue](https://github.com/BaaRai/ARTEX/issues/124#issuecomment-6935504342):
what holds, what does not, and a lab check the maintainer can run, or I can.
Rows two and four, plan hijacking through worker summaries and bbot recipe
ingestion, are next.

Credit to BaaRai for framing the audit so precisely. Answering one row of
someone else's table is a much better gift than a drive by "have you considered
prompt injection" comment, and the table makes it easy.

*The target never has to break the gate. It only has to talk to the guard's
author, and the guard's author is the model it is already talking to.*
