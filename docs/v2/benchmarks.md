# v2 benchmarks

## Offline replay

Measured 2026-10-19 (run date; the clock says 2026-10-20 in the session). Node v26.8.1. Method: `bench/README.md`. Script: `bench/replay.mjs`. Aggregate JSON: `bench/offline-aggregate.json`.
This is a byte count over real transcripts. It is not a model run and it does not measure answer quality.

Corpus: 2986 transcript files, 820 sessions with at least one paired tool call, 23175 paired tool calls. 2 files over 200 MB were skipped (logged). Transcript dates 2026-05-10 to 2026-10-19. 244 image blocks in results were not counted. 1 result had no matching tool_use.
Agent: Claude Code. Most calls come from versions 2.1.283 (5693 calls), 2.1.198 (5103), 2.1.220 (2796), 2.1.150 (2643), 2.1.149 (2108). Models on the tool-call turns: claude-opus-5-5 (6178), claude-opus-4-8 (5374), claude-opus-4-7 (5342), claude-opus-5 (3541), claude-fable-5 (2047), claude-haiku-4-5-20251001 (1204), claude-sonnet-5 (80), claude-fable-5-1 (49).

"Before" = bytes the model received. "After" = bytes v2 would return: deny text for a deny, bytes before plus hint text when the hint fires, ctx tools as is, case C replace for subagent results over 16384 bytes (0 such calls fired). "With re-run bound" adds min(bytes before, 16384) for every deny, as an upper bound on the cost of the model running the denied call through ctx_execute (that reply is not in the transcript). Session median and p90 are over sessions that used the tool. Rows shown: tools with a deny, a hint, or at least 500 calls. The other tools are in the JSON; their saving is 0.

| Tool | Calls | Bytes before | Bytes after | Saving % | Saving % with re-run bound | Session median % | Session p90 % | Sessions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bash | 13894 | 19655778 | 20225778 | -2.9 | -4.3 | -26.8 | -0.9 | 637 |
| Read | 1506 | 4236952 | 3337293 | 21.2 | 10.4 | -32.1 | -0.7 | 181 |
| mcp:other | 708 | 1908466 | 1928186 | -1.0 | -1.0 | -9.0 | -0.1 | 13 |
| ctx_execute | 1027 | 1655378 | 1655378 | 0.0 | 0.0 | 0.0 | 0.0 | 29 |
| Agent | 977 | 1591038 | 1591038 | 0.0 | 0.0 | 0.0 | 0.0 | 27 |
| Edit | 2423 | 493991 | 493991 | 0.0 | 0.0 | 0.0 | 0.0 | 76 |
| Write | 856 | 165753 | 165753 | 0.0 | 0.0 | 0.0 | 0.0 | 75 |
| WebFetch | 67 | 56587 | 22340 | 60.5 | -39.5 | -42.1 | 30.9 | 43 |
| Grep | 1 | 171 | 355 | -107.6 | -107.6 | -107.6 | -107.6 | 1 |
| **Corpus total** | 23175 | 30798642 | 30454640 | 1.1 | -1.5 | -17.0 | 0.0 | 820 |

Counts: 599 denies (Bash 504, WebFetch 67, Read 28), 861 hints fired, 0 replaces.

What the numbers say, and what they do not:
- Corpus saving is 1.1% of bytes without the re-run bound and -1.5% with it. v2 policy alone does not cut bytes much on this corpus.
- Bash is negative. The 504 deny texts and 627 fired hints add bytes. Most Bash outputs in this corpus are small, so a hint costs more than it can save in the same call.
- Read is the one tool with a real saving (21.2%, 10.4% with the bound): 28 denies of large unranged reads. The Read size is the result size, not the disk size (approximation 1 in the README).
- Per-session medians are negative because most sessions are short and have few calls; the corpus total is dominated by a few large reads.
- Not measured: whether the model then uses ctx_execute / ctx_search and receives fewer bytes in later turns, the effect of hints on later calls, and quality. Many sessions already ran with v1 hooks or ctx tools, so "before" already holds v1 effects (README, approximation 3).

## Live A/B

Measured 2026-10-19 (run date; the clock says 2026-10-20 in the session). Agent: Claude Code 2.1.303. Model: claude-sonnet-5-5, effort low, `--max-budget-usd 0.25` per session. Keyless harness (ADR-0012), isolation env keys from D-M7-CL-3. Method: `bench/live/README.md`. Script: `bench/live/run.mjs`. Aggregate JSON: `bench/live/results/aggregate.json`. Raw per-session rows stay outside the repo.

