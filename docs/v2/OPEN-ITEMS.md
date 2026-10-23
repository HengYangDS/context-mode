# Open items in v2

Date: 2026-10-23. Branch: v2-design. Counts and the per-issue table: `docs/v2/ISSUE-COVERAGE.md`.

## What I ran

On this commit (macOS, clean clone, `node build/build.mjs --out release-out`):

- `node e2e/cases/run.mjs`: GP1 to GP11 and the 2 extra cases, 185 pass, 0 fail. Without `release-out` built first, 40+ cases fail with "bundle exited"; build first.
- `node --test tests/v2/`: 1368 tests, 1366 pass, 0 fail, 2 skipped (GP3 copilot-cli MCP sub-case, one win32-only grandchild check).
- `node --test tests/v2/compaction tests/v2/store tests/v2/ops tests/v2/lifecycle`: 304 pass, 0 fail.
- `node build/check-removed.mjs`: clean.
- Not run: live cases (need a real agent and model key). Their numbers come from the cited docs, not from me.

## The owner's list, checked

| Area | Verdict | Evidence |
|---|---|---|
| DB (node:sqlite, locking, WAL, concurrency) | Done in tests | `src/core/store/db.ts` uses `node:sqlite` with `timeout` 5000 and WAL; `e2e/cases/GP8-concurrency.e2e.mjs` (7 pass): four writers on one DB, 0 busy errors, `integrity_check` ok; DB-gone gives `DB_GONE`; sibling DBs opened read-only (#1213). Loss: #1056 (no checkpoint or mmap check) has no test. Windows grandchild check ran on no machine here (win32 only). |
| Stats issues | Done in tests | `e2e/cases/GP10-stats.e2e.mjs` (7 pass): net-byte denominator, binary reads zero, caller-session credit, totals consistent. The heartbeat case (#1248) is in GP8 and passes. |
| Memory | Done, thin on real data | Unit tests in `tests/v2/store`, `tests/v2/compaction`; live cases 4/4 PASS (`docs/v2/benchmarks.md` "Memory"). The fixture score (recall@5 1.000, 6 queries) is a smoke gate. The stored real-data run is recall@5 0.743, MRR 0.671 (148 queries), not re-run. |
| Compaction | Partly | Correctness 10/10 per arm after re-score (`docs/v2/review/MORNING-REPORT.md`). The model never calls `ctx_resume` or `ctx_search` from the pointer (0/10). The call-rate gate was retired (`docs/v2/review/DECISIONS-r11.md` section C), so the number is not met, it is dropped. Compaction GP cases pass offline. The live probe of the pointer design is not repeated since. |
| Saving | Not at target | M1 94.21 met; M2 87.23 (median of 3) or 88.02 on a later commit, target 90. Session tokens: see item 4 below. |

## Open items

| # | Item | Status | Evidence | Owner or next step |
|---|---|---|---|---|
| 1 | Claude Code hook p95 41 ms against 40 ms (GS6) | open, FAIL | `docs/v2/TECH-SPEC.md` section 1.1; `docs/v2/review/OVERNIGHT-REPORT-2026-10-19.md` item 1 | Owner re-measures on an idle machine, or approves a lazy-import step. No budget was changed. |
| 2 | 64 KB PostToolUse p95 62 ms against 60 ms (T-F1 Case B); 1 MiB 114 to 166 ms | open, FAIL | same files, item 2 | Move large writes to a second process, or state the budget does not apply to 1 MiB. |
| 3 | Saving M2 below 90 | open | `docs/v2/benchmarks.md` "Saving loop"; `docs/v2/LAUNCH.md` "Claims we do not make" | Owner decides: accept, or tune big-json and multi-1. |
| 4 | Session tokens against direct use on short tasks | open (a loss) | `docs/v2/LAUNCH.md`: small tasks v2 +10.2 % tokens vs v1; fixed prompt cost about 2.0k tokens; multi-1 +29 %, big-json +74 % vs no plugin. `docs/v2/review/MORNING-REPORT.md` says v2 is lower than off in the last A/B. The two docs disagree on the sign for small tasks (the LAUNCH table says -5.7 % but its text says 5.7 % more). | Re-state one number from `bench/live/results/ab-final2.json` before publishing. n=3 per cell. |
| 5 | Compaction pointer is never used by the model | open, accepted by gate change | `docs/v2/benchmarks.md` "Compaction pointer"; DECISIONS-r11 C | Owner confirms the design is final, or picks a new pointer. |
| 6 | ADR-0006 live probe (`alwaysLoad`) | open | `docs/v2/adr/0006-claude-code-tool-loading.md`: one run per cell, Sonnet under-routing 3/3 with the flag on; the ADR says the re-probe must run before release sign-off | Run the live harness before release (ADR-0012). |
| 7 | Copilot CLI MCP `instructions` field reaching the model, and tool-name prefix (S-NAMES) | open | `docs/v2/LAUNCH.md`; DEVIATIONS (copilot-cli prefix unverified); GP3 copilot-cli sub-case skipped | Live probe on a v2 build. |
| 8 | No install command has passed a live test | open | `docs/v2/LAUNCH.md` ("every row says see guide"). Partial passes exist in `docs/install/*.md` tables (for example OpenCode 1.19.3 `mcp list`, Gemini 0.65.0 link). | Run each guide on a clean host. |
| 9 | npm trusted publisher, `npm-publish` environment, "latest" move | owner | `docs/v2/NPM-OWNER-STEPS.md` steps 1 to 5 | Owner only; CI holds no token. |
| 10 | `release.yml` not on `main`; old `release` and `release-staging` branches on GitHub; GS10 R1, R2 branch protection | owner | `docs/v2/LAUNCH.md` "Before the first real release"; `docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md` | Land the workflow with the v2 merge; delete the rehearsal branches. |
| 11 | Hook timing on macOS and Windows is not a gate | open | Budgets measured on one Mac (TECH-SPEC section 1.1). CI runs all three OS and passes (`OVERNIGHT-REPORT-2026-10-19.md` section 3), but the timing check is one local run; a Windows engine test already failed once on a 17 ms overhead (DEVIATIONS D-CI-WIN-5). I found no per-OS timing gate. | Add a per-OS timing run, or document the budget as macOS only. |
| 12 | OpenCode verifier environment | unconfirmed | Not found in the repo. `docs/install/opencode.md` shows one pass (1.19.3 `mcp list`, path expansion); plugin and hook paths have no live row. | Owner names the failure; then add a live row. |
| 13 | Kiro hook output | resolved (by design) | The SessionStart hook prints the resume line once per `session_id`; a repeat id or a payload with no `session_id` gives empty stdout, exit 0. Test `tests/v2/hooks/hook-entry.test.mjs` (3 kiro SessionStart cases), e2e `GP3/kiro-sessionstart-prints-once`, fixture `e2e/fixtures/kiro/cli-v3-docs-2026-10-23/SessionStart.json` (D-FU-OI-KIRO-1). Kiro itself not run: no kiro-cli login here. | None. Run a logged-in kiro-cli once to see Kiro load the line. |
| 14 | Gemini gives no resume hint at session start | fixed | D-FU-GCH-2: the hint comes on the first `BeforeAgent` of a session, once, only when the worktree has Gemini journal rows; e2e `GP6/gemini-resume-hint-first-turn-only` | None. |
| 15 | 27 map rows with no decision (adapters, tool set, scope) | not resolved | `docs/v2/ISSUE-COVERAGE.md`, "not resolved" | Owner triage. |
| 16 | 110 map rows are "removed code path" with no per-row test | resolved-untested | `docs/v2/ISSUE-COVERAGE.md`; only `check-removed` covers them as a group | Accept, or add a check per decision (D2, D3, D8, D9, D11). |
| 17 | Gate live layer runs 0 of 31 cases in `--milestone M7`; release smoke uses one model | open | `OVERNIGHT-REPORT-2026-10-19.md` item 5; `docs/v2/review/TEST-TRIAGE-r2.md` | Run `node e2e/live/run.mjs --all` before release. |
| 18 | GitHub issues are off, so the 356 open items cannot be listed or closed from v2 | owner | `gh api repos/mksglu/context-mode` shows `has_issues` false, `open_issues_count` 356 | Turn issues on at release so v1 reporters can see the outcome. |
| 19 | #1056 DB checkpoint and mmap, 5 more "partly" rows | partly | `docs/v2/ISSUE-COVERAGE.md` | Add a GP8 case for #1056. |
| 20 | #1280 turndown bundling: no commit found by archaeology | unverified | `docs/v2/review/ISSUE-OUTCOMES-r4.md` row 1280 | Check the bundle contains turndown. |

## Method limits

- Test evidence is a name match between the map and test files. I did not read each assertion.
- Doc numbers were not re-measured. Where two docs disagree (item 4), both are named.
