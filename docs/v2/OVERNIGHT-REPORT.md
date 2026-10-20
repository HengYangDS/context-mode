# v2 overnight report

Branch `v2-design`. Report date 2026-10-20. Sources: `.impl/progress.json`, `.impl/BLOCKED-M7.md`, `docs/v2/benchmarks.md`, `docs/v2/prompt/results.md`, `docs/v2/impl/DEVIATIONS.md`, `gh run list`.

## 1. Milestones

| Milestone | Status |
|---|---|
| M0 to M6 | done (`.impl/progress.json`) |
| M7 | blocked, not marked done |

Also in `progress.json` as done: install, docs, measure, docs-bench.

### M7 blocked items (`.impl/BLOCKED-M7.md`)

| # | Item | Numbers | State | Decision needed |
|---|---|---|---|---|
| 1 | GS6 T-GS6, Claude Code hook p95 | 41 ms > limit 40 ms (n=200, same on re-run 2026-10-20). Command hooks pass: wall p95 43 ms, CPU over Node 20 ms. Bare node p95 alone 34 to 50 ms under load | open | Owner re-measures on an idle machine, or approves a next hook step (lazy policy/index import, crypto-free projectKey; about 3 to 10 ms CPU each). No budget was changed |
| 2 | GS6 T-F1, Case B PostToolUse wall p95 | 1 MiB: 166 ms > limit 60 ms. 64 KB: live run 62 ms > 60 ms (bench said 50.5 to 55.0 ms; the live run is the gate, so 64 KB is NOT closed). After D-M7-FT-1/FT-2, bench 1 MiB p95 fell from 150.0-154.7 to 113.8-120.8 ms; allow-path floor for 1 MiB stdin about 56 ms | open | Move the write of more than 65536 bytes to a separate process, or state the budget does not apply to 1 MiB |
| 3 | GS11 T-CMP | Sonnet 5.5 low: correct 7/10, call rate 0/10. Opus 5.5 low: correct 4/10, call rate 0/10. Limits 0.80 correct, 0.70 call rate. 0 bytes returned in 60 sessions. The model never calls `ctx_resume` or `ctx_search` from the pointer line | open | Owner picks a new compaction pointer design, or accepts compactSummary `none` for claude-code and rewrites the GS11 criterion (D-M7-CL-2) |
| 4 | v2-unit "2 failures" | They were skips, not failures: GP3 copilot-cli MCP-firing sub-case (waits for S-NAMES), and the win32-only grandchild check | CLOSED (f71e244b, D-M7-gate-1) | none |
| 5 | Live layer runs 0 cases in `--milestone M7` | 0/31 cases ran in the 3 M7 runs | PARTLY closed (D-M7-gate-2): gate prints SKIP with reason, FAILs if header missing | Owner decides whether `--milestone M7` runs all live cases (`--all` exists) |
| 6 | GS10 R1, R2; GS2, GS3 | none measured | R1, R2 PENDING owner (D-M7-arch-5). GS2, GS3 PENDING release | owner / release |

## 2. Final gate, 2026-10-20

All 3 runs of `node scripts/gate.mjs --all` exited 0 and every layer passed, apart from the live layer, which skipped in all 3 runs.

Setup: fresh clone of v2-design at commit 9a4a2c5c. `npm ci` and the build succeeded; `assert-bundle` printed OK for each bundle in the output seen. Nothing was fixed or pushed in that check. The clone folder and run logs were deleted at the end.

The layer lines were identical in runs 1, 2 and 3:

| Layer | Result |
|---|---|
| keep-pass | PASS, 131/131 files green |
| v2-unit | PASS, `node --test tests/v2/`: pass 1062, fail 0, skip 2, todo 0 of 1064 |
| ci-checks | PASS, exit 0 |
| gp-cases | PASS, build ok; `e2e/cases/run.mjs --milestone M7` exit 0 |
| prompt-lint | PASS, bundle mode, lint: PR1-12, GS5, GS9 OK |
| check-removed | PASS, `build/check-removed.mjs` exit 0 |
| live | SKIP, 0/31 live cases ran |

- **v2-unit skips:** both are expected skips.
  - The GP3 copilot-cli MCP-firing sub-case is skipped until S-NAMES closes.
  - The Windows check (10 runs, 0 grandchildren alive) runs on win32 only; this was a Darwin machine.
- **live skip:** the gate ran in step mode with base 9a4a2c5ca313 and found no case covering the changed files. Its note says to run the cases by hand with `--all` (ADR-0012). Model shown: claude-sonnet-5, effort low. No live case ran, so there are no live-case numbers.

## 3. CI per OS (GitHub Actions, workflow CI, branch v2-design)

Latest run: id 39338020795, push, 2026-10-19T22:53Z, conclusion success. Per job:

| OS | Node 24.15.0 | Node 26 |
|---|---|---|
| ubuntu-latest | success | success |
| macos-latest | success | success |
| windows-latest | success | success |

The two runs just before it (39337964137, 39337926190) also succeeded. Some earlier pushes on 2026-10-19 failed (for example 39337153344, 39336878060, 39335906709, 39335782912); those were bench and doc commits made while the work was in progress. I did not inspect their logs.

## 4. Measured context saving (`docs/v2/benchmarks.md`)

### Offline replay
Measured 2026-10-19, Node v26.8.1. Byte count over real transcripts, not a model run, no answer-quality check. Method: `bench/README.md`, script `bench/replay.mjs`. Corpus: 2986 transcript files, 820 sessions with paired tool calls, 23175 paired calls (dates 2026-05-10 to 2026-10-19). Agent Claude Code (versions 2.1.283, 2.1.198, 2.1.220, 2.1.150, 2.1.149 carry most calls). Models on the calls: claude-opus-5-5, claude-opus-4-8, claude-opus-4-7, claude-opus-5, claude-fable-5, claude-haiku-4-5, claude-sonnet-5 and others.

