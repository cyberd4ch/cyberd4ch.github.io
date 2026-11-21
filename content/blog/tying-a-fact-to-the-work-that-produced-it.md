---
title: "tying a fact to the work that produced it: server-side provenance for row one"
date: 2026-11-21
category: technical
ai-assist: 100
tags: [llm-agents, security, go, open-source]
topics: [development]
excerpt: "Row one of the ARTEX audit ended with an open question: the label deciding whether a fact can prove a goal was written by the model the target is talking to. I posted the rule for fixing it and then implemented it, so a fact now has to quote a line of the intent's recorded activity before it counts as evidence, and bytes the proxy captured coming back from the target are stored as target_response whatever the model declared."
---

*The label is gone from the trust path: evidence is matched against the activity log, and a miss costs the fact its authority.*

Two days ago I ended an audit of [ARTEX](https://github.com/BaaRai/ARTEX)
with a table where one row stayed open. Memory poisoning was mostly
enforced, except for a single step: a fact's `source` field, the label that
decides whether `prove_goal` will accept it, was declared by the model. A
worker reading a hostile page could copy "admin access granted" into a fact,
label it `tool_output`, and the goal gate would believe it.

[The maintainer asked for the rule](https://github.com/BaaRai/ARTEX/issues/124)
that would close it: which facts can be tied to a proxy-recorded exchange,
and what happens when there is no capture. I wrote the rule in the thread.
Then I implemented it, because a rule that only exists in a comment is still
a prompt.

This post is about the change, the places where it is lossy, and what it does
not cover yet. It is not merged, but it now includes all three steps of the
rule. The patch is [pull request #441](https://github.com/BaaRai/ARTEX/pull/441)
on `row1-provenance`.

## What the gate was trusting

The code path is short. `record_fact` builds a fact node with three fields
that matter here:

- `evidence`, one line of command plus output supporting the conclusion,
- `confidence`, either `observed` or `inferred`,
- `source`, one of `target_response`, `tool_output`, `third_party_intel`,
  `operator_input` or `inference`.

`prove_goal` refused two combinations: a fact that was not `observed`, and a
fact whose source was `target_response`. Everything else was authority. So
the model chose which gate applied to its own claim. The comment in
`agent/tools.go` said it plainly: "The confidence is declared by the agent
that recorded the fact."

The audit row was right. Nothing structural stopped a worker from writing the
target's sentence into a fact and typing `tool_output`.

## The rule, in three steps

The rule I posted asks the server to stop reading the label and start
checking the history:

1. Resolve the fact's intent. It already does this: `recordOneFact` validates
   that `intent_id` is a task intent and links `intent → yields → fact`.
2. Match the fact's `evidence` against that intent's recorded activities. The
   activity log holds the full tool output for each step, and
   `ExplorationStore.ActivityList` already returns it per intent.
3. Pin the match. Store the activity id on the fact beside `origin`, and make
   `prove_goal` require the tie. A missing tie is then a refusal rather than a
   second opinion about a label.

The server does not need a new tool for this, and the model does not get a new
field to fill. The tie is computed after the fact is written.

## What I implemented

Three places changed.

`db/exploration.go` gained `ActivityContainingEvidence`. It takes the intent
node id and the candidate evidence lines and asks Postgres for the newest
activity whose `summary` or `detail` contains one of them, returning the
activity id and its timestamp for the capture check:

```sql
SELECT id FROM activity
WHERE exploration_id=$1 AND node_id=$2
  AND (strpos(COALESCE(detail,''), $3) > 0
    OR strpos(COALESCE(summary,''), $3) > 0)
ORDER BY id DESC LIMIT 1
```

The match is literal and case sensitive. Evidence has to quote the recorded
output, not describe it.

`agent/tools.go` splits the evidence into candidate lines before that query.
Lines shorter than 12 characters are dropped, duplicates are dropped, and the
list is capped at 20. The threshold is there so a bare tool name or `200 OK`
cannot tie a claim to unrelated activity. `recordOneFact` then resolves the
intent first, so the tie is computed against the right trace, and writes three
new payload keys:

- `provenance`: `recorded_activity`, `operator_input`, or `unverified`,
- `provenance_activity_id`: the activity that carried the quoted line,
- `provenance_note`: why an unverified fact lost its authority.

When the server cannot corroborate a claim, it downgrades it rather than
deleting it. The content is still in the graph for the planner to read;
`source` becomes `inference`, an `observed` confidence becomes `inferred`, and
`provenance` becomes `unverified`. `prove_goal` now checks provenance before
confidence, so the refusal names the real cause instead of saying the fact
looked inferred.

An `operator_input` fact is exempt. Its authority is the human who said it,
not an activity, and no log line will ever contain it.

`compactNode` surfaces provenance anywhere facts are shown, so
`recent_facts`, `list_facts` and digest members all carry the tie or its
absence.

## Step 3: classify from the capture, not the declaration

The first version of the patch stopped at the activity tie, which left the
relabelling path open: text the target authored but that the model labelled
`tool_output` still counted as tool output. The traffic store already indexes
full request and response bodies for its full-text search, so the tie did not
need a new capture mechanism.

`traffic.Traffic.ResponseContaining` takes the candidate lines and the
activity's timestamp, searches the full-text index for captured exchanges
inside a window around that activity (ten minutes before, two after, because
the activity row is written when the tool call returns), then re-reads each
candidate's response side and requires the literal line there. Request-side
matches are ignored on purpose: a line appearing only in what we sent says
nothing about who authored the fact.

When a response match lands, `recordOneFact` overrides the declared source:

```go
if prov == factProvenanceCaptured {
    source = factSourceTargetResponse
}
```

It also stores `provenance_traffic_id` beside `provenance_activity_id`, so the
claim points at the exchange that carried the bytes. `prove_goal` already
refuses `target_response`, which means a target-authored fact now fails the
goal gate even when the model called it tool output. That is the point: the
target can write the sentence, but it cannot write the classification.

The lookup is optional by construction. `ToolSet` takes a small
`FactTrafficLookup` interface, wired from the server's traffic store into the
worker, planner and main-agent tool sets. When capture is off or the store is
unreachable, the fact keeps the activity-only classification instead of
failing to write.

## The cost, stated up front

Two things get worse before the model learns to quote output.

A tool that reformats proxied content breaks the tie. `grep`, `jq`, a
one-line `awk` over a page: the evidence is no longer byte-identical to the
activity, so the match fails and the fact downgrades. This is a false
negative in the safe direction. "Re-run it so the output is recorded" is an
acceptable answer, and precision matters more than recall here.

Facts imported from scanner output also lose the automatic authority they had.
`ingest_scan_output` and the bbot ingest write facts from typed parse results
with no matching activity, so they now arrive as `unverified` too. I adjusted
their dedupe key to ignore `source`, because a re-ingestion would otherwise
rewrite the same fact every run once the server started downgrading it. The
honest reading is that a scan file is not a recorded exchange either. Findings
remain the path that proves goals.

Facts written before this change carry no `provenance` key and keep their old
behaviour. I did not rewrite history.

## What is still missing

Capture has to be on. With no proxy traffic, the capture check finds nothing
and the fact keeps whatever the activity tie says, which is honest but means
the strongest classification is available only on captured exchanges.

The window is a heuristic. Ten minutes before the activity and two after
covers an ordinary tool call; a request that streamed for an hour would land
outside it and fail toward `tool_output`, not toward target authorship. The
bounds are constants, not a schema field, and a deployment with very slow
scans should raise the left bound.

Full-text search is a build option. On a build without the trigram index
there is no body search, so the capture check reports nothing and the
activity tie stands. The same is true for bodies above the index cap.

The rule still does not model whether a model obeys the untrusted-content
frame. It decides what can count as evidence. That distinction was in the
original row, and this patch does not move it.

## Verification

The test suite runs against a local Postgres, which is the same shape the
project uses in CI. The new coverage is in `agent/fact_provenance_test.go`:

- `TestFactEvidenceLines` pins the line filter: short fragments and duplicates
  are dropped, the cap holds.
- `TestFactProvenanceTiedToRecordedActivity` writes an activity, records a
  fact quoting one of its lines, and asserts the tie (`provenance=recorded_activity`,
  the activity id, source and confidence preserved) and that the fact proves a
  goal. Then it records a paraphrase of the same output and asserts the
  downgrade plus a `prove_goal` refusal with the goal still open.
- `TestFactProvenancePrefersCapturedTraffic` wires a fake capture store that
  answers with an exchange id, records an `observed` `tool_output` fact, and
  asserts the server stored `source=target_response`,
  `provenance=captured_traffic`, both ids, and that `prove_goal` refuses it.
- `TestResponseContaining` records a real exchange through the traffic store
  and checks the lookup matches the response, ignores a request-only line and
  an out-of-window capture, and stays quiet on a nil store.

Three existing tests changed because the behaviour changed on purpose:
`TestRecordFactStoresProvenance` and `TestFactProvenanceSurfaced` now expect
the downgrade for untied claims, and the top-level-copies test in
`fact_input_test.go` asserts the stored payload is the item's, then the
server's classification. `go test ./agent ./db ./traffic` and the server's
fact tests are green; the full server package has one environment failure on
macOS (`bind 127.0.0.2`), unrelated to this change. The commit is `c92c784` on
`row1-provenance`, rebased on current `main`.

All three steps of the rule are now in the patch and tested. Row one reads
`enforced` for the path the rule models, with the capture and window caveats
above. What it still does not claim is that a model cannot be persuaded; it
claims that persuasion cannot silently become goal authority.
