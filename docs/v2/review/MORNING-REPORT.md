# v2-design morning report

Date 2026-10-21. Branch `v2-design`. Sources: `docs/v2/benchmarks.md`, `docs/v2/adr/0009-compaction-and-memory.md`, `docs/v2/impl/DEVIATIONS.md`, `bench/saving-score-last.json`, the step results of the last run. Older report: `docs/v2/review/OVERNIGHT-REPORT-2026-10-19.md`.

## 1. Ready to merge?

**No.** Code, tests and CI are green. The saving goal is not met, and v2 does not beat "off" on session tokens. The owner decides.

| Check | State |
|---|---|
| CI on v2-design | Green. Latest ci.yml run 39538859348 (push "move MORNING-REPORT.md into docs/v2/review"). ubuntu, macos, windows, each on Node 24.15.0 and Node 26: all success |
| Gate `node scripts/gate.mjs --all` (fresh clone, 3 runs) | Failed the same way 3 times: `check-removed` exit 1, because tracked `MORNING-REPORT.md` sat at the repo root. Live step skipped as a result. v2-unit 1199 pass, 0 fail, 2 skip. ci-checks and prompt-lint pass. The file is now moved (994f9d48). I did not re-run the full gate after the move |
| Saving M2 (target 90) | 87.23 median of 3. Below target |
| Final A/B | v2 saves no session tokens vs off. See section 3 |
| T-CMP | Fails: correct 7/10 (limit 0.80), call rate 0/10 (limit 0.70) |
| T-GS6, T-F1, GS10, GS2, GS3 | Open from the earlier report. Not re-measured in this run |

## 2. Saving score (M1 offline replay, M2 live median over 4 tasks)

Lock OK: both score files match `bench/saving-score.lock` on origin/v2-design (980272a5). Build OK. Guards: success, small1k, tokens, gate.

| Round (earlier) | M1 | M2 | Merged |
|---|---:|---:|---|
| Baseline | 12.03 | 2.69 | - |
| 1 Bash shape, trigger 4096 / return 1024 / chunk 256 | 85.72 | 69.22 | yes |
| 2 return 512 | 90.88 | 79.65 | yes |
| 3 return 96, chunk 48 | 94.76 | 86.41 | yes |
| 4 shorter more-line | 94.74 | 85.78 | no (gate failed) |
| 5 chunks ranked by intent plus last prompt | 94.12 | 88.90 | yes |
| 6 label with call-id hash | 94.10 | 89.52 | no |
| 7 full output from persistedOutputPath | 94.12 | 89.09 | no |
| **This run (3 runs, median)** | **94.21** | **87.23** | guardsOk false |

| Run | M1 | M2 |
|---|---:|---:|
| 1 | 94.21 | 89.32 |
| 2 | 94.21 | 85.83 |
| 3 | 94.21 | 87.23 |

- Guards: success, small1k, tokens passed in all 3 runs. Only the gate guard failed (layer `check-removed` FAIL, the root-file cause in section 1).
- v2 median session tokens (smallTok): 38178, 38178, 38179. Off arm: about 36167 to 36196.
- Per-task M2 savingPct, in score (json-1, multi-1, big-tests, big-json): run1 83.48, 92.05, 99.23, 86.6. run2 81.07, 90.6, 99.23, 74.51. run3 71.78, 92.03, 99.23, 82.44.
- Out of score (log-1, tests-1, file-1, git-1): run1 48.39, 0, 0, 60.98. run2 96.77, 0, 0, 0. run3 48.39, 99.82, 0, 0.
- big-json is the noisiest task (74.51 to 86.6) and drives the M2 spread.
- The runs changed the tracked file `bench/saving-score-last.json` in the clone. That run made no commit.

Lever: defer (branch `impl/final-defer`, 3 commits on top of 980272a5).
- `ctx_search` stays deferred. `ctx_execute` stays the only alwaysLoad tool. The server already sends `_meta["anthropic/alwaysLoad"]` (`src/entries/server.ts:237`) and Claude Code 2.1.303 honours it. Making `ctx_search` alwaysLoad added about 345 tokens to every call, so I did not.
- Instead I shortened the always-loaded text: `ctx_execute` 732 to 412 chars, `ctx_search` 716 to 292 chars. Prompt lint passes. The stale "default 120000" now reads default and max 600000.
- New unit test: alwaysLoad descriptions total at most 512 chars. Committed red first, then green. DEVIATIONS row D-M7-FD-1.
- Shortening the 8 deferred descriptions moved the prefix by +1 token, so they are unchanged.

## 3. Final A/B: small vs large, v2 vs v1 vs off

81 sessions, all passed. v1 is `main` built as a local plugin (1.0.169). v2 is v2-design release-out. Commit b546cca0. Total cost 2.68 USD (limit 8). Detail: `docs/v2/benchmarks.md`.