| Tool | Calls | Saving % | Saving % with re-run bound |
|---|---:|---:|---:|
| Bash | 13894 | -2.9 | -4.3 |
| Read | 1506 | 21.2 | 10.4 |
| WebFetch | 67 | 60.5 | -39.5 |
| Corpus total | 23175 | 1.1 | -1.5 |

599 denies, 861 hints fired, 0 replaces. Before bytes 30798642, after 30454640. "Re-run bound" adds the cost of the model re-running a denied call. Session median saving is -17.0%. Not measured: later-turn effects, hint effect, quality. "Before" already holds some v1 effects.

### Live A/B
Measured 2026-10-19. Claude Code 2.1.303, claude-sonnet-5-5, effort low, budget 0.25 USD per session. 20 tasks, 3 runs per task per arm, 120 sessions. Arm `on` = v2 plugin build, arm `off` = no plugin.

| Measure | Result |
|---|---|
| Saving %, session input (median over tasks) | -6.7 (min -6.9, max +29.7) |
| Saving %, fresh input (median) | -18.6 |
| Success | on 60/60, off 60/60 |
| List-price cost estimate | on $1.4121, off $1.2744 |

The model called a context-mode tool in 15 of 60 `on` sessions. Only 3 JSON tasks show about +29.7%. This run gives no support for a claim that the plugin saves tokens on single-task sessions of this kind. A second reader checked the numbers on 2026-10-20 and changed none.

## 5. Prompt results (`docs/v2/prompt/results.md`)

Date 2026-10-19, Claude Code 2.1.303, built plugin, effort low, 2 runs per task per model, 10 small and 10 large tasks (limits: over and under at most 2 of 20 runs).

| Run | Rule | Models | Under (large) | Over (small) | Verdict |
|---|---|---|---|---|---|
| 1 to 3 (draft, then improved prompt) | old: first tool must be ctx | opus-5-5, sonnet-5, haiku-4-5 | run 3: 8, 9, 3 of 20 | 0 of 20 | FAIL on under |
| 4 | new: native bytes > 2048 counts | opus-5-5, sonnet-5-5, haiku-5-5 | 0, 0, 0 of 20 | 0, 0, 1 of 20 | PASS |

- The rule changed after the first runs (owner decision 2026-10-19, D-M7-RT-1). Under the old rule the same run-4 rows still fail (8, 11, 8 of 20). Read the PASS as "under the new rule".
- Run 4 used different model ids than runs 1 to 3, so it is not a like-for-like comparison.
- Correct large: 20/20 for all three models in run 4; correct small 20/20.
- T4 (forced Read of a large file) was measured in run 3 only: answer reached 18/18, 18/18, 17/18; Read denied 16/18, 16/18, 18/18. PASS.
- Prompt lint: PR1-12, GS5, GS9 OK.
- Routing raw rows are not in the repo.

## 6. DEVIATIONS summary (`docs/v2/impl/DEVIATIONS.md`)

446 rows, dated 2026-10-17 to 2026-10-19. About 20 install-guide rows record where live agent behavior differs from the spec (Codex, Copilot CLI, Gemini, Kiro, Qwen, ZCode, Pi). The rest cover implementation choices from M0 to M7.

Rows that change a decision:

| Row | What changed |
|---|---|
| D-M7-RT-1 | Routing scorer replaced by a deterministic one (owner decision 2026-10-19). Flips the routing verdict from FAIL to PASS |
| D-M6-arch-2 | The check-removed layer starts at M7, not M6, because KEEP-PASS tests still need some paths |
| D-M7-CL-2 | GS11 T-CMP failed; row stays `none` (D-M7-CL-1). Open, see section 1 item 3 |
| D-M7-arch-5 | GS10 R1, R2 and the branch protection are owner steps, listed PENDING, not FAIL. R7 rollback rehearsal runs in `/release` |
| D-M7-gate-1, D-M7-gate-2 | Gate counts skips apart from fails; live layer prints SKIP with reason when 0 cases ran |
| D-M7-FT-1, D-M7-FT-2 | FTS index path changed (contentless table, one chunk pass); BM25 ranking identical |
| D-M1-3 | Constant names and values taken from impl/00, not impl/02 |
| D-M2-arch-4 | CI and gate select tests by owning milestone, so later-milestone files do not keep CI red |

No test was weakened and no owner number was changed.

## 7. Owner-only list

| Item | What the owner must do |
|---|---|
| Hook budget decision (GS6) | Re-measure on an idle machine, or approve a next hook step, or move the >64 KB write out of process, or state the budget does not apply to 1 MiB |
| T-CMP clean re-measure decision (GS11) | Pick a new compaction pointer design, or accept `none` for claude-code and rewrite the criterion (ticket `tickets/v2-tcmp-remeasure`) |
| GS10 R1, R2 | Run and sign off |
| Interactive logins | Log in for agents whose fixtures wait for a login (for example gemini, qwen, copilot-cli, kiro, zcode, pi, opencode, vscode; D-M0 fixture row) |
| npm deprecate | Needs the owner OTP. Not run |
| Marketplace ref switch | Owner switches the marketplace ref |
| Branch protection on `main` | Owner sets it |
| Merge to main | Owner decision. Not done |
| Release tag | Owner decision. Not done |
| Live layer in M7 | Decide whether `--milestone M7` runs all live cases; run `--all` by hand |
| Scrub of home paths | Method check found a home path in `docs/v2/impl/07-tools-ops.md`, `docs/v2/impl/11-server.md`, `docs/v2/review/*`, `e2e/live/compact/results/*` (the last with a masked user name). Owner decides |
