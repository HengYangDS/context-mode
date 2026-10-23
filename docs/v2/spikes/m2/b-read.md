# M2 candidate b-read: structure-aware Read view

Status: stopped before product code. The candidate cannot move either M2 metric. No live spend.

## Why it cannot move M2 (from the frozen baselines, 69077b8a)

M2 is the median of per-task savings (bench/m2/score.mjs `scoreRows`). A Read change only moves
tasks whose v2 bytes come from Read.

Main (baseline 87.6, Claude Code 2.1.303, n=3):

| task | saving now | v2 Read bytes | saving if v2 Read bytes were 0 |
|---|---|---|---|
| json-1 | 1.5 | 482 (PreToolUse deny text) | 61.75 |
| multi-1 | 91.54 | 0 | 91.54 |
| big-tests | 99.23 | 0 | 99.23 |
| big-json | 83.66 | 0 | 83.66 |

Median of 4 = mean(big-json, multi-1) = 87.6 in both columns. json-1 moves the median only if it
passes 91.54, that is v2 <= 67 B. Its file is 489 KB, over the host Read cap (256 KB), so the
model must run code on it; the smallest ctx_execute result in the transcripts is 170 B. No Read
handling reaches 67 B.

Heldout (baseline 96.52): sorted savings 0, 0, 0, 96.52 (jsonl-1), 96.8 (read-src), 97.52, 98.48
(read-csv). The Read tasks sit above the median. With v2 Read bytes at 0 they reach 97.91 and
99.76; the median stays 96.52. A Read change can only lower heldout M2, never raise it.

Upper bound for b-read: main 87.6 -> 87.6, heldout 96.52 -> 96.52.

## Host facts checked (Claude Code 2.1.303 binary)

- PostToolUse `updatedToolOutput` is checked against the tool's output schema
  (`outputSchema.safeParse`); a mismatch keeps the original ("does not match ... output shape").
  For Read the shape is `{type:"text", file:{filePath, content, numLines, startLine, totalLines}}`,
  and the host adds line numbers from `startLine` to `content`. A view whose lines are not file
  lines would carry wrong line numbers, which breaks the Edit-after-Read contract the task needs.
- Today the claude-code row denies an unranged Read over OUTPUT_CAP (16384 B) at PreToolUse
  (READ_DENY_MESSAGE, about 480 B). Read-src and read-csv then answer with one Grep.

## What moves M2 instead

- Main: big-json. Its Bash replace (205 B) did not hold the answer, so the model ran ctx_execute
  (186 B more). A selection that keeps the answer line lifts big-json above 91.54 and the main
  median to mean(multi-1, big-json) or higher.
- Heldout: the three 0 tasks (mcp-1, node-tests-1, grep-1). Any two of them above 96.52 lift the
  median.

## Guards

Not run: no behaviour change. `node --test tests/v2/` on this branch: 1405 tests, 1402 pass, 1 fail
(`[M7] cli/exit-ok: setup --yes --agents codex`), with no product code change, so the failure is in
the base commit or the machine, not in this candidate.

## Spend

$0 live. No DEVIATIONS row: no behaviour change.
