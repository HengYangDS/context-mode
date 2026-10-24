# compact-hard candidate a-ledger (salience-ranked session ledger)

Branch `exp/compact-a-ledger` from 5e5da716. Eval frozen at 32f57beb (no file under `e2e/live/compact-hard/` changed).

## Algorithm (D-FU-CMP-LEDGER-1)

The turn-boundary recall (`src/core/compaction/recall.ts`, DECISIONS-r11 (B)) gave whole journal rows only.
A 90-222 KB `cat` row is larger than RECALL_BUDGET_BYTES (2048), so it never went out, and the values were lost.

New step `pickLines`, for rows too large to go out whole:

1. Split the row body into lines. For each non-blank line, keep a context: the nearest earlier lines with
   less leading whitespace (one stack pass, O(lines)). A JSON value gets its key path
   (`{ > "regions": { > "ap-south-2": { > ... > "tag": ...`). A TAP failure detail gets its `not ok` line.
2. Score every line (context + text) against the prompt with BM25 (`rankTexts`, the store tokenizer,
   `any` mode), all lines of all oversize rows in one corpus. A term that is rare in the output
   (req id, path, seed, code) gives its line a high IDF, so that line ranks first.
3. Keep lines with score >= RECALL_MIN_SCORE (5, same threshold as whole rows). Order: score desc, then
   older row, then earlier line. Take whole lines while they fit in the bytes the whole rows left
   (budget 2048 B, wrapper included). The same rendered line goes out once.
4. Line format: `#<seq> L<n>: <context> > <line>`. `#seq` is the retrieval handle (`ctx_resume(seq)`),
   `L<n>` is the line number in the output. No line is cut; no regex.

Deterministic: same rows + same prompt -> same bytes (test `recall-lines/deterministic`).

## Offline check (no model)

`pickRecall` on the fixture bodies with the eval prompts: answer value inside the block on main 11/12,
heldout 6/6 (miss: `cfg-zero-replicas`, a "which one has 0" question that has no rare term).
Block size 155-2040 B.

## Live numbers (claude-sonnet-5-5, effort low, n=3, Claude Code 2.1.303, --budget 1, v2 arm only)

| set | baseline v2 | a-ledger v2 | tokens after compact (median) | hook bytes after compact (median) | cost |
|---|---|---|---|---|---|
| main | 2/36 = 5.6% | 9/33 valid = 27.3% | 33,067 | 649 B | $1.95 |
| heldout | not run | 6/18 = 33.3% | 32,688 | 1,053 B | $0.90 |

Direct arm baseline (main): 72.2%. a-ledger does not reach it.

Main per question (correct of 3): cfg-zero-replicas 3, tests-seed 3, tests-fail1-got 3, all others 0
(3 runs of 36 void). Heldout: h-cfg-mailer-digest 3, h-dist-hash-0088 3, others 0.

## Why it is not higher (from the transcripts)

- In several failed sessions (for example `dist-hash-0417`, `log-fatal-req`) the UserPromptSubmit hook
  after compaction returned nothing: the recall did not fire, so the model saw only the 353 B pointer.
  Cause not found inside the time box (candidates: compacted marker or row read; check next).
- Where recall fired with the right line in the offline check, the live prompt sometimes ranked other
  lines first (`cfg-ledger-tag`: the block filled with other regions of the ledger service; the BM25
  weight of the region term is too low against the service term). A per-row cap on lines with the same
  context prefix is the next step.
- Cause (3) of the diagnosis (hooks index under the host session id, MCP server under `mcp:<id>`) is not
  fixed here; `scope:"session"` searches still return 0 sources.

## Guards

- node --test tests/v2/: 1403 pass, 0 fail.
- New tests first: `tests/v2/compaction/recall-lines.test.mjs` (4); all `tests/v2/compaction/` 40/40.
- Tokens added after compaction: median 649 B (main), 1,053 B (heldout); max by construction 2,048 B, under 2,000 tokens.
- gate --all, GP6 and hook D3 p95: see the commit status; they were still running at the time box.
- pickRecall cost in the offline check: 4-50 ms per prompt on a 222 KB row. It runs only on the first
  prompts after a compaction, but it can break the 15 ms D3 budget on those prompts. Not accepted as is.

## Spend

Live: $2.85 of $15.
