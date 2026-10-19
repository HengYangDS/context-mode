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