| Group | Sessions | Median tokens off / v1 / v2 | Saving vs off, v1 / v2 | v2 vs v1 | Median tool_result bytes off / v1 / v2 | Success | Cost USD off / v1 / v2 |
|---|---:|---|---|---:|---|---|---|
| SMALL (5 tasks x 3 runs) | 45 | 36184 / 42493 / 38210 | -17.4 % / -5.7 % | +10.2 % | 31 / 31 / 8 | 15/15 each arm | 0.330 / 0.537 / 0.359 |
| LARGE (multi-1, big-tests, big-json, json-1) | 36 | 55897 / 65599 / 60390 | -16.5 % / -19.6 % | -2.7 % | 4694.5 / 2436.5 / 734.5 | 12/12 each arm | 0.607 / 0.754 / 0.391 |

- v2 cuts the tool_result bytes the model sees. But its 5 extra ctx calls cost more tokens than that saves on multi-1 (+29 % vs off) and big-json (+74 % vs off). On big-tests v2 wins (-28 % vs off).
- v2 does not save tokens vs off in either group. On LARGE it loses to v1 by the table above. Nothing was tuned after this run.
- Deviation: I added a `--tasks` option to `bench/live/ab-quick.mjs`. LARGE uses json-1 from the SMALL run, because `score-tasks.mjs` has only four tasks.

## 4. Live replace proof

16 runs (4 sizes x git / non-git x 2). Full output 8893, 19998, 28003, 60090 bytes. The model saw 152, 187, 182, 190 chars. Answer correct 16 of 16. No errors.

## 5. T-CMP and memory

Source: `docs/v2/benchmarks.md`, ADR-0009. Sonnet 5.5 low, clean isolation, 10 sessions per arm, arms a to e (50 sessions), 0.25 USD cap per session.

| Measure | Result | Limit |
|---|---|---|
| Correct, every arm | 7/10 | 0.80 |
| `ctx_resume` / `ctx_search` call rate, every arm | 0/10 | 0.70 |
| Bytes returned by those tools | 0 in 50 sessions | - |
| Cost (USD) | a 0.8682, b 0.9114, c 0.9014, d 0.8898, e 0.9514, total 4.5222 | - |
| resume_seq | 50/50 | - |
| Sessions that touched host memory | 0 of 50 | - |

All 15 misses are fixture session-03 (case-sensitive exactMatch). The model never called the tools from the pointer line. Claude Code stays `compactSummary: "none"` (D-M7-CL-1): the full 2,048 B block is injected once after compaction.

Memory live (4 cases, all PASS, model spend 0.0510 USD):

| Case | Result |
|---|---|
| memory-r6-eval-local | PASS. Last-request seq matches ground truth in both fixtures |
| memory-retrieval-local | PASS. R2 recall@5 1.000 (6 of 6), MRR 0.653. Smoke gate, N = 6, not a real recall estimate |
| memory-r6-resume-quality | PASS. 0.0075 USD |
| decision-q3-applied | PASS. 0.0435 USD |

Stored real-data numbers (not re-run, private journals): R2 recall@5 0.743, MRR 0.671 (148 queries). Compaction v2 block names the open error in 11/12 cases.

## 6. Cleanup state

- The report clones and build output of this run are deleted. The CI check clone (`/private/tmp/cm-v2-fu-fp-ci`) was deleted; it had no build output. The final A/B clone and v1 build are deleted.
- v1 code deletion has not started: the plan is `.impl/cleanup-plan.md` (384 rows, 4 waves).

## 7. Owner-only steps

- Merge `v2-design` to `main`.
- Tag the release.
- Switch the marketplace ref.
- `npm deprecate` (needs the OTP).
- Set branch protection on `main`.
- GS2, GS3, GS10 R1/R2 sign-off.
- Interactive agent logins for fixtures that wait for one.
- Decide the home-path scrub in `docs/v2/impl/07-tools-ops.md`, `docs/v2/impl/11-server.md`, `docs/v2/review/*`, `e2e/live/compact/results/*`.

## 8. Numbers still below target

| Number | Value | Target | Measured reason |
|---|---|---|---|
| Saving M2 | 87.23 | 90 | big-json noise (74.51 to 86.6) across 3 runs; json-1 under the 4096-byte trigger in some runs |
| Gate guard | fail | pass | root `MORNING-REPORT.md` tripped `check-removed`; fixed by the move, gate not re-run |
| v2 tokens vs off, SMALL | -5.7 % | positive | about 2.0k fixed prefix cost and extra ctx calls |
| v2 tokens vs off, LARGE | -19.6 % | positive | extra turns from 5 ctx calls on multi-1 and big-json |
| T-CMP correct | 0.70 | 0.80 | 15 misses, all session-03 case-sensitive match |
| T-CMP call rate | 0 | 0.70 | model never calls the tool from the pointer |
