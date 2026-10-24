# M2 spike b-shape: shape by content type

Status: done on exp/m2-b-shape (base 69077b8a, frozen eval, untouched). Claude Code 2.1.303, claude-sonnet-5-5,
effort low, n=3 per arm, `--max-budget-usd 1` per session, fresh CLAUDE_CONFIG_DIR + HOME per session.

## Algorithm (D-M2-SHAPE-1, `src/core/index/shape.ts`)

Before the BM25 chunk pick of the main-agent replace, a detector looks for a structure with parsers and
counts, not with patterns on the content. If it finds one, it returns the *rare units*: the rows or lines
that break the structure that all other rows or lines follow.

- JSON: `JSON.parse` of an array of >= 20 objects. For each scalar key, count the values over all rows (an
  absent key is its own value). A key is skewed when one value holds >= 90% of the rows and the other values
  hold <= 2 rows. The rows with those other values are rare (at most 9, or no shape).
- Lines: a Drain-style template miner. A token with a digit is `<*>`. Lines are grouped by token count and
  first token. A line joins the first cluster in its group whose template matches >= 50% of positions;
  positions that differ become `<*>`. No shape if there are > 64 clusters (free text or code), > 4 common
  clusters, or a common template with no literal token (pure data). A line is rare if its cluster has
  <= 2 lines, or if its token at a skewed position of its cluster is rare (the JSON rule, per position:
  "degraded" among 279 "healthy").
- Pick: BM25 (`rankTexts`, any word) of each rare unit against intent + last user prompt. Only units with
  a score > 0 count. Greedy by score within REPLACE_RETURN_BYTES (96 B), as ADR-0009 §4: a unit that does not
  fit is skipped, never cut. A JSON row that does not fit whole keeps whole fields (the skewed field first,
  then the fields the query names, then scalars); the full row stays in the index. A header with counts
  ("1500 lines, 1 rare:") goes first if it fits. The more line (`ctx_search(...)`) always follows.
- No shape, no rare unit, or no rare unit the query names: null, and the old BM25 path runs, unchanged.

Why these thresholds: 2 rows = "seen at most twice", so one needle and one echo still count as rare;
90% keeps a 4-value enum field (25% each) from being called skewed; 9 rare units keep the digest inside one
budget; 50% similarity is the Drain default; 64 clusters keeps the cost linear (2-3 ms on 200 KB).

## D-M2-SHAPE-2: the whole persisted output

Above its inline limit Claude Code gives the hook only the first 30000 chars of stdout and keeps the whole
output in `tool_response.persistedOutputPath`. The adapter now names that file (no fs in the adapter, PRD P4)
and dispatch reads it, so the index, the digest and `bytes` see every line. An unreadable file keeps the head.
Without this, multi-1 part2 (needle on line 810) and the 200 KB big-json head (no valid JSON) never matched.

## Numbers

Main M2 (score = median over workloads, oracle-gated):

| workload | baseline off -> v2 (saving) | b-shape off -> v2 (saving) |
|---|---|---|
| json-1 | 800 -> 788 (1.5%) | 901 -> 142 (84.24%) |
| multi-1 | 6894 -> 583 (91.54%) | 6924 -> 474 (93.15%) |
| big-tests | 25653 -> 197 (99.23%) | 25653 -> 182 (99.29%) |
| big-json | 2424 -> 396 (83.66%) | 2394 -> 197 (91.77%) |
| **M2** | **87.6** | **92.46** |

Heldout M2: 96.52 -> **96.79**. read-src 96.79, read-csv 98.47, http-1 97.41, jsonl-1 99.33; mcp-1,
node-tests-1, grep-1 stay at 0% (leaks 1-3 of the baseline: other hook channels, not this candidate).

Oracle: 24/24 main, 42/42 heldout, both arms (baseline: all pass). json-1 moves because the run did not need
a second ctx_execute; that is model variance on a small task, not a shape effect.

Iterations (all main, n=3): shape digest only 89.72 -> + persisted output 83.95 (off arm variance: multi-1
off fell to 2362 B when the off model used grep; the header held templates, 79 B) -> header with counts only
92.46 (final).

## Guards

- Oracle success per workload: 3/3 on every workload, both sets (not lower than baseline).
- Heldout M2 96.79 >= 96.52.
- GP-LIVE-ROUTING (Sonnet 5.5, 29 rows): under 0, over 0, correct 20/20, pass true.
- D3 hook overhead (`e2e/checks/setup-hook-overhead.mjs`): ok, claude-code 4 ms, codex 0 ms, budget 15 ms.
- Edit-after-Read (live, 3 sessions, Read + Edit on a 300-line file): 3/3 Edit ok, file changed.
- `node --test tests/v2/`: 1411 pass, 0 fail.
- `npm run gate -- --all`: all layers pass except live T-GS6 (hook wall p95 <= 40 ms): new 41-73 ms, base
  69077b8a on the same host at the same time 39-86 ms (load average 7-11 from other jobs). Not a regression of
  this change; it needs a rerun on a quiet host.

## Spend

About $7.0 of $11: main x3 $2.84, heldout $2.53, routing $1.09, Edit-after-Read $0.18, gate live cases $0.33.
Raw transcripts: /private/tmp/cm-v2-impl-private/compact-m2/b-shape/.
