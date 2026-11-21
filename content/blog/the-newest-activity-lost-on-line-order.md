---
title: "the newest activity lost on line order: a review fix for the provenance tie"
date: 2026-11-21
category: technical
ai-assist: 100
tags: [llm-agents, security, go, open-source]
topics: [development]
excerpt: "The automated review on ARTEX #441 caught a real bug in the fact provenance lookup: it returned the newest activity matching the first evidence line instead of the newest activity matching any line, which could have made the traffic tie miss."
---

*Why a two-line test is not enough when the code loops over a list.*

The provenance patch I published yesterday ties a recorded fact to the activity that produced it. The lookup takes the fact's evidence lines and asks Postgres for the newest activity whose summary or detail contains one of them. I wrote a test with one recorded activity and one quoted line. It passed.

The automated review on [PR #441](https://github.com/BaaRai/ARTEX/pull/441) found the gap: the function queried one line at a time and returned on the first match. Given an older activity matching the first line and a newer activity matching the second, it returned the older one.

## Why the order matters

The tie is not only a label. It also sets the time window for the capture lookup in step 3. A fact whose bytes came back from the target is classified `target_response` only if the proxy captured those bytes near the activity timestamp. Ten minutes before, two after.

If the looked-up activity is the older one, the capture window sits around the wrong moment. The traffic store may hold the exchange, but the query never looks there. The fact then keeps `tool_output` instead of being reclassified, which is exactly the shortcut the patch exists to close.

So a wrong activity is not cosmetic. It can silently weaken the classification.

## What the code did

The first version looped over the evidence lines and returned at the first hit:

```go
for _, line := range lines {
    err := s.db.QueryRow(`SELECT id, created_at FROM activity
WHERE exploration_id=$1 AND node_id=$2
  AND (strpos(COALESCE(detail,''), $3) > 0 OR strpos(COALESCE(summary,''), $3) > 0)
ORDER BY id DESC LIMIT 1`, s.expID, nodeID, line).Scan(&id, &createdAt)
    if err == sql.ErrNoRows {
        continue
    }
    return id, createdAt, true, nil
}
```

The `ORDER BY id DESC` inside each query makes that line's newest match win. The outer loop decides which line gets asked first. The docstring promised the newest activity for any line, and the implementation did not deliver it.

## The fix

One query over all lines, with `unnest` turning the Go slice into a set:

```go
err = s.db.QueryRow(`SELECT id, created_at FROM activity a
WHERE exploration_id=$1 AND node_id=$2
  AND EXISTS (SELECT 1 FROM unnest($3::text[]) AS line
              WHERE strpos(COALESCE(a.detail,''), line) > 0
                 OR strpos(COALESCE(a.summary,''), line) > 0)
ORDER BY id DESC LIMIT 1`, s.expID, nodeID, lines).Scan(&id, &createdAt)
```

`EXISTS` stops at the first matching line for each activity, and the outer `ORDER BY id DESC LIMIT 1` picks the newest activity across all of them. One round trip replaces up to twenty.

The regression test appends the older activity first, then the newer one, and passes the lines in the same order:

```go
id, _, ok, err := s.ActivityContainingEvidence(intent,
    []string{"Server: nginx/1.25.3", "X-Powered-By: Express"})
if err != nil || !ok || id != newer {
    t.Fatalf("ActivityContainingEvidence = %d, %v, %v; want newest %d", id, ok, err, newer)
}
```

It also checks the no-match case returns zero and false rather than an error.

## What I should have tested

The original test had one activity, so line order could not matter. A list-shaped function needs a test with at least two items whose order is the thing under test, and the interesting case is the one where the first item is not the winner.

This is the same class of miss as testing a sort with an already-sorted input. The happy path agrees with the buggy implementation.

## What the review caught and what it did not

Audit Bench AI, which reviews the PR automatically, rated this high severity and listed it as the only blocking issue. It also flagged three pre-existing functions for branch count. Those were false positives: they are unchanged by the patch, and the tool was reading whole files rather than the diff. The bot said so itself on the next pass.

The useful part is that the ordering bug was real and cheap to fix. `go test ./agent ./db ./traffic` and the server's fact tests pass after the change, and CI is green on `42ce6ea`.

*Thanks to the Audit Bench AI review for finding it in a patch I had already called tested.*
