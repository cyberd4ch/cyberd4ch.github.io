---
title: "agentlens: score a coding model on its first attempt, not its final one"
date: 2026-11-18
category: technical
ai-assist: 100
tags: [python, testing, evaluation, sqlite]
topics: [development]
excerpt: "A harness that snapshots the workspace at every done claim, so a model's first attempt gets scored before it has a chance to correct itself."
---

*What a model leaves behind at the moment it says "done".*

Every coding agent I have used tells the same story in the transcript. It read the file, it found the bug, it fixed the bug, the tests pass. Sometimes that is true. The interesting cases are the ones where it is not, and reading carefully to find out is slow, subjective, and impossible to compare across models.

So the question I wanted a number for is narrower than "which model is best". It is: which model writes code that passes hidden checks on the first attempt, before it has any feedback to correct itself with. A model that gets there in one try is cheap to supervise. A model that gets there after three rounds of guessing is not, even when the final diff is identical.

AgentLens is the harness I built to measure that. It runs fixed tasks in isolated workspaces, snapshots the workspace at every "done" claim, and scores each snapshot against shell checks the agent never sees. This post is about how the pieces fit, and about the bugs the tests caught while I was building it.

## Before you start

Here is what I am assuming:

- You can read Python. Nothing here is clever, but the data model is the point and it lives in `models.py`.
- You have opinions about coding agents and want to argue with the measurement, not the vibe.
- You understand that a hidden check is only as good as the task author who wrote it.

One warning that matters more than the rest: this is a learning project, and Phase 1 measures behaviour, not intelligence. It tells you whether the work was correct the first time. It does not tell you why.

## Three folders decide every run

A task is three directories:

```text
tasks/demo-greet/
  spec.md      # everything the agent is told
  repo/        # the starting workspace, copied fresh per run
  checks/      # shell scripts the agent never gets to read
```

`spec.md` is the prompt. `repo/` is what the world looks like before the model touches it. `checks/` are small scripts that exit non-zero when the work is wrong: import the module, call the function, assert the return value. Because they are shell scripts, a task can check a Python API, a CLI's exit code, or a file that should not exist, without the harness knowing anything about the language.

`task init NAME` scaffolds all three and bakes the marker into the spec, so a new task is one command. `task validate NAME` then refuses the tasks that could never produce a meaningful number: a spec without the marker never checkpoints, an empty `checks/` never scores, a missing `repo/` starts from nothing. Catching those at authoring time is much cheaper than catching them after a paid run.

## Making "done" detectable

The harness cannot read minds, so the spec asks the agent to print a marker when it believes the work is complete. That message is a checkpoint.

`AGENTLENS_DONE`

In Phase 1 the marker is the only signal. It is objective: either the string was printed or it was not, and there is no model in the loop deciding whether a turn "felt finished". Later phases can infer completion from an unmarked session, but those labels are calibrated against Phase 1 runs and never mixed into the same leaderboard.

The harness copies the workspace at that instant, inline, inside the run loop. This is the part I got wrong first and the part that makes every number afterwards mean something.

## The number that matters is the first checkpoint

Evaluation copies each snapshot to scratch and runs the hidden checks against the copy, never against the live workspace. The first checkpoint's verdict is first-attempt accuracy. Later checkpoints show recovery.

Here is the demo task in the repo, where a scripted "model" gets the function name wrong, claims done anyway, then fixes it and claims done again:

```sh
.venv/bin/agentlens run --task examples/demo-greet \
  --command "printf 'def greete():\n    return \"hello\"\n' > greet.py && echo AGENTLENS_DONE" \
  --command "printf 'def greet():\n    return \"hello\"\n' > greet.py && echo AGENTLENS_DONE"
.venv/bin/agentlens eval demo-greet-script-s1 --task examples/demo-greet
.venv/bin/agentlens report
```

And the report, unedited:

```text
run                  model  checks  first try  final  recovered  cost
demo-greet-script-s1 script 2       FAIL       PASS   YES        -
```

