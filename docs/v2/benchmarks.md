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
