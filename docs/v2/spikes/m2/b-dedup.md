# M2 spike b-dedup: content-defined dedup of tool output

Status: done, negative result. Branch exp/m2-b-dedup from the frozen eval (69077b8a). No hook path changed.

## Algorithm

- `src/core/index/cdc.ts`: FastCDC-style content-defined chunking. Gear rolling hash `h = (h << 1) + GEAR[byte]`
  (fixed splitmix32 table, so deterministic). Normalized chunking: mask with log2(avg)+1 bits before `avg`,
  log2(avg)-1 bits after it; no cut before `min`, forced cut at `max`. Cuts cover the input with no gap,
  so chunks join back to the exact bytes (no truncation).
- `dedupGain(texts, refCost)`: per-session store keyed by SHA-256 of each chunk. A run of consecutive chunks
  already in the store would become one reference of `refCost` bytes (handle + range). A run saves
  `runBytes - refCost`, and only runs with `runBytes > refCost` count. refCost = 24 B.
- Tests: `tests/v2/index/cdc.test.mjs` (exact join, size bounds, determinism, shift resistance, gain math).

## Threshold choice: measured gain

The plan was to wire the store into PostToolUse only if the measured gain moves M2. Gain = saved / total
tool-result bytes, summed over the 3 baseline transcripts per task (Claude Code 2.1.303, raw under
/private/tmp/cm-v2-impl-private/compact-m2/m2-diag/).

| task | off arm, avg 64 / 128 / 256 / 512 | v2 arm, avg 64 / 128 / 256 / 512 |
|---|---|---|
| main json-1, big-tests, big-json | 0 / 0 / 0 / 0 % | 0 / 0 / 0 / 0 % |
| main multi-1 | 5.4 / 4.7 / 2.9 / 0 % | 0 / 0 / 0 / 0 % |
| heldout http-1 | 0.6 / 0 / 0 / 0 % | 0 / 0 / 0 / 0 % |
| heldout mcp-1 | 0.3 / 0 / 0 / 0 % | 0.3 / 0 / 0 / 0 % |
| heldout read-src, read-csv, jsonl-1, node-tests-1, grep-1 | 0 % | 0 % |

(min = avg/4, max = avg*4.) Why so low: no frozen workload reads the same output twice in one session.
Whole-output repeats are 0 B in every transcript. The line repeats seen earlier (mcp-1 12,000 B,
multi-1 120 B, big-json 439 B) are short lines spread across distinct records, so no repeated chunk run
is longer than a reference. The v2 arm already returns at most 96 B per replace, so nothing repeats there.

Best case (avg 64, v2 arm): mcp-1 saves 0.3 % of 40,012 B. That moves neither the main median nor the
held-out median. So the store is not wired into the hook: it would add hashing and a DB write to every
PostToolUse for no gain on M2.

## Before / after

No behaviour change, so the scores are the baseline: main M2 87.6, heldout 96.52. No live run spent.
The leaks that do move M2 are the three in bench/m2/README.md (non-ctx MCP matcher, Grep replace shape,
PostToolUseFailure) and the big-json selection; redundancy is not one of them.

## Guards

- node --test tests/v2/: 1410 tests, 1408 pass, 0 fail.
- gate --all: PASS.
- hook-gs6 (40 runs): p95 40.9 ms vs bare node 33.9 ms (7.0 ms over node), cpuOverNodeMs 6, pass.
- Oracle, held-out M2, routing e2e, Edit-after-Read: no hook or adapter code changed, so baseline holds.

## Spend

$0 live.
