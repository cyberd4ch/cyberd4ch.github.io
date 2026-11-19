---
title: "the truncation guard stops at chat: proving the blind spot with a real vault"
date: 2026-11-17
category: technical
ai-assist: 100
tags: [llm-agents, python, debugging, open-source]
topics: [development]
excerpt: "A review of DeepTutor's truncation guard found the same cut-off tool calls reaching five dispatch sites outside the chat path, so I filed the issue with a runtime repro: a scripted truncated round, the real dispatch code, and a real Obsidian vault that gets mutated while history records a fabricated success."
---

*How a truncated tool call mutates a real vault: a repro that runs the actual loop and the actual dispatcher, not a mock.*

I was reviewing [PR #2719](https://github.com/HKUDS/DeepTutor/pull/2719) on
[DeepTutor](https://github.com/HKUDS/DeepTutor), an open source AI tutoring
platform. The PR fixes a failure mode I had already reproduced while working
[issue #2713](https://github.com/HKUDS/DeepTutor/issues/2713): a provider hits
its output cap mid tool call, the JSON arguments arrive cut in half, and the
loop executes them anyway. The fix refuses truncated tool calls in the chat
loop and asks the model to continue instead. It is a good fix, and it works:
I verified the branch against the dev tip, merge clean, full test suite green.

Then I asked the question that turned a review into a new issue: where else do
truncated rounds reach the dispatch function? DeepTutor is not one loop. Chat
has its own; deep research, the quiz pipeline and context exploration all
dispatch too, through a shared loop or one of their own. If the guard only
lives in the chat path, the failure does not go away. It just moves to the
pipeline you were not looking at.

## What a truncated round actually does

Picture the failure end to end. The model emits a tool call: a name, then a
JSON object of arguments. The provider's cap hits somewhere inside that JSON,
say mid line in a long note. The stream ends with `finish_reason: length`. Two
facts are now true at once: the model never finished its thought, and the bytes
that arrived are *almost* valid JSON.

The layer between the model and the tools has to make a decision. DeepTutor's
shared dispatcher, `dispatch_tool_calls`
(`runtime/agentic/tool_dispatch.py:127`), deliberately repairs malformed JSON
and runs the tool. Repair-then-run is a reasonable choice for a *complete* call
that came back mangled. For a *cut-off* call it is the worst possible default:
the repair path finishes the model's sentence for it, the tool runs with
arguments the model never wrote, and the result lands in history as if
everything went to plan.

*A model that runs out of tokens mid sentence still gets one more author: the
JSON repair, which completes its thought.*

## The repro

I did not want to argue this from a code read, so I built the repro against the
real loop. Nothing in the repo is patched. The script imports DeepTutor's
actual `run_agentic_loop`, its actual `dispatch_tool_calls` and its actual
Obsidian append tool, pointed at a temporary vault. The only fake piece is the
provider, which is scripted: round one returns a tool call whose arguments are
cut mid JSON, with `finish_reason: length`.

```
round 1   provider returns a TOOL round: obsidian_append
          arguments: {"vault": "repro", "note": "...", ...cut mid JSON...
          finish_reason: length

round 2   the loop repairs the JSON, dispatches the tool
          -> the vault now holds a note the model never finished writing
          -> the transcript records {"status": "appended"}
```

That last line is the part worth pausing on. The vault was mutated from a
truncated round, and the history says the append succeeded. Any downstream
agent reading that transcript inherits a confident lie. The full script is
posted on the issue, and it needs nothing but the repo on the Python path.

## Where the guard lives, and where it does not

The chat loop is guarded: PR #2719 puts `_refuse_truncated_tool_calls`
(`agents/loop/loop_host.py:373`) between the model's round and the dispatcher,
so a truncated tool call in chat gets refused and continued. Good.

The other paths dispatch through a shared loop without the check.
`run_agentic_loop` (`runtime/agentic/loop.py:322`) receives the step's
`finish_reason` on the result object in hand and dispatches `step.tool_calls`
unconditionally whenever the round has tools. From that loop, five production
sites run unguarded:

- the deep research pipeline, whose agentic loops dispatch through
  `agents/research/pipeline.py:2767` and `:3110` (driven from `:815` and
  `:1017`)
- the pageindex reasoning loop
  (`services/rag/pipelines/pageindex/reasoning.py:90`)
- the question generator (`agents/question/pipeline.py:2099` into `:2174`),
  which it turns out is not a separate loop at all: it calls
  `run_agentic_loop` at `:682` (explore) and `:924` (quiz), so it sits under
  the choke point already
- the context explorer (`capabilities/explore_context/explorer.py:363`), the
  one site with its own loop and no `finish_reason` captured at all

None of these are exotic code paths. They are the pipelines the product runs
on ordinary days. All of this was verified on the dev tip
(`4c1e000d8`, v1.7.3; check the [releases page](https://github.com/HKUDS/DeepTutor/releases)
for anything newer).

## The fix shape

My issue proposes the fix at the choke point rather than five more patches: in
`run_agentic_loop`, before `host.dispatch_tools(...)`, consult
`step.finish_reason` against `TRUNCATED_FINISH_REASONS`
(`deeptutor/services/llm/types.py:17`) and refuse exactly the way the chat host
does. The information is already there: `LabeledStepResult` carries
`finish_reason` (`runtime/agentic/labeled_step.py:109`); the generic loop just
never reads it. One check at the choke point covers four of the five sites and
future ones, and #2719's refusal notice becomes a template instead of a
special case. The fifth, the explorer, needs the same check inside its own
loop, plus the `finish_reason` capture it never had.

Filed as
[HKUDS/DeepTutor#2753](https://github.com/HKUDS/DeepTutor/issues/2753) with the
full chain map, and the repro posted as evidence on the issue. Credit to
fanjiahe for the original guard, which this extends rather than disputes: the
PR is correct and merge clean for its scope.

## Postscript: what shipped

[PR #2757](https://github.com/HKUDS/DeepTutor/pull/2757) implements the shape
above, and building it corrected my own map in the useful direction. The
question generator is not a fifth loop: it calls `run_agentic_loop` twice, so
its dispatch wrapper is a host implementation, not a scheduler. That left two
places to change instead of five:

- `runtime/agentic/loop.py`, the choke point, refusing the batch before
  `host.dispatch_tools(...)` and continuing the round
- `capabilities/explore_context/explorer.py`, which also had to learn to read
  `finish_reason` off the final chunk at all (the terminal chunk usually
  carries no delta, so the capture has to happen before that short circuit)

Both call one helper in `tool_dispatch`, so every flow emits the same notice
and one `role: "tool"` message per refused call. Repair inside
`dispatch_tool_calls` is untouched, because it is correct for a complete call
that came back mangled; the guard belongs above it, where the round's finish
reason is still in hand.

Two tests hold it: one drives the real `run_agentic_loop` with a scripted
truncated round and asserts no dispatch happens, the other does the same for
the explorer, where the missing capture meant the guard could never have
fired. Both fail on the pre-fix code (checked by stashing the two entry points
and rerunning), and the surrounding suites pass: 906 tests across the agentic,
capability and agent-loop directories, 59 more in the question pipeline. CI
agreed, 22 checks green.

The lesson I keep relearning in agentic codebases: an invariant placed at one
caller is an instance, not an invariant. The scariest sentence in an agent's
transcript is still "the tool ran anyway", and a pipeline nobody was watching
can now print it.
