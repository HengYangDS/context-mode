# M2 Read deny text (exp/du-deny, D-DU-DENY-1)

Claude Code 2.1.303, keyless `claude -p`, fresh config per session, `--plugin-dir release-out`, `--max-budget-usd 1`.
Raw transcripts are kept outside the repo (private compact-m2/du-deny dir).

## Where the text is built

Before: `READ_DENY_MESSAGE` in `src/core/contracts/constants.ts`, called by `read()` and `shellDump()` in
`src/core/policy/decide.ts` (PreToolUse Read path). json-1 transcript (r3-merge, `main-json-1-v2-1`): text 465 B,
tool_result 488 B with the host prefix `PreToolUse:Read hook error: `:

> context-mode: this file is 501233 bytes, more than the 16384 byte limit for one read. Pick one: read part of it with
> Read(file_path, offset, limit), for example limit 200; or run code on it with ctx_execute(language, code,
> file="<path>"), which gives your code the path in CTX_FILE and returns only stdout, up to 16384 bytes; or search it
> with a bounded command such as grep -n or tail.

After: one line from `src/prompt/hooks/read-deny.md`, inlined by `build/build.mjs` (one line, fixed bytes <=
`READ_DENY_FIXED_CAP` 120), formatted by `src/core/policy/read-deny.ts`, linted by `docs/v2/prompt/lint.mjs --out`
(PR1, PR2, PR3, PR5, PR6, PR11, PR12, one line):

> context-mode: {size}-byte file, over the one-read limit. Run ctx_execute(language, code, file="{path}") and print only the answer.

Fixed text 118 B. json-1: tool_result 228 B (was 488 B). read-csv: 230 B (was 484 B). A ranged Read is still
allowed; the text no longer names it. Tests: `tests/v2/policy/read-deny.test.mjs` (golden, byte cap, lint), red first.

## M2 (claude-sonnet-5-5, effort low, n=3)

| Run | Score | json-1 off -> v2 B, saving % | Read denied in json-1 v2 runs |
|---|---|---|---|
| main 1 | 90.15 | 810 -> 142, 82.47 | 1/3 |
| main 2 | 90.12 | 630 -> 370, 41.27 | 2/3 |
| main 3 | 90.12 | 758 -> 263, 65.30 | 2/3 |
| mean | **90.13** | | |
| heldout 1 | **98.59** | read-csv 37929 -> 332, 99.12; read-src 43236 -> 854, 98.02 | read-csv 3/3, read-src 3/3 |

Before (v2-design db421365): main 87.63/87.59/84.33/87.74/87.68, heldout 97.4. Other main workloads
unchanged (multi-1 93.79, big-tests 99.33, big-json 86.5). Every oracle passed (all passOff 3, passV2 3).

json-1 still swings: the off arm is only 630-810 B, so a deny (228 B) plus the ctx_execute answer (142 B) is about
half of it. The deny no longer decides the score alone: every denied run still made one right call and stopped.

## Next call after the deny

| Where | Denies | Next call |
|---|---|---|
| M2 main json-1 (9 v2 runs) | 5 | ctx_execute 5/5, then done (2 calls total) |
| M2 heldout read-csv (3) | 3 | ctx_execute 3/3 (was: deny, then 2 follow-up calls) |
| M2 heldout read-src (3) | 3 | ctx_execute 1, Grep 2 (bounded, 98.02 saving) |
| Routing, both models | 35 | ctx_execute 34, Bash 1; correct 35/35 |

## GP-LIVE-ROUTING (`e2e/live/routing/run.mjs`, runs 2, 116 rows)

| Model | Large | Small | Under | Over | Correct | Pass |
|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 20 | 20 | 0 | 0 | 40/40 | yes |
| claude-opus-5-5 | 20 | 20 | 0 | 0 | 40/40 | yes |

The runner's Read-deny detector now also matches the new text (`over the one-read limit`).

Live spend: M2 main 0.94 + 0.87 + 0.92, heldout 2.28, routing 4.83 = 9.84 USD (cap 10).
Unit: `node --test tests/v2/` 1474 pass, 0 fail, 2 skipped. Bundle-mode prompt lint OK.
Not run here: compaction evals and the D3 hook timing (the change is one shorter string; no store or hook path change).
