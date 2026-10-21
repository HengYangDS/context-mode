# v2-design morning report

Date 2026-10-21. Branch `v2-design`. Sources: `.impl/BLOCKED-M7.md`, `docs/v2/benchmarks.md`, `docs/v2/impl/DEVIATIONS.md`, `bench/saving-score-last.json`, the step results of the overnight run. The older report is in `docs/v2/review/OVERNIGHT-REPORT-2026-10-19.md`.

## 1. Is v2-design ready to merge?

**No.** Code, tests and CI are green. Three gates and some owner steps are still open. The owner must decide them. I did not decide any of them.

| Check | State |
|---|---|
| Final gate (fresh clone, `node scripts/gate.mjs --all`) | 3 of 3 runs exit 0. `check-removed` clean. Live layer SKIP in all 3 runs: 0 of 30 live cases ran, so the gate verifies no live result |
| CI on v2-design | Green after one fix (commit 872216b8, run 39523870588): ubuntu, macos, windows, each on Node 24.15.0 and Node 26. The run before it (39522423713, commit 5c0cc87b) failed on both Windows jobs: the Read deny matcher in `src/core/policy/user-deny.ts` did not match backslash globs and `//tmp/x` anchors on Windows. Fixed and pushed |
| M7 | Not marked done (`.impl/BLOCKED-M7.md`) |
| GS6 hook budget (T-GS6) | Fails: p95 41 ms against limit 40 ms |
| GS6 T-F1 | Fails: 1 MiB PostToolUse p95 166 ms against limit 60 ms. 64 KB live run 62 ms against 60 ms |
| GS11 T-CMP | Fails: correct 0.70 against 0.80, call rate 0 against 0.70 |
| Saving target | M1 94.12 reached 90. M2 88.9 did not (1.1 short) |
| GS10 R1, R2; GS2, GS3 | Not run. Owner or release steps |

## 2. Saving loop (M1 offline replay, M2 live median over 4 tasks)

Guards: success, small outputs, tokens, gate. Target 90 for M1 and M2.

| Round | Change | M1 | M2 | Guards | Merged |
|---|---|---:|---:|---|---|
| Baseline | v2-design before the loop | 12.03 | 2.69 | - | - |
| 1 | Bash replace uses Claude Code Bash shape `{stdout, stderr, interrupted}`. Sizes: trigger 4096, return 1024, chunk 256 | 85.72 | 69.22 | ok | yes |
| 2 | Return bytes 1024 to 512 | 90.88 | 79.65 | ok | yes |
| 3 | Return bytes 512 to 96, chunk 256 to 48 | 94.76 | 86.41 | ok | yes |
| 4 | Shorter more-line label | 94.74 | 85.78 | gp-cases gate failed | no |
| 5 | Chunks ranked by intent plus the last user prompt | 94.12 | 88.90 | ok | yes |
| 6 | Label `<tool>#` plus 8 hex of sha256(call id) | 94.10 | 89.52 (notes 88.8) | ok | no, did not beat best |
| 7 | Read full output from `persistedOutputPath` when stdout is cut (limit 4 MiB) | 94.12 | 89.09 (notes 87.98) | ok | no, did not beat best |
| **Final (round 5)** | head 1d55d561 | **94.12** | **88.9** | **ok** | |

- M1 passes the target. M2 is 1.1 points short.
- With 2 runs per arm, a 1 point M2 gap is inside the noise. Round 6 moved big-json from 84.19 to 76.41 with no relevant change. "90 reached" can be neither claimed nor ruled out.
- Per task (last merged file): big-tests 99.23, multi-1 90.94, big-json 86.86, json-1 51.7. json-1 output is under the 4096-byte trigger, so no replace happens.
- Round 7 finding: Claude Code gives the PostToolUse hook only the first 30000 chars of stdout. Reading the full file fixed the missing line, but the model re-checked and big-json fell.
- Selection is BM25 over whole chunks. No head/tail cut and no regex filter on returned text.

## 3. Final A/B: off, v1, v2

54 sessions (3 runs x 6 tasks x 3 arms). All pass 18/18 per arm. Detail: `docs/v2/benchmarks.md`, `bench/live/results/ab-final.json`.

| Measure | off | v1 | v2 |
|---|---:|---:|---:|
| Median session tokens | 36,217 | 42,557 | 38,252 |
| Median saving vs off (min / max) | - | -17.5 % (-61.3 / -15.1) | -5.5 % (-5.7 / +30.4) |
| Median tool_result bytes | 46.5 | 46.5 | 31 |
| ctx calls (sessions of 18) | - | 2 | 3 |
| Cost, USD | 0.534 | 0.747 | 0.687 |

- v2 uses fewer tokens than v1 on all six tasks (+10.2 % median, min +10.0, max +56.9).
- Neither plugin beats off on the median. The plugin adds about 6.3k tokens (v1) and about 2.0k (v2) when the model makes no ctx call.
- v2 saves on json-1 (-30.4 % vs off) and multi-1 (-9.9 %). The model rarely calls ctx tools. n = 3 per cell.
- Total cost 1.97 USD. DEVIATIONS row `D-FINAL-AB` (bench harness only).

