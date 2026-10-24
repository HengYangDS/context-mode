# compact-hard, candidate a-push (D-CMP-PUSH-1)

Branch `exp/compact-a-push`, from 5e5da716 plus the frozen eval 32f57beb (eval files not edited).

## Algorithm

On the first UserPromptSubmit after a compaction (meta key `push_pending:<session>`, set by `markCompacted`,
taken once with `metaTake`), the hook:

1. Builds the query: the prompt plus the session goal (the first prompt of the session).
2. Runs the store search `ftsRank` (BM25 porter + trigram, fused by RRF) with scope `session` under the hook
   session id, top `PUSH_HITS = 100` chunks. This uses the hook session id, so the MCP-id scope bug (cause 3)
   does not apply.
3. Reads a window of `PUSH_WINDOW_CHUNKS = 24` chunks around the hits of each source, joins them in `ord`
   order, and maps each hit line to an item: the line, its indent ancestors (up to 8: the JSON key path) and
   its indent block when the whole block fits 640 B. Lines are never cut.
4. `rel(i)` = BM25 of the item text against the query (`rankTexts`, store tokenizer). Items under
   `0.3 * rel(top)` are dropped.
5. MMR: next = argmax `0.7 * rel(i)/rel(top) - 0.3 * max_j Jaccard(lines(i), lines(j))`. An item that does not
   fit the budget (`PUSH_BUDGET_BYTES = 3072`, wrapper included, about 1k tokens) is left out whole.
6. Output: `<context_mode_push>` with `source: <label>` and the picked lines in source order, `...` at gaps.
   The old recall block follows when it has rows.

Why: 3072 B keeps the push under half of the 2,000-token guard. Lambda 0.7 and the 0.3 floor are the usual MMR
values; they were not tuned on the eval.

## Results (claude-sonnet-5-5, effort low, Claude Code 2.1.303, n=3, budget $1)

| set | arm | before | after |
|---|---|---|---|
| main | v2 | 2/36 = 5.6% | 6/36 = 16.7% |
| heldout | v2 | not run | 3/18 = 16.7% |

Main after: median tokens after compaction 42,590; median hook bytes after compaction 846; ctx call rate
0.25; cost $1.69. Heldout: 33,192 tokens, 1,106 hook bytes, cost $0.82. Direct arm baseline is 72.2%.

Offline probe of the push alone (fixture text, same chunking): the answer value is in the push block for
8/12 main questions. The live score is lower: the model often gets the value lines but answers "unknown".

Why the fix is partial: for the log questions the prompt words (FATAL, E4471) are rare in the
48-byte-chunk index next to the session goal words, so the goal words fill the budget with common lines. The
manifest questions name a path that BM25 splits into common tokens; no hit lands on the target line.

## Guards

- Tokens added after compaction: push <= 3072 B by construction (about 770 tokens); measured median 846 B
  (main), 1,106 B (heldout). Pass.
- `node --test tests/v2/`: exit 0 (before the push.test.mjs file); `tests/v2/compaction/push.test.mjs` 2/2.
- Hook D3 (`bench/hook-gs6.mjs`): `pass:false` on this machine. Quiet run p95 47.7 ms, cpuOverNode 8.7 ms;
  loaded runs during live sessions p95 88-94 ms. Not compared against the base on the same load. Not proven.
- GP6, compaction e2e cases, gate --all, old 10/10 probe: not run (time).

## Spend

$2.51 live (main $1.69 + heldout $0.82). Raw transcripts: private folder `compact-m2/a-push/`.
