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

![Two done claims, two snapshots, and only the first one answers the question](/images/agentlens-first-try-accuracy/checkpoints.png)

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

## The first live run

Everything up to here ran on scripted commands standing in for a model. A harness that has only ever seen its own scripts is not yet evidence about anything, so the next step was a real model end to end.

Neither CLI I wanted was usable on this machine. `claude` is not installed, and the Gemini CLI is there with a stored credential that returns 401 UNAUTHENTICATED on every request, which is a five minute fix only the account owner can make. Ollama was already installed with `qwen2.5:7b-instruct` on disk, so the live driver became a small script instead: model command, spec on stdin, a shell tool, the model's own loop, and the whole trace re-emitted as the same stream-json the existing adapter already parses. About two hundred lines, and now any local model can be measured without an API key.

Three independent seeds on the demo task, then `report`:

```text
run                                model             checks  first try  final  recovered  cost
demo-greet-ollama-qwen2.5-7b-s1-r4 ollama-qwen2.5-7b 1       PASS       PASS   -          $0.0000
demo-greet-ollama-qwen2.5-7b-s2-r3 ollama-qwen2.5-7b 1       PASS       PASS   -          $0.0000
demo-greet-ollama-qwen2.5-7b-s3-r3 ollama-qwen2.5-7b 1       PASS       PASS   -          $0.0000
demo-greet-script-s1               script            2       FAIL       PASS   YES        -
```

A 7B model passing a two-check task three times out of three is not a benchmark result, and the honest reading is narrow: the plumbing works with a real model, and a small model can satisfy an unambiguous spec. The task asks for one file with one function, which is about the smallest thing that can still be scored.

The more interesting column is not first-try accuracy. `findings` flagged two of those three runs as `skipped_verification`: the model wrote the file, decided that was enough, and printed the marker without ever running the code. The checks passed anyway, both times. A model that claims done without evidence is not caught by a hidden check that happens to agree with it, and that gap is exactly why the process rules exist next to the pass rates.

The third seed did verify, with `python3 -c "from greet import greet; print(greet())"`, printed `hello`, and got flagged anyway. That was a false positive in my own allowlist: it knew `pytest` and `cargo test` and `npm test`, and had no notion that running the code and reading its output is verification. The allowlist now has an interpreter one-liner pattern, with a test named after the run that found it, and recomputing the stored events moves the count to two of three, both of them true.

That is the part worth trusting about rule based labels: they are cheap, deterministic and auditable, and they are still wrong until something uses them on real data.

## A second model, and a floor under the leaderboard

The obvious next question is whether any of this changes with a different model. The machine had a second Ollama model on disk, `qwen2.5:3b`, so the same task ran three more seeds through the same driver:

```text
task       model             seeds  per-seed  first try  false done  status
demo-greet ollama-qwen2.5-3b 3      1,1,1     3/3        0/3         ranked
demo-greet ollama-qwen2.5-7b 3      1,1,1     3/3        0/3         ranked
```

Six live runs, six first-try passes, zero false dones. That is still not a benchmark: the task is one file with one function, both models are from the same family, and a perfect score has no variance to explain. What it does establish is the spec's minimum evidence bar — two models, three seeds each — and that the tool can now say so itself. `compare` groups by task and model and marks a group `ranked` only with three *distinct* recorded seeds; a repeated seed is one seed of evidence, and an unseeded run never counts. A new `variance` command prints the per-seed rows behind the mean.

The more useful signal is in `findings`, not the leaderboard: all three 3b runs wrote the file, printed the marker, and never ran it. That is the same `skipped_verification` finding as two of the three 7b runs. The hidden checks passed all six. First-try accuracy says the work was right; the process rule says the model had no evidence it was right when it claimed so. Both are true, and they answer different questions.

## When things go wrong

**Every checkpoint held the same files.** The first version snapshotted the workspace after the run finished. By then the workspace was final, so checkpoint 1, 2 and 3 were byte-identical and first-attempt accuracy was fiction. A test comparing two checkpoints caught it, and the fix was to snapshot inside the loop, at the claim.

**The fast model finished before the first snapshot.** A scripted driver writes files instantly, so it could complete the whole task before the harness processed the first done claim, giving the same symptom at microsecond scale. Real agents pace themselves against API round trips and never hit it. The fix is an ack file the driver creates right after the n-th snapshot, which a fake binary can wait on. Determinism without changing production behaviour.

**Two runs of one model overwrote each other.** Writing the ranking test exposed it: the run id was derived from task, model and seed, so a second run of the same combination computed the same id and replaced the first. Found before it ever touched real data, which is the only reason it reads like a footnote.

**The database could not read its own events.** `save_events` wrote payloads with `repr()`. That is fine for a log line and useless for a round trip: any analyzer loading events back got corrupt rows. Now `json.dumps` on write, `load_events` on read, and the findings CLI exercises the round trip on every run.

**A hidden check reported 0/2 when the script simply was not found.** The check scripts resolved against the wrong working directory, so a model that did nothing would have looked equally bad. Hidden-check plumbing needs the same skepticism as the models it judges.

## What it does not do yet

One trivial task and one local 7B model is a smoke test, not a leaderboard. To compare models honestly I need three or four tasks that are hard enough to fail, the same seeds across every model, and a frontier model in the mix, which means a working `claude` or Gemini login and a budget decision rather than a better harness.

The other honest limit is the batch itself. The first three seeds came out byte-identical, 2,232 tokens each, because my driver pinned the sampler seed: three runs, one sample, reported as three. The seed is now left to the model unless asked for, and the same three runs give 1,095, 2,129 and 1,517 tokens with 7, 11 and 9 events. A harness that cannot notice three identical seeds is not measuring variance; it is measuring itself.

Phase 2, inferring done claims from unmarked sessions, and LLM-assisted labeling are both future work, and neither is allowed to override a hidden check. The cheap objective signal wins every argument.

## Where to go from here

The next useful measurements are variance across seeds on a task that can fail, and the same task across two models with the cost column filled in. If you want the shape of the thing rather than the numbers, the 40 tests are the honest documentation: the checkpoint detector has the heaviest coverage, because every metric downstream of it is only as trustworthy as the moment it decides a claim was made.
