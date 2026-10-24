# du-units: line units built on first need

Status: code done, evals partly run. Branch `exp/du-units` from `v2-design` db421365. Host: darwin, Node v26.8.1, Claude Code 2.1.303.

## Change

PostToolUse stores chunks only. `ensureUnits` (store/fts.ts) builds the line units of a session's sources once, on the first recall (UserPromptSubmit after compaction) or `ctx_resume`, from the stored chunks. Same `buildUnits` pass, same ranked query and MMR. Schema v6 adds `sources.units_built` and `sources.unit_gaps` (newline runs the chunker dropped, so each unit keeps its line number). Rows that exist at migration default to built. No build in the MCP server when idle: not done, only on first need. See the DEVIATIONS row (du-units).

## Tests

tests/v2: 1475 tests, 1473 pass, 0 fail (rest skipped by the suite). Red first (bf8d46ab, 82cbf971), green after (5f3964dd, 2a131ddd).
Review point: dispatch.test.mjs changed one assertion from "the detached write stores line units" to "PostToolUse writes no line units, units_built = 0". This follows the design change. Units are still asserted after `ensureUnits` (lazy-units.test.mjs, reserve.test.mjs). Schema pins 5 -> 6 in contracts, schema, cost-dedup tests.

## Hook time (interleaved, n=20, bench/hook-large-post.mjs, 222 KB PostToolUse)

| Build | median ms | p95 ms | paired vs pre-round-3 |
|---|---|---|---|
| pre-round-3 5a79496d | 118.7 | 145.0 | 0 |
| v2-design head db421365 | 126.2 | 157.6 | +10.4 |
| du-units | 118.0 | 139.2 | -1.1 |

Target met: within 3 ms of pre-round-3.

## First UserPromptSubmit after compaction (222 KB source, n=20, interleaved, overhead = wall minus bare node)

Sequence: prompt, PostToolUse (222 KB), SessionStart(compact), UserPromptSubmit (first), UserPromptSubmit (second). Both recall blocks are byte-identical to head.

| Build | first med ms | first p95 ms | second med ms | overhead med | overhead p95 |
|---|---|---|---|---|---|
| pre-round-3 | 61.3 | 75.7 | 58.6 | 31.9 | 44.7 |
| head | 73.8 | 96.5 | 73.4 | 44.4 | 65.5 |
| du-units | 100.7 | 138.8 | 73.6 | 71.3 | 107.8 |

This misses the D3 budget (15 ms p95). The first recall costs about 27 ms median more than head (the unit build moved here). The second recall is equal to head. Note: head and pre-round-3 also exceed 15 ms on this path (recall is a ranked query on a 222 KB source), so this path is over D3 on every build, and du-units adds about 42 ms p95 over head on the first call only. Not measured with the setup-hook-overhead.mjs harness, which times a PreToolUse allow event with no data; that check passes (5 ms claude-code, 4 ms codex, budget 15). bench/hook-gs6: p95 40.8 ms, cpuOverNode 6.8 ms, pass.

## Evals

Live spend cap was $10. Compaction main run 1 (n=3, with the direct arm, which cost $8.42 of the $10.91 spent) hit the cap. A second main run, the heldout run and the M2 run were not done.

Compaction main, run 1: v2 36/36 = 100%, cost $2.49 (direct arm 77.8%). Raw: /private/tmp/cm-v2-impl-private/compact-m2/du-units/main1.
Not run: compaction main run 2, heldout, M2 main. The M2 effect is expected to be none: it touches only the hook write path and recall.
Mistake: run 1 should have used `--arms v2`; the direct arm used most of the cap.
