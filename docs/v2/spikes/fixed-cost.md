# Spike: v2 fixed per-session cost (open item 5)

Status: partial. The prompt cut is shipped (D-FU-OI-COST-1). The pass rule "v2-after <= v2-before on 6 of 6 tasks" is **not met** (4 of 6).

## Question

On short tasks v2 costs more than direct (v1-v2-gateway +2.2% pooled, try-it +16%). Is the cause a fixed cost that every session pays?

## (a) Fixed cost, measured from transcripts

Source: stream-json transcripts of the A/B below (18 sessions per arm per run, Claude Code 2.1.303, claude-opus-5-5). Tokens of the first request = input + cache write + cache read.

| Arm | First request, median tokens | Range | Mean requests per task |
| --- | --- | --- | --- |
| plain (before run) | 15,939 | 15,911-19,092 | 2.89 |
| v2 before (1b97dc6c) | 16,872 | 16,844-17,060 | 3.00 |
| plain (after run) | 15,950 | 15,596-19,085 | 2.83 |
| v2 after (prompt cut) | 16,763 | 15,969-20,104 | 3.28 |

- v2 adds about 930 tokens to the first request before the cut and about 810 after.
- Where they come from (init event of a v2 session): 9 extra deferred tool names, server instructions (647 chars before, 509 after), the always-loaded `ctx_execute` description and schema (732 + 494 chars before, 484 + 494 after, ADR-0006), and the SessionStart startup resume line (198 chars, once per session).
- The cost the user sees is set more by the cache: the first session of each cycle writes about 17,000-21,000 tokens of 1h cache in both arms; later cycles write about 7,700-8,600. One cold cycle changes a 3-cycle task mean by more than the whole prompt cut.

## (b) Cut

- `src/prompt/instructions.md`: 647 -> 509 chars. Removed the line that repeats ADR-0006 deferred loading ("search for the tool") and text that `ctx_execute` already says.
- `src/prompt/tools/ctx_execute.md`: 732 -> 484 chars. Same rules, fewer words.
- Not changed: the SessionStart resume line (other open items and kiro/gemini tests pin it), tool set and alwaysLoad (ADR-0006 2026-10-23 probe keeps `ctx_execute` loaded), the hook replace threshold (hooks already add no context below it).
- Checks: prompt lint PR1-12, GS5, GS9 OK; GP2 and GP4 e2e 30/30 (GP2 token-budget golden updated to 484); `tests/v2` same 6 failures before and after the cut (search snippet tests from a parallel change, not this one).

## (c) A/B (start-cost-ab, --arms plain,v2, 6 short workloads, 3 cycles, claude-opus-5-5, --max-budget-usd 1.5)

Two runs, same harness commit, before = release-out of 1b97dc6c, after = 1b97dc6c + the prompt files only. All 72 sessions resolved.

| Task | plain before | v2 before | plain after | v2 after | v2 after <= before |
| --- | --- | --- | --- | --- | --- |
| edit | 0.0751 | 0.1108 | 0.0731 | 0.0786 | yes |
| git | 0.0633 | 0.0967 | 0.0670 | 0.0728 | yes |
| grep | 0.0868 | 0.1084 | 0.0874 | 0.1076 | yes |
| json | 0.0858 | 0.1072 | 0.0724 | 0.1138 | **no** |
| log | 0.0829 | 0.1145 | 0.0768 | 0.1046 | yes |
| tests | 0.0670 | 0.1117 | 0.0835 | 0.1188 | **no** |

Mean USD per task. Pooled v2 vs plain: **+40.9% before, +29.5% after** (sums: plain 1.383 / v2 1.948 before; plain 1.381 / v2 1.789 after).

Note: these pooled numbers are far above the +2.2% of the gateway benchmark because this A/B has no warmup and only 3 cycles, so the cold first cycle (about 0.15-0.19 USD per v2 session vs 0.07-0.09 warm) dominates. The json and tests misses both come from a cold cycle-1 v2 session (0.179 and 0.184 USD). This is noise of the order of the effect; it is not claimed as a gain or a loss.

## Routing (GP-LIVE-ROUTING, after build)

`e2e/live/routing/run.mjs --models claude-opus-5-5 --runs 1 --budget 0.4`: 20 scored runs, under-routing 0, over-routing 0, correct 19/20, pass true. Sonnet and Haiku were not run in this spike.

## Result

- Fixed cost is real but small: about 800-930 tokens on the first request, about 110 tokens saved by the cut.
- The pass rule fails on 2 of 6 tasks; pooled change vs plain fell from +40.9% to +29.5%.
- Next: rerun with --warmup 1 and n >= 8 so the cold cache write does not decide the result; measure the extra request per task (3.00-3.28 vs 2.83-2.89) on its own.