## 4. Compaction (T-CMP, clean isolation)

Sonnet 5.5 low, 10 sessions per arm, arms a to e. Commit d72ca4e.

| Measure | Result | Limit |
|---|---|---|
| Correct, every arm | 7/10 | 0.80 |
| `ctx_resume` / `ctx_search` call rate, every arm | 0/10 | 0.70 |
| Bytes returned by those tools | 0 in 50 sessions | - |
| Cost per arm (USD) | a 0.8682, b 0.9114, c 0.9014, d 0.8898, e 0.9514 | total 4.5222 |
| resume_seq | 50/50 | - |
| Sessions that touched host memory | 0 of 50 | - |

All 15 misses are fixture session-03 (case-sensitive exactMatch). By the ticket rule, claude-code `compactSummary` stays `none` (D-M7-CL-1). No code changed, no DEVIATIONS row.

## 5. Memory live

Four cases, run one by one, Sonnet 5.5 low. All PASS.

| Case | Result |
|---|---|
| memory-r6-eval-local | PASS. Last-request seq matches ground truth in both fixtures. No model call |
| memory-retrieval-local | PASS. R2 recall@5 1.000 (6 of 6), MRR 0.653. Timeline 2/2 order, 2/2 paging. Decision tag D3 precision 1.000, recall 1.000. Fixture smoke gate, N = 6, not a real recall estimate |
| memory-r6-resume-quality | PASS. 0.0075 USD |
| decision-q3-applied | PASS. 0.0435 USD |

Model spend 0.0510 USD. Real-data numbers are stored, not re-run (private journals are not in the clone): R2 recall@5 0.743, MRR 0.671 (148 queries); R2 decision recall@5 0.744 (39 queries); timeline 43/47 order-correct; compaction v2 block open-error 11/12.

## 6. Cleanup plan

`.impl/cleanup-plan.md`, commit bd2267e6, 384 rows. Nothing deleted yet.

- v1 `src` has 86 files with subfolders, not 36. The v2 tree imports one of them: `src/adapters/client-map.ts` (MOVE, wave 0). The other 85 are DELETE.
- The 131 KEEP-PASS tests reach 80 of those 85 files and 15 `hooks/` files. So deletes must come after the KEEP-PASS list is cut. The plan has 4 waves; `check-removed` moves to wave 3.
- 210 v1 test files: 81 RETIRE (each cites an ADR or TECH-SPEC 3.10), 81 COVERED (each names the tests/v2 or GP case). Branch triage: 3 merged (install-opencode, install-pi, install-zcode), 1 partly ported (M5-T1, 2 GP11 cases), 2 obsolete (M3-C0, M3-K1).
- Gate `--milestone M7 --quick`: all layers PASS, live SKIP. GP11 13/13.

## 7. Owner decisions still open

I measured and did not decide. Numbers are from `.impl/BLOCKED-M7.md`.

| Decision | Numbers | Recommended option |
|---|---|---|
| Hook budget (T-GS6) | p95 41 ms against 40. Command hooks pass: wall p95 43 ms, CPU over Node 20 ms. Bare node alone 34 to 50 ms under load | Re-measure on an idle machine first. If still 41, take one hook step (lazy policy/index import, or crypto-free projectKey; about 3 to 10 ms CPU each). Keep the budget |
| T-F1 at 1 MiB | 166 ms against 60. Bench after D-M7-FT-1/2: 113.8 to 120.8 ms. Allow-path floor for 1 MiB stdin about 56 ms. 64 KB live 62 ms against 60 | Move the write of more than 65536 bytes to a separate process. Do not state "budget does not apply" until the 64 KB live run passes |
| Compaction policy | Section 4. Pointer-only call rate 0 in every run so far | Accept `none` for claude-code and rewrite the GS11 criterion. Also decide on the case-sensitive exactMatch in session-03: it caused all 15 misses |
| GS10 R1, R2 | Not measured (D-M7-arch-5) | Owner runs and signs off. GS2, GS3 at release |
| Live layer in M7 | 0 of 30 cases ran in the gate | Make `--milestone M7` run all live cases before merge. `--all` exists |
| Saving M2 90 | 88.9, noise about 1 point | Accept 88.9, or run more runs per arm. Do not lower the trigger: it costs the small-output guard |

Owner-only release steps (no agent did them):

- Switch the marketplace ref.
- `npm deprecate` (needs the OTP).
- Set branch protection on `main`.
- Merge `v2-design` to `main`.
- Tag the release.
- Interactive logins for agents whose fixtures wait for a login.
- Decide on the home-path scrub (`docs/v2/impl/07-tools-ops.md`, `docs/v2/impl/11-server.md`, `docs/v2/review/*`, `e2e/live/compact/results/*`).