Design: 20 tasks with large local output (5 logs, 4 big JSON, 4 test runs, 4 big files, 3 git histories), 3 runs per task per arm, 120 sessions. Arm `on`: `--plugin-dir release-out` (v2 build). Arm `off`: `--strict-mcp-config`, no plugin. Same built-in tools in both arms. Each task is checked by script (answer must contain the expected value). Tokens come from the stream-json `result` usage. "Session input" = input + cache creation + cache read. "Fresh input" = input + cache creation. Saving % per task = 1 - median(on) / median(off) over its 3 runs; the table gives the median, min and max over the 20 tasks. Negative = the plugin arm read more.

| Measure | Result |
|---|---|
| Saving %, session input | median -6.7, min -6.9, max +29.7 |
| Saving %, fresh input | median -18.6, min -22.2, max -4.3 |
| Median session input per session | on 38612, off 36160.5 |
| Success rate | on 60/60, off 60/60 |
| List-price cost (estimate, not a bill) | on $1.4121, off $1.2744, total $2.6865 |

Observed:
- In 15 of 60 `on` sessions the model called a context-mode tool (10 of 12 JSON sessions, 5 of 12 test-run sessions, 0 elsewhere). The three JSON tasks json-1 to json-3 show +29.6 to +29.7% session input saving. All other tasks except json-4 show -6.6 to -6.9%.
- In the other `on` sessions the model used Bash, Read or Grep, as in `off`. The `on` arm then pays for the extra tool descriptions and hook text and gets no saving.
- Both arms passed every task, so no answer quality was lost or gained at this size.

What this does not show: fixtures are 0.3 to 3 MB at most, so outputs are large for a task but small for a long session. Sessions are one turn of work, so the fixed plugin overhead is not spread over many calls. Only 3 runs per task. One model, one agent version. The list-price cost is an estimate from the CLI. This run gives no support for a claim that the plugin saves tokens on single-task sessions of this kind.

## Method check

Checked 2026-10-20 by a second reader (no new model runs). Result: no number was changed. Findings:

- Offline replay: all 9 table rows and the totals (23175 calls, 599 denies, 861 hints, 0 replaces, 1.1% and -1.5%) match `bench/offline-aggregate.json` exactly. Tool rows sum to the corpus total (23175 calls, 30798642 bytes). Negative results (Bash, mcp:other, Grep) are shown, not dropped.
- Live A/B, same tasks in both arms: 20 tasks, 3 runs each, 3 per arm per task (checked in the aggregate and in the private rows: 120 unique task/arm/run ids, 60 per arm). The aggregate medians, min and max recompute from `perTask` (median -0.0672 total, -0.1858 fresh).
- Success not lower in the `on` arm: 60/60 on, 60/60 off. Per-group counts from the private rows agree (log 15/15, json 12/12, tests 12/12, file 12/12, git 9/9 in each arm). The success check is a script on the answer, so it cannot tell a better answer from a worse one; it only shows both found the value.
- Cherry-picking: none found. All 120 sessions are in the aggregate, the `on` arm costs more ($1.4121 vs $1.2744) and reads more input, and the text says so. The claim "15 of 60 `on` sessions used a context-mode tool (10 of 12 json, 5 of 12 tests, 0 elsewhere)" matches the private rows.
- Private data: in the measurement files (`bench/`, `docs/v2/benchmarks.md`, `docs/v2/prompt/`, `e2e/live/routing/`) no home path, e-mail (other than the noreply commit identity and fixture addresses on `example.*`) or prompt text was found. Raw rows stay in the private dir. Outside this scope, `git grep` finds a home path in `docs/v2/impl/07-tools-ops.md`, `docs/v2/impl/11-server.md`, `docs/v2/review/*` and `e2e/live/compact/results/*` (the last use a masked user name). They are not benchmark data and were not edited here; the owner should decide whether to scrub them.
- Weak points to keep in mind: (1) the routing verdict in `docs/v2/prompt/results.md` changed from FAIL to PASS because the scoring rule was changed after the first runs; the owner approved that on 2026-10-19, and both rule results are in the table, so read the PASS as "under the new rule". (2) Run 4 uses different model ids (sonnet-5-5, haiku-5-5) than runs 1-3, so it is not a like-for-like comparison. (3) Routing raw rows are not in the repo, so those tables cannot be recomputed from committed files; only the scorer and its tests are. (4) The offline replay "before" bytes already contain v1 effects (README, approximation 3). (5) Live A/B is one model, one agent version, small fixtures.
