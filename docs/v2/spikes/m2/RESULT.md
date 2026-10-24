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

## Live guards (v2-design 18e4a6cd)

- GP-LIVE-ROUTING (sonnet-5-5, 58 rows): under 0, over 0, correct 40/40 on the scored runs, pass true.
- D3 hook overhead (`e2e/checks/setup-hook-overhead.mjs`): ok, claude-code 11 ms, budget 15 ms.
- Live T-GS6 (`node e2e/live/run.mjs --all --only T-GS6`): PASS on this run (host load varies; see the A/B above).
- `gate.mjs --all`: v2-unit, ci-checks, gp-cases, prompt-lint, check-removed PASS. The full live layer was
  started and stopped by hand after 48 minutes in the compact case (`e2e/live/compact`), which this change
  does not touch; the cases that cover this change (routing, T-GS6) were run alone.
- Edit-after-Read was not re-run in round 2. The Read path was not changed in round 2 (only the MCP and Grep
  replace, and the shape detector); the round 1 result 3/3 stands.

## Checker re-run (2026-10-24, Claude Code 2.1.303, sonnet-5-5 low, n=2, fresh clone)

- 18e4a6cd main: 92.47 (json-1 801 -> 142, multi-1 6979 -> 474, big-tests 25653 -> 182, big-json 2378.5 -> 197),
  every oracle 2/2. This matches the 92.5 above.
- HEAD (fbd4f781, after D-CR2-HANDLE-1) heldout: 97.73 (read-src 96.1, read-csv 97.96, mcp-1 40012 -> 322,
  http-1 97.29, node-tests-1 0.01, jsonl-1 98.15, grep-1 16976 -> 386), every oracle 2/2.
- HEAD (fbd4f781) main: 84.03 (json-1 37.33, multi-1 6906 -> 915, big-tests 25653 -> 325, big-json 2428 -> 454),
  every oracle 2/2. D-CR2-HANDLE-1 adds one handle line (about 250 B) to each replace, outside the replace
  budget. On the small main outputs this drops main below 90. The 92.5 is true for 18e4a6cd only.

## Round 3 (2026-10-24, Claude Code 2.1.303, sonnet-5-5 low, n = 3, one run per build)

| Build | score | json-1 | multi-1 | big-tests | big-json | oracles |
|---|---|---|---|---|---|---|
| head (v2-design 5a79496d) | 78.97 | 34.38 (800 -> 525) | 86.8 (6930 -> 915) | 98.73 (25653 -> 325) | 71.14 (2436 -> 703) | all 3/3 |
| handle (exp/r3-handle cccb08ca) | 85.02 | 34.38 | 86.45 | 99.25 | 83.58 | all 3/3 |
| combined (exp/r3-combined bd4842fc) | 86.56 | 30.0 (900 -> 630) | 89.55 (6930 -> 724) | 99.25 (25653 -> 193) | 83.58 (2436 -> 400) | all 3/3 |

Spread on head: the checker run on fbd4f781 (n = 2) gave 84.03; this run on 5a79496d gives 78.97. json-1
and big-json move most. No build reaches 90, so the round 3 pick rule merges nothing. The handle line in
the replace budget (D-CR3-HANDLE-1) gives about 6 points over head (one run each); the gap left is json-1 (small output, the
replace is near its raw size).

### Round 3 checker re-run (2026-10-24, fresh clone, Claude Code 2.1.303, sonnet-5-5 low, n = 3)

| Build | score | json-1 | multi-1 | big-tests | big-json | oracles |
|---|---|---|---|---|---|---|
| head (v2-design 5a79496d) | 86.18 | 29.08 | 86.7 | 98.73 | 85.66 | all 3/3 |
| combined (exp/r3-combined bd4842fc) | 60.08 | 30.67 | 89.48 | 99.25 | -26.53 (2420 -> 3062) | all 3/3 |

Combined big-json: two of three v2 runs called `ctx_search` (2194 B per-tool). Round 3 gave head 78.97 and
combined 86.56; the order of the two builds flips between runs. Neither run reaches 90.

## Round 4: interleaved measure and merge rule (2026-10-24)

Builds: HEAD = v2-design 60f2991d; FINAL = exp/r4-final bf9c810a (exp/r4-m2-json on exp/r3-combined).
`bench/m2/eval.mjs --set main`, Claude Code 2.1.303, claude-sonnet-5-5 low, n = 3, order H, F, H, F, H, F.
Cells: off bytes -> v2 bytes (saving %).

| Run | score | json-1 | multi-1 | big-tests | big-json | oracles |
|---|---|---|---|---|---|---|
| HEAD 1 | 83.99 | 801 -> 142 (82.27) | 2457 -> 915 (62.76) | 25653 -> 325 (98.73) | 2428 -> 347 (85.71) | all 3/3 |
| FINAL 1 | 87.63 | 773 -> 142 (81.63) | 6906 -> 603 (91.27) | 25653 -> 225 (99.12) | 2428 -> 389 (83.98) | all 3/3 |
| HEAD 2 | 84.97 | 900 -> 142 (84.22) | 2430 -> 915 (62.35) | 25653 -> 325 (98.73) | 2428 -> 347 (85.71) | all 3/3 |
| FINAL 2 | 87.59 | 626 -> 142 (77.32) | 6906 -> 603 (91.27) | 25653 -> 225 (99.12) | 2419 -> 389 (83.92) | all 3/3 |
| HEAD 3 | 71.64 | 901 -> 626 (30.52) | 2647 -> 915 (65.43) | 25653 -> 325 (98.73) | 2428 -> 538 (77.84) | all 3/3 |
| FINAL 3 | 84.33 | 926 -> 142 (84.67) | 2356 -> 603 (74.41) | 25653 -> 225 (99.12) | 2428 -> 389 (83.98) | all 3/3 |

Mean (min-max): HEAD 80.20 (71.64-84.97), FINAL 86.52 (84.33-87.63). Rule: mean(FINAL) >= mean(HEAD) - 2 and
every oracle passes: 86.52 >= 78.20, all 3/3: met. M2 >= 90 on the mean: not met (86.52).
The off reference of multi-1 moves between 2356 and 6906 B from run to run, which moves the score.

Guards on FINAL: `node --test tests/v2/` 1444 tests, 1442 pass, 0 fail, 2 skip; `gate.mjs --all --quick` exit 0
(live SKIP); D3 (`e2e/checks/setup-hook-overhead.mjs`) ok, claude-code 11 ms, codex 5 ms, budget 15 ms;
GP-LIVE-ROUTING sonnet-5-5 (58 rows) under 0, over 0, correct 40/40, pass true. Info, not in the rule:
`bench/hook-gs6.mjs` 40 runs p95 62.1 ms combined wall (limit 60, bare node 46.9 ms on the same loaded host),
CPU over node 8.3 ms (limit 20), pass false. Frozen evals: no diff to 32f57beb / 69077b8a.
Compaction for the same builds: `../compact/RESULT.md` round 4. Merged into v2-design (2c40245e).

Round 4 checker (fresh clone of v2-design 24a42ab4, same settings, n=3, twice): 87.74 and 87.68, all oracles
3/3. json-1 34.25 and 29.74 in both runs (v2 bytes 526 and 633: the model used Read after the digest), the same
low json-1 as HEAD run 3; the other three workloads match FINAL (91.3, 99.12, 84.0-84.2). M2 >= 90: not met.