That row is the whole thesis in one line. The final state is correct, so a transcript-only view scores this a success. The first attempt was wrong, and the model said it was done.

## The leaderboard

`compare` aggregates every evaluated run per model: how many runs, first-try pass rate (the sort key), false-done rate, recovery count, and cost. On the demo data it looks like this:

```text
model   runs  first try  false done  recovered  cost
script  1     0/1        1/2         1          -
```

Those three columns, first-try rate, false-done rate, cost, are the success criteria I actually care about. A model that never claims done is slow. A model that always claims done is a liability. The useful one sits in between and recovers when it is wrong.

Run ids extend rather than overwrite (`demo-greet-script-s1`, then `-r2`), because a leaderboard whose ids collide produces silent data loss instead of a wrong opinion somewhere visible.

## Findings: naming the pattern

A score tells you a run was imperfect. It does not tell you the shape of the imperfection, and that shape is what changes how I supervise a model.

`findings` applies deterministic rules with evidence attached. Every finding carries the event sequence numbers it came from, so a claim can always be re-checked against the transcript instead of trusted.

```text
false_done           high    rule  3     claimed done with 1 failing check(s) at checkpoint 1
bug_fixed            info    rule  3,5   recovered at checkpoint 2 after a first-try fail
skipped_verification medium  rule  3     claim made with no verification command before it
```

Three rules and two gates so far. `false_done` is high severity on the first checkpoint and medium later, because a done claim with failing checks is an overclaim whenever it happens. `bug_introduced` catches a state that passed and was later broken. `evidence_gate` requires a verification-shaped command in the window before each done claim, gated per claim so one verified claim never excuses the next. `check_silenced` flags bypass patterns (`--no-verify`, `--deselect`, `SKIP...=`) inside a claim window as high severity, with a deliberately narrow pattern list so every hit is near-certain.

Unevaluated checkpoints produce nothing. Recomputation replaces rows instead of appending duplicates. A rule that guesses is worse than no rule at all.

## When things go wrong

**Every checkpoint held the same files.** The first version snapshotted the workspace after the run finished. By then the workspace was final, so checkpoint 1, 2 and 3 were byte-identical and first-attempt accuracy was fiction. A test comparing two checkpoints caught it, and the fix was to snapshot inside the loop, at the claim.

**The fast model finished before the first snapshot.** A scripted driver writes files instantly, so it could complete the whole task before the harness processed the first done claim, giving the same symptom at microsecond scale. Real agents pace themselves against API round trips and never hit it. The fix is an ack file the driver creates right after the n-th snapshot, which a fake binary can wait on. Determinism without changing production behaviour.

**Two runs of one model overwrote each other.** Writing the ranking test exposed it: the run id was derived from task, model and seed, so a second run of the same combination computed the same id and replaced the first. Found before it ever touched real data, which is the only reason it reads like a footnote.

**The database could not read its own events.** `save_events` wrote payloads with `repr()`. That is fine for a log line and useless for a round trip: any analyzer loading events back got corrupt rows. Now `json.dumps` on write, `load_events` on read, and the findings CLI exercises the round trip on every run.

**A hidden check reported 0/2 when the script simply was not found.** The check scripts resolved against the wrong working directory, so a model that did nothing would have looked equally bad. Hidden-check plumbing needs the same skepticism as the models it judges.

## What it does not do yet

The real driver is written and tested against recorded stream-json output, but I have not run it against a live agent session yet, so every number in this post comes from scripted runs. That is deliberate: the harness should be boring and correct before it is pointed at a model with a bill attached.

Phase 2, inferring done claims from unmarked sessions, and LLM-assisted labeling are both future work, and neither is allowed to override a hidden check. The cheap objective signal wins every argument.

## Where to go from here

The next useful measurements are variance across seeds for one model, and a real run of the same task across two models with the cost column filled in. If you want the shape of the thing rather than the numbers, the 39 tests are the honest documentation: the checkpoint detector has the heaviest coverage, because every metric downstream of it is only as trustworthy as the moment it decides a claim was made.
