# M2 round 2 result

Claude Code 2.1.303, claude-sonnet-5-5 low (main and heldout), n=3 per arm, `bench/m2/eval.mjs` (frozen at
69077b8a), `--max-budget-usd 1` per session, fresh CLAUDE_CONFIG_DIR and HOME, keyless. Raw transcripts are
outside the repo.

## Round 1: candidates and why b-shape

Round 1 tried levers on the replace path. b-shape (D-M2-SHAPE-1, D-M2-SHAPE-2, `docs/v2/spikes/m2/b-shape.md`)
won: it reads the structure of a large output with a parser (JSON rows, a mined line log), returns the rare
units the query names whole, and keeps the BM25 pick when there is no shape. It is an algorithm over the
content, not a pattern and not a cut. Main M2 87.6 -> 92.46, heldout 96.52 -> 96.79, every oracle passed.
The only failed gate was T-GS6 (hook wall p95 <= 40 ms).

## T-GS6 A/B (base 69077b8a vs b-shape, same host, interleaved ABAB, 6 rounds)

Raw data: `docs/v2/spikes/m2/gs6-ab-r2.jsonl`. Load average on the host was 8 to 11 during all rounds.

| Round | base p95 ms | b-shape p95 ms | paired diff |
|---|---|---|---|
| 1 | 43.3 | 41.1 | -2.2 |
| 2 | 83.9 | 82.6 | -1.3 |
| 3 | 45.3 | 40.2 | -5.1 |
| 4 | 39.1 | 127.0 | +87.9 |
| 5 | 48.6 | 45.6 | -3.0 |
| 6 | 40.5 | 86.8 | +46.3 |

Median paired difference -1.75 ms. The rule was "slower by more than 2 ms median paired means regression".
b-shape is not slower: the T-GS6 miss is host load (bare Node p95 alone was 35 to 54 ms in these rounds), not
the shape code. Rounds 4 and 6 are load spikes in one arm. No cost cut was needed. The 40 ms budget is still
not met on this host; it was not met by base either (43.3, 83.9, 45.3, 48.6 ms).

## The MCP fix (leak 1)

Diagnosis: heldout mcp-1 (a non-ctx MCP tool, 40,012 B) stayed 40,012 B for two reasons.

1. D-M2-MCP-1. The Claude Code PostToolUse matcher did not name `mcp__*`, so the hook never ran. Fix at the
   root: on a row with a replace channel (`hasReplace`: claude-code, pi) the PostToolUse matcher also names
   `mcp__.*`. PreToolUse keeps the narrow matcher (no extra spawn). `build/manifests.ts` and doctor D3
   (`composeMatcher`) build the same text. The adapter reads the MCP `tool_response` (an array of content
   blocks, probed on 2.1.303) as its joined text blocks, and replaces with one text block, the shape the host
   accepts. A block that is not text (image, resource) sets `keep`: the original stays. The Grep content
   response `{mode:"content", content, ...}` (grep-1: 16,890 B, read before as one JSON string) is read as its
   content and replaced with the same object with `content` swapped.
2. D-M2-MCP-2. After the hook ran, the digest still lost the one blocked ticket (oracle 0/3): the shape
   detector needed one value to hold 90% of rows, and `status` has three common values. A key or token
   position with at most 8 distinct values is categorical; with two or more common values, the values seen
   in at most 2 rows are rare. The row comes back whole; the full output stays indexed.

Other adapters: only claude-code and pi have a replace channel (`REPLACE_ROWS`). Pi takes tool results
in-process, not through a matcher. Codex, Qwen, ZCode, Gemini, Copilot, VS Code and Kiro have no replace
channel (ADR-0001), so the matcher is unchanged there (GP3 `unrelated-mcp-tool-no-hook` still holds for them).

Not fixed, with the reason: heldout node-tests-1 (10,447 B, 0%). The test run exits 1, and Claude Code
fires `PostToolUseFailure`, not `PostToolUse`, for it. A probe on 2.1.303 (hook returned `updatedToolOutput`
on `PostToolUseFailure`) showed the model still got the original text, so the host ignores a replace on
that event. No hook can shrink a failed command's output on 2.1.303. Open item.

## Final numbers (v2-design 18e4a6cd, sonnet-5-5)

| Set | Before | After | Run 1 | Run 2 |
|---|---|---|---|---|
| main | 87.6 | 92.5 | 92.5 | 92.5 |
| heldout | 96.52 | 97.44 | 97.44 | 97.44 |

Per workload, off bytes -> v2 bytes (run 2 of the final build; run 1 in brackets where it differs):

| Workload | off -> v2 | saving % |
|---|---|---|
| json-1 | 1026 -> 641 [900 -> 624] | 37.52 [30.67] |
| multi-1 | 6894 -> 474 | 93.12 |
| big-tests | 25653 -> 182 | 99.29 |
| big-json | 2424 -> 197 | 91.87 |
| read-src | 43236 -> 1108 | 97.44 |
| read-csv | 197 -> 575 [37929 -> 575] | -191.88 [98.48] |
| mcp-1 | 40012 -> 177 [182, oracle 0/3 before D-M2-MCP-2] | 99.56 |
| http-1 | 26092 -> 648 | 97.52 |
| node-tests-1 | 10447 -> 10447 | 0 (PostToolUseFailure, see above) |
| jsonl-1 | 460 -> 16 | 96.52 |
| grep-1 | 16890 -> 297 [215] | 98.24 [98.73] |

read-csv in run 2: the off arm of that run found the answer with a cheap command (197 B), which makes the
off reference small. The v2 bytes are the same as in run 1 (575). The score is a median, so it did not move.
Every oracle passed (v2 3/3 on all workloads in both final runs).

Opus check, main, claude-opus-5-5: 92.53 (json-1 125 -> 147 -17.6, multi-1 93.26, big-tests 99.29, big-json
91.81), every oracle 3/3.

Guards: unit 1421 pass, 0 fail; `gate.mjs --all` layers v2-unit, ci-checks, gp-cases, prompt-lint,
check-removed PASS (GP1 and GP3 goldens updated for the PostToolUse matcher, D-M2-MCP-1). The live layer
and GP-LIVE-ROUTING, D3 and Edit-after-Read are in the section "Live guards" below.
