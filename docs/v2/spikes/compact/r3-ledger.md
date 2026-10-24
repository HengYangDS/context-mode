# Spike r3-ledger: line units precomputed at PostToolUse

Status: done. Branch `exp/r3-ledger` from `v2-design` 5a79496d. Code commit 83e0e8be.

## Defect

A 222 KB row is larger than `RECALL_BUDGET_BYTES`, so `pickRecall` skips the whole row and the recall
block after compaction is empty. a-ledger (572eaa46) ranked lines at prompt time (4-50 ms per prompt).

## Change

- `src/core/index/units.ts` `buildUnits`: one stack pass. Each non-blank line becomes one unit: its indent
  ancestors plus the line, never cut. A JSON key keeps its parent objects, a TAP diagnostic keeps its
  `not ok` line, a flat log line stands alone.
- Schema v5: FTS5 table `line_units(body, source_id, session_id, ord)`, same tokenizer as `chunks`.
  Purge and source delete also delete the units.
- PostToolUse: when an output is indexed (sync and detached paths), its units go in too (`insertUnits`,
  batched by `INDEX_WRITE_CHUNK`).
- First UserPromptSubmit after compaction: ONE ranked query (`queryUnits`, bm25, stopwords out, any word)
  over this session's units, by prompt + session goal (first prompt of the session), 64 candidates.
  `pickUnits` applies MMR (0.7 score, 0.3 word overlap), whole units only, inside the budget the rows left.
  Units already injected are kept in meta `recall_units_seen:<session>`.
- Not done: `ctx_resume` does not read units yet.

## Numbers

Claude Code 2.1.303, claude-sonnet-5-5, budget 1 USD per session, jobs 9. Raw transcripts are private.

| Eval | v2-design head (5a79496d) | r3-ledger (83e0e8be) |
|---|---|---|
| compact-hard main, n=3 | 7/25 = 28% (run stopped at 25/36 to save budget; known 29.2%) | 36/36 = 100% |
| compact-hard heldout, n=3 | known 25.0% | 18/18 = 100% |
| recall block with line units | 0/25 transcripts | main 29/36, heldout 14/18 |
| M2 main, n=3 | known 84.03 (fbd4f781) | 86.28 |

PostToolUse stdout is byte-identical before/after on the four compact-hard outputs, so the model sees the
same replace text; the M2 change is run noise.

Hook time, 222 KB `serverLog` row, wall spawn to exit, n=20, load ~4.5:

| | before p95 | after p95 |
|---|---|---|
| PostToolUse (index + units) | 137.8 ms | 148.2 ms |
| UserPromptSubmit after compaction | 74.5 ms | 75.0 ms |

The prompt path adds ~0.5 ms (a-ledger: 4-50 ms). The unit build and insert add ~10 ms to a 222 KB
PostToolUse, a path that was already ~107 ms over bare node before this change. D3 (`bench/hook-gs6.mjs`,
30 runs): before pass, cpuOverNode 7.0 ms; after pass, cpuOverNode 6.3 ms.

Live spend: 6.93 USD of 12.

## Guards

- tsc clean. Tests first: `tests/v2/index/units.test.mjs` (7 tests). Schema version asserts moved 4 -> 5.
- Failures that are the same on the base: cli/build tests that need a build, `plugins/*` and `server/*`
  (missing `src/prompt/_generated.ts`).
