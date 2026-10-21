# v1 cleanup plan

Branch `v2-design`, 2026-10-21. Goal: the tree holds only v2 (ADR-0015 target tree, impl/00 §1, TECH-SPEC §3.10, GS5).

## Method

- Tree: `git ls-files`. v2 tree = `src/{core,prompt,entries}`, the 11 adapter files in impl/00 §1, `tests/v2`, `e2e`, `build`, `bench`, `docs/v2`, `scripts/{gate,gen-keep-pass,ci-gs4-lint,record-fixtures}.mjs`, `scripts/release`.
- Import graph: every relative `import`/`require` resolved (`build/x.js` -> `src/x.ts`). v2 code importing a v1 src file: none. tests/v2 imports exactly one v1 file: `src/adapters/client-map.ts`.
- KEEP-PASS closure: from the 131 files in `tests/keep-pass.list.json`, 80 of 86 v1 src files and 15 `hooks/` files are reachable. They can only go after the KEEP-PASS list shrinks (owner rule: keep unit tests until v2 passes them; 131/131 green today).
- Test classes: TEST-TRIAGE-r2 (`docs/v2/review/out/r2/round1/review/tests-{1,2}.json`) plus a file-name rule table, each row names its ADR or the covering tests/v2 / e2e case.
- Git archaeology: per src row, commit count and fix/issue commits (`git log --follow`). Each DELETE task reads `git log -S` for the fix commits before deleting, and copies any issue number with no v2 case into a PORT row.
- Every task adds a DEVIATIONS.md row for each behaviour change.

The task said "36 v1 files in src". The count with subfolders is 86 (src/adapters/<agent>/*, src/session/*, src/util/*, ...).

## Summary

| Area | MOVE | DELETE | KEEP | RETIRE | COVERED | PORT |
|---|---|---|---|---|---|---|
| v1 src (86) | 1 | 85 | 0 | | | |
| v1 test files (210) | | | | 81 | 81 | 64 |
| v1 test support (44) | | 44 | | | | |

KEEP-PASS (131): RETIRE 42, COVERED 75, PORT 14.

## Waves

Four waves, not three: 80 v1 src files and 15 hooks/ files are reachable only through KEEP-PASS tests, so they go after the KEEP-PASS list is cut (W2), and the check-removed allow-list must see the final tree.

| Wave | Task | Owns |
|---|---|---|
| 0 | W0-client-map | MOVE `src/adapters/client-map.ts` -> `src/core/contracts/client-map.ts` (drop the `./types.js` import, local string type), update `tests/v2/adapters/client-map.test.mjs`; v1 `src/adapters/detect.ts` keeps its own copy until W3 |
| 0 | W0-docs-refs | MOVE PRD-v2.md, OVERNIGHT-REPORT.md to docs/v2; fix refs in src/core/contracts/agents.ts, src/core/project/resolve.ts, e2e/live/cases/spikes-applied.json; e2e/live/cases/savings-on-off.json `covers`: src/session/analytics.ts -> src/core/tools/stats.ts |
| 1 | W1-<area> (7) | per area below: write PORT cases (new files only, `tests/v2/<module>/<name>-ported.test.mjs` or a new GP case in that area's e2e file), delete non-KEEP-PASS RETIRE/COVERED files. KEEP-PASS files stay. W1-adapters also deletes the 6 v1 src files no KEEP-PASS test reaches. |
| 2 | W2-keep-pass | delete KEEP-PASS RETIRE/COVERED files and PORT files whose port landed; tests/ support files; keep-pass.list.json, tests/vitest.config.ts, root vitest.config.ts, scripts/gen-keep-pass.mjs, .impl/keep-pass-{map,baseline,baseline-detail}.json, scripts/gate.mjs keep-pass layer, ci.yml keep-pass + tsc steps, e2e/checks/keep-pass-count.mjs |
| 2 | W2-root | configs/, bin/, cli.bundle.mjs, server.bundle.mjs, skills/.ignore, v1 scripts, docs/platform-support.md, package.json |
| 3 | W3-v1-src-hooks | the 80 KEEP-PASS-reached v1 src files, hooks/, scripts/heal-*.mjs, tsconfig.json |
| 3 | W3-check-removed | build/check-removed.mjs: allow-list of the target tree, fail on any tracked path outside it; tests/v2/repo/check-removed.test.mjs |

## 1. v1 src files

| Path | KEEP-PASS reach | Class | Task | History | Reason |
|---|---|---|---|---|---|
| `src/adapters/antigravity-cli/index.ts` | yes | DELETE | W2-src-v1 | 2 commits, 2 fix/issue; last: 2608e344 refactor(antigravity-cli): one-command agy plugin install (dr | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/antigravity/index.ts` | yes | DELETE | W2-src-v1 | 10 commits, 6 fix/issue; last: 9f34c6f1 Add GitHub Copilot CLI + Antigravity CLI (agy) support (#787) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/base.ts` | yes | DELETE | W2-src-v1 | 8 commits, 6 fix/issue; last: afd109b7 fix(auto-memory): scope memory dir by projectDir to stop cros | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/claude-code-base.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: 2a9ae3a9 feat(qwen-code): improve adapter — configureAllHooks, getInst | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/claude-code/config.ts` |  | DELETE | W1-src-free | 2 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/claude-code/hooks.ts` | yes | DELETE | W2-src-v1 | 14 commits, 10 fix/issue; last: 9f63a0b2 fix(hooks): capture Stop turn ends (#773) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/claude-code/index.ts` | yes | DELETE | W2-src-v1 | 26 commits, 16 fix/issue; last: 7cc9d3be fix(upgrade): skip settings.json wiring only for true plugin  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/client-map.ts` | yes | MOVE | W0-client-map | 10 commits, 6 fix/issue; last: 50b1c9a6 impl(M7-G1): map clientInfo.name opencode to adapter opencode | tests/v2/adapters/client-map.test.mjs imports it; only link to v1 is `import type { PlatformId } from "./types.js"`: replace with a local string type |
| `src/adapters/codex/config.ts` |  | DELETE | W1-src-free | 1 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/codex/hooks.ts` | yes | DELETE | W2-src-v1 | 7 commits, 6 fix/issue; last: ff5b0cff fix(codex): MCP sentinel namespace + PreToolUse rewrites + to | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/codex/index.ts` | yes | DELETE | W2-src-v1 | 33 commits, 25 fix/issue; last: 98d239b7 fix(codex): resolve plugin-manager root for doctor and upgrad | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/codex/paths.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 043a1f52 [codex] add compact hook support (#492) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/codex/usage.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: aa17aa83 feat(cost): per-turn token+cost capture for 3 file-tail adapt | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/copilot-base.ts` | yes | DELETE | W2-src-v1 | 3 commits, 2 fix/issue; last: 0ff24134 fix(copilot-base): anchor getSettingsPath on projectDir for C | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/copilot-cli/hooks.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 9f34c6f1 Add GitHub Copilot CLI + Antigravity CLI (agy) support (#787) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/copilot-cli/index.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 9f34c6f1 Add GitHub Copilot CLI + Antigravity CLI (agy) support (#787) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/cursor/hooks.ts` | yes | DELETE | W2-src-v1 | 6 commits, 5 fix/issue; last: 7dc26dd4 feat(cursor): route external MCP tools through PreToolUse (cl | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/cursor/index.ts` | yes | DELETE | W2-src-v1 | 12 commits, 9 fix/issue; last: 8d731d34 test(cursor): pin detectPluginInstalls + plugin-aware checkPl | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/detect.ts` | yes | DELETE | W2-src-v1 | 34 commits, 27 fix/issue; last: 73cf07e0 docs/tests: update adapter count 15→17 (copilot-cli + antigra | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/gemini-cli/config.ts` |  | DELETE | W1-src-free | 1 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/gemini-cli/hooks.ts` | yes | DELETE | W2-src-v1 | 11 commits, 6 fix/issue; last: cc675f06 feat(cost): per-turn token+cost capture for 5 in-band adapter | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/gemini-cli/index.ts` | yes | DELETE | W2-src-v1 | 15 commits, 9 fix/issue; last: f37e95b8 feat(cost): finish install-wire for gemini-cli, openclaw, qwe | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/jetbrains-copilot/hooks.ts` | yes | DELETE | W2-src-v1 | 8 commits, 4 fix/issue; last: 6cb1490c fix(family-A): persistence-tier rules — drop stale .mcp.json  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/jetbrains-copilot/index.ts` | yes | DELETE | W2-src-v1 | 12 commits, 6 fix/issue; last: 734bdbc2 v1.0.104 (#401) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/kimi/index.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 1b4f2be8 feat(adapter): add Kimi Code CLI hook integration (#729) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/kimi/paths.ts` | yes | DELETE | W2-src-v1 | 3 commits, 2 fix/issue; last: aa17aa83 feat(cost): per-turn token+cost capture for 3 file-tail adapt | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/kimi/usage.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: aa17aa83 feat(cost): per-turn token+cost capture for 3 file-tail adapt | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/kiro/hooks.ts` | yes | DELETE | W2-src-v1 | 6 commits, 4 fix/issue; last: a9dc376e feat(adapters): route hook spawn commands through buildHookRu | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/kiro/index.ts` | yes | DELETE | W2-src-v1 | 11 commits, 6 fix/issue; last: ff0a9a26 fix(14-adapter parity): v1.0.107 — Mickey ROUTING_BLOCK + 30+ | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/omp/index.ts` | yes | DELETE | W2-src-v1 | 11 commits, 7 fix/issue; last: 755697c7 fix(omp): correct env var, MCP filename, and instruction file | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/omp/usage.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: cc675f06 feat(cost): per-turn token+cost capture for 5 in-band adapter | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/openclaw/hooks.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: 24cbf506 Review fixes: add lifecycle hooks to constants, remove intern | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/openclaw/index.ts` | yes | DELETE | W2-src-v1 | 14 commits, 8 fix/issue; last: afd109b7 fix(auto-memory): scope memory dir by projectDir to stop cros | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/openclaw/usage.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: cc675f06 feat(cost): per-turn token+cost capture for 5 in-band adapter | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/opencode/config.ts` |  | DELETE | W1-src-free | 1 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/opencode/hooks.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/opencode/index.ts` | yes | DELETE | W2-src-v1 | 23 commits, 18 fix/issue; last: 59e6df8d fix(opencode): write into existing opencode.jsonc instead of  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/opencode/plugin.ts` |  | DELETE | W1-src-free | 35 commits, 29 fix/issue; last: 23b01b30 impl(M7-N2): drop retired tool names from opencode plugin and | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/opencode/zod3tov4.ts` | yes | DELETE | W2-src-v1 | 3 commits, 3 fix/issue; last: 56e9e9a7 fix: preserve ZodEffects preprocess and ZodType coerce in zod | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/pi/extension.ts` | yes | DELETE | W2-src-v1 | 28 commits, 26 fix/issue; last: cc675f06 feat(cost): per-turn token+cost capture for 5 in-band adapter | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/pi/index.ts` | yes | DELETE | W2-src-v1 | 12 commits, 7 fix/issue; last: 56bbf870 feat(adapters/pi): add PiAdapter class for HookAdapter contra | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/pi/mcp-bridge.ts` | yes | DELETE | W2-src-v1 | 15 commits, 15 fix/issue; last: bebc7529 fix(pi): keep the foreground MCP bridge alive + route diagnos | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/qwen-code/hooks.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 74245655 feat(qwen-code): route external MCP tools through PreToolUse  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/qwen-code/index.ts` | yes | DELETE | W2-src-v1 | 14 commits, 9 fix/issue; last: f37e95b8 feat(cost): finish install-wire for gemini-cli, openclaw, qwe | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/qwen-code/usage.ts` | yes | DELETE | W2-src-v1 | 2 commits, 0 fix/issue; last: f37e95b8 feat(cost): finish install-wire for gemini-cli, openclaw, qwe | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/types.ts` | yes | DELETE | W2-src-v1 | 28 commits, 15 fix/issue; last: 9f34c6f1 Add GitHub Copilot CLI + Antigravity CLI (agy) support (#787) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check); client-map.ts type import removed in W0 |
| `src/adapters/vscode-copilot/config.ts` |  | DELETE | W1-src-free | 1 commits, 0 fix/issue; last: 75ae6ae3 feat: multi-platform adapters, session continuity, hook scrip | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/vscode-copilot/hooks.ts` | yes | DELETE | W2-src-v1 | 8 commits, 4 fix/issue; last: 6cb1490c fix(family-A): persistence-tier rules — drop stale .mcp.json  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/vscode-copilot/index.ts` | yes | DELETE | W2-src-v1 | 13 commits, 7 fix/issue; last: 3d3e4248 fix(vscode-copilot): VSCODE_CWD cascade + docs(ops): fan-out  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/adapters/zed/index.ts` | yes | DELETE | W2-src-v1 | 9 commits, 4 fix/issue; last: 734bdbc2 v1.0.104 (#401) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/cli.ts` | yes | DELETE | W2-src-v1 | 112 commits, 97 fix/issue; last: 9f34c6f1 Add GitHub Copilot CLI + Antigravity CLI (agy) support (#787) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/db-base.ts` | yes | DELETE | W2-src-v1 | 25 commits, 21 fix/issue; last: 7afa0f45 fix(db-base): propagate busy_timeout on node:sqlite branch (c | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/executor.ts` | yes | DELETE | W2-src-v1 | 55 commits, 46 fix/issue; last: 89f4e736 fix(sandbox): suppress MinGW path-conv for Windows ctx_execut | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/exit-classify.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: ab5aad90 fix: soft-fail shell exit code 1 when stdout has content | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/fetch-cache.ts` | yes | DELETE | W2-src-v1 | 2 commits, 2 fix/issue; last: 734bdbc2 v1.0.104 (#401) | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/lifecycle.ts` | yes | DELETE | W2-src-v1 | 13 commits, 13 fix/issue; last: bebc7529 fix(pi): keep the foreground MCP bridge alive + route diagnos | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/runPool.ts` | yes | DELETE | W2-src-v1 | 3 commits, 2 fix/issue; last: c8054108 fix(pi): bridge MCP tools into pi.registerTool() so the LLM c | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/runtime.ts` | yes | DELETE | W2-src-v1 | 31 commits, 26 fix/issue; last: b1cca82d fix(runtime): liveness-guard pinned hook execPath so mise/asd | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/search/auto-memory.ts` | yes | DELETE | W2-src-v1 | 6 commits, 5 fix/issue; last: afd109b7 fix(auto-memory): scope memory dir by projectDir to stop cros | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/search/ctx-search-schema.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 19a75902 feat(ctx_search): add `project:` filter for shared-DB mode (# | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/search/flood-guard.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 3a45eb1c fix(search): correct project-filter strictness (#827) + per-a | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/search/unified.ts` | yes | DELETE | W2-src-v1 | 4 commits, 3 fix/issue; last: ba571f72 feat(search): plumb per-project session-id allow-set through  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/security.ts` | yes | DELETE | W2-src-v1 | 10 commits, 7 fix/issue; last: d1ae5625 fix(security): confine ctx_execute_file to the project bounda | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/server.ts` | yes | DELETE | W2-src-v1 | 256 commits, 179 fix/issue; last: 320ed3e5 fix(forward): bridge ctx_search/ctx_fetch retrieval bytes to  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/analytics.ts` | yes | DELETE | W2-src-v1 | 58 commits, 37 fix/issue; last: 49fa9d2d fix(stats): one-decimal kept-out ratio so a 99.9% window neve | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/db.ts` | yes | DELETE | W2-src-v1 | 36 commits, 25 fix/issue; last: 4f22887f feat(cost): live Stop-hook capture of claude-code main-turn c | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/error-classifier.ts` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: 1d7affa3 feat(hooks): classifiers for error/command/duration metadata | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/event-emit.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: 6ac89b8b fix(stats/D2): drop invalid source_hook from SessionEvent lit | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/extract.ts` | yes | DELETE | W2-src-v1 | 59 commits, 38 fix/issue; last: 524864a9 fix(cost): stop pricing cumulative Task usage as a single tur | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/model-prices.json` | yes | DELETE | W2-src-v1 | 1 commits, 0 fix/issue; last: aaf7916f refactor(pricing): single catalog under src/session; structur | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/persist-tool-calls.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 505fb01c fix(stats): restore session-counter persistence + add bars to | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/pricing.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: aaf7916f refactor(pricing): single catalog under src/session; structur | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/project-attribution.ts` | yes | DELETE | W2-src-v1 | 4 commits, 3 fix/issue; last: 2e7a543a fix(attribution): Bug 8 — `git -C <dir>` scope hint flows to  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/purge.ts` | yes | DELETE | W2-src-v1 | 5 commits, 4 fix/issue; last: 548036a2 feat(purge): per-session FTS5 chunk wipe via session_id colum | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/retrieval-marker.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 320ed3e5 fix(forward): bridge ctx_search/ctx_fetch retrieval bytes to  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/session/snapshot.ts` | yes | DELETE | W2-src-v1 | 12 commits, 7 fix/issue; last: 9e2e6237 feat(session): persist /goal directives across compaction and | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/store-directory.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: f7499570 feat(ctx_index): support directory paths with bounded travers | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/store.ts` | yes | DELETE | W2-src-v1 | 53 commits, 36 fix/issue; last: 6f699fac fix(store): enforce MAX_CHUNK_BYTES in #chunkPlainText to pre | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/truncate.ts` | yes | DELETE | W2-src-v1 | 6 commits, 2 fix/issue; last: 9c5c8f72 fix(server): surrogate-safe preview truncation in ctx_fetch_a | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/types.ts` | yes | DELETE | W2-src-v1 | 7 commits, 2 fix/issue; last: ba571f72 feat(search): plumb per-project session-id allow-set through  | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check); client-map.ts type import removed in W0 |
| `src/util/claude-config.ts` | yes | DELETE | W2-src-v1 | 4 commits, 4 fix/issue; last: 0d5ee745 fix(claude-config): static-import detect to fix Node 22.5 req | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/util/hook-config.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: f9b8ea87 feat(adapters/types): parseNodeCommand as strict inverse of b | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/util/jsonc.ts` | yes | DELETE | W2-src-v1 | 1 commits, 1 fix/issue; last: 8ca114c4 fix(opencode): string-aware JSONC stripping via shared util/j | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/util/plugin-cache-integrity.ts` | yes | DELETE | W2-src-v1 | 2 commits, 1 fix/issue; last: a01c8531 fix(doctor): surface missing launch files when integrity help | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/util/project-dir.ts` | yes | DELETE | W2-src-v1 | 8 commits, 8 fix/issue; last: e939b9a5 fix(codex): guard plugin install paths from Codex Desktop tra | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |
| `src/util/sibling-mcp.ts` | yes | DELETE | W2-src-v1 | 3 commits, 3 fix/issue; last: a888cac6 revert: lifecycle idle-shutdown (#568 + #595) — restore tools | v1 only: no import from src/core, src/entries, src/prompt, build/, e2e/, bench/ or the 11 v2 adapter files (import-graph check) |

## 2. Root and non-src items

| Path | Class | Task | Reason |
|---|---|---|---|
| `hooks/` (all files) | DELETE | W3-v1-src-hooks | v1 hook scripts and bundles. v2 hooks are `src/core/hooks` + generated `release-out/hooks/*.json` (build/manifests.ts). 15 files are imported by KEEP-PASS tests (session-directive, session-helpers, session-loaders, core/*, formatters/*, platform-bridge, routing-block, normalize-hooks, antigravity-cli/payload), so they go after W2. `hooks/` strings in e2e/cases name `release-out/hooks`; the task checks each hit. |
| `configs/` (antigravity, antigravity-cli, codex, copilot-cli, kiro) | DELETE | W2-root | v1 template configs. antigravity*: TECH-SPEC §3.10. codex/copilot-cli/kiro: v2 writes host config from `src/core/ops/host-write.ts`. Refs: package.json `files`/version-sync (v1), constants.ts:520 comment (keep text, it names the v1 path), v1-migration-setup.mjs comment. |
| `bin/statusline.mjs` | DELETE | W2-root | statusline removed (ADR-0015 README "Upgrading" row; tests/v2/repo/readme-upgrading asserts "Removed"). `bin/` hits in build/bench/e2e are `node_modules/.bin` or `/bin/sh`; the task checks each. |
| `cli.bundle.mjs`, `server.bundle.mjs` | DELETE | W2-root | v1 npm bundles. v2 bundles are built into `release-out/` by build/build.mjs (ADR-0011, ADR-0013). `server.bundle.mjs` in tests/v2/ops/plugin-swap and e2e/checks/v1-migration is a fixture file name, not this file. |
| `vitest.config.ts` (root) | DELETE | W2-keep-pass | v1 `npm test` config. KEEP-PASS uses tests/vitest.config.ts. ci.yml, gate.mjs, keep-pass-count.mjs, check-removed.test name it. |
| `tsconfig.json` | KEEP, edit | W3-v1-src-hooks | gate keep-pass layer and ci.yml run `tsc -p tsconfig.json` to emit build/*.js for KEEP-PASS (D-M3-F-1). After W3: `include` the v2 tree, `noEmit` (typecheck only). |
| `PRD-v2.md` | MOVE -> `docs/v2/PRD-v2.md` | W0-docs-refs | v2 source document. Refs: src/core/contracts/agents.ts:1, src/core/project/resolve.ts:1, e2e/live/cases/spikes-applied.json. TECH-SPEC/ADR/impl cite "PRD" 112 times by section, not by path. |
| `OVERNIGHT-REPORT.md` | MOVE -> `docs/v2/OVERNIGHT-REPORT.md` | W0-docs-refs | v2 status report (2026-10-20), no refs. |
| `package.json` | KEEP, edit | W2-root | dev deps and v2 scripts (gate, e2e). Remove v1 scripts (dev, setup, doctor, pretest, test, benchmark, test:*, postinstall, version-sync, assert-*), v1 `files`, `bin`. Release tree has no package.json (ADR-0011); main keeps its own. |
| `README.md`, `CONTRIBUTING.md`, `LICENSE`, `.gitattributes`, `.gitignore` | KEEP | - | v2 README (ADR-0015, check-readme.mjs). |
| `skills/ctx-stats`, `skills/ctx-doctor`, `skills/ctx-upgrade` | KEEP | - | build/build.mjs COMMAND_SKILLS; GS5 allows these 3. |
| `skills/.ignore` | DELETE (check first) | W2-root | v1 Pi skill-loader marker; build/build.mjs copies only SKILL.md, so it never reaches `release`. Task runs `git log -S .ignore -- skills` and GP1-release-tree first. |
| `metrics/live-skip-streak.json`, `metrics/traffic.json` | KEEP | - | .claude/skills/release reads live-skip-streak (tests/v2/repo/release-skill); traffic.yml writes traffic.json (ADR-0013). |
| `.claude/settings.json`, `.claude/skills/release/SKILL.md` | KEEP | - | ADR-0013 `/release`; GS5 allows `.claude/skills/release`. |
| `.claude-plugin/marketplace.json` | KEEP | - | ADR-0011 step b: on `main` the owner edits only `plugins[0]` to `ref: "release"`. v1 users on main install from this file until then. The v2 `release` copy is generated by build/manifests.ts. |
| `.claude-plugin/plugin.json`, `.codex-plugin/{plugin,hooks,mcp}.json` | KEEP (unsure) | - | v1 install surface on main (version 1.0.169). ADR-0011: main stays frozen v1; v2 ships these from `release`. If v2-design ever merges into main they must still work for v1 users, and `.codex-plugin/mcp.json` already points at `./start.mjs`, which v2-design deleted (REMOVED_PATHS). Owner decision: do not merge v2-design into main before the ADR-0011 ref switch. |
| `.agents/plugins/marketplace.json` | KEEP (unsure) | - | v1 Codex marketplace layout (`url: ./`). ADR-0011: v2 Codex install is a config.toml rewrite. Same merge risk as above. |
| `.github/**` | KEEP | W2-keep-pass edits ci.yml | ADR-0013 workflows, issue forms (tests/v2/repo/issue-forms, workflows). |
| `.impl/**` | KEEP | W2-keep-pass edits keep-pass-*.json | implementation records; progress.json is not touched. |
| `bench/**` | KEEP | - | GS6 and saving-score sources for docs/v2/benchmarks.md. No bench file imports v1 src (checked: only comments name src/core). |
| `tickets/**` | KEEP | - | scripts/ci-gs4-lint.mjs reads tickets/v2-test-ledger.md; TECH-SPEC and DECISIONS cite tickets/*. |
| `e2e/**`, `build/**`, `docs/v2/**` | KEEP | - | v2 tree. |
| `docs/benchmarks/**` | KEEP | - | Owner's benchmark publish pack (ADR-0015, D-FU-RF-BENCH-1). |
| `docs/install/*`, `docs/how-it-works.md`, `docs/tools.md`, `docs/algorithms.md`, `docs/performance.md` | KEEP | - | v2 user docs (ADR-0015, GP1-install-docs). |
| `docs/UPSTREAM-CREDITS.md` | KEEP | - | license credits. |
| `docs/platform-support.md` | DELETE | W2-root | its own header says "v1 document ... not valid for v2". Fix any link to it. |
| `scripts/gate.mjs`, `gen-keep-pass.mjs`, `ci-gs4-lint.mjs`, `record-fixtures.mjs`, `scripts/release/**` | KEEP | W2-keep-pass edits gate/gen-keep-pass | ADR-0003 gate, ADR-0013 release, GP3 fixtures. |
| `scripts/assert-asymmetric-drift.mjs`, `assert-bundle.mjs`, `ctx-debug.sh`, `plugin-cache-integrity.mjs`, `postinstall.mjs`, `prove-narrative-render.ts`, `version-sync.mjs`, `tier2-smoke/**` | DELETE | W2-root | v1 npm/bundle/self-heal tooling (ADR-0011: no npm, no postinstall). prove-narrative-render imports src/session/analytics (v1). |
| `scripts/heal-better-sqlite3.mjs`, `scripts/heal-installed-plugins.mjs` | DELETE | W3-v1-src-hooks | v1 self-heal; KEEP-PASS tests import them, so after W2. |

## 3. v1 test files

| Path | KEEP-PASS | Triage | Class | Cite / covering case | Task |
|---|---|---|---|---|---|
| `tests/adapters/antigravity.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/base-adapter-memory.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/index/auto-memory.test.mjs + GP5/non-ascii-auto-memory-match | W1-adapters |
| `tests/adapters/claude-code-memory.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/index/auto-memory.test.mjs + GP5/non-ascii-auto-memory-match | W1-adapters |
| `tests/adapters/claude-code.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/client-map.test.ts` |  | PORT | COVERED | tests/v2/adapters/client-map.test.mjs + e2e GP1/opencode-clientinfo-detect | W1-adapters |
| `tests/adapters/codex-external-mcp-routing.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/policy/external-mcp-ported.test.mjs (#529; v2 matcher has no mcp__ catch-all, decide allows with no hint, ADR-0008 table, D-M7-RR-2) | W1-adapters |
| `tests/adapters/codex-usage.test.ts` | yes | KEEP-PASS | RETIRE | RETIRE (reclassified W1-adapters): per-turn file-tail usage capture and pricing removed, ADR-0015 L48; v2 usage rows are tests/v2/hooks/usage.test.mjs (opencode step-finish). KEEP-PASS file, W2 deletes | W1-adapters |
| `tests/adapters/codex.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/copilot-base-cwd-consistency.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/copilot-cli.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/cursor-claude-compat-config-dir.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/cursor-external-mcp-routing.test.ts` |  | PORT | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/cursor.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/detect-ambiguity-matrix.test.ts` |  | PORT | RETIRE | TECH-SPEC §5 step 1 (agent comes from --agent; src/entries/server.ts reads no clientInfo); GP1/opencode-clientinfo-detect proves #1276 | W1-adapters |
| `tests/adapters/detect-claude-code-in-vscode.test.ts` |  | PORT | RETIRE | TECH-SPEC §5 step 1 (agent comes from --agent; src/entries/server.ts reads no clientInfo); GP1/opencode-clientinfo-detect proves #1276 | W1-adapters |
| `tests/adapters/detect-config-dir.test.ts` |  | PORT | RETIRE | TECH-SPEC §5 step 1 (agent comes from --agent; src/entries/server.ts reads no clientInfo); GP1/opencode-clientinfo-detect proves #1276 | W1-adapters |
| `tests/adapters/detect.test.ts` |  | PORT | RETIRE | TECH-SPEC §5 step 1 (agent comes from --agent; src/entries/server.ts reads no clientInfo); GP1/opencode-clientinfo-detect proves #1276 | W1-adapters |
| `tests/adapters/gemini-cli-external-mcp-routing.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/policy/external-mcp-ported.test.mjs (#529; v2 matcher has no mcp__ catch-all, decide allows with no hint, ADR-0008 table, D-M7-RR-2) | W1-adapters |
| `tests/adapters/gemini-cli.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/hook-path-parity.test.ts` |  | PORT | COVERED | e2e GP1-absolute-node-path + tests/v2/build/manifests | W1-adapters |
| `tests/adapters/hook-runtime-per-adapter.test.ts` |  | PORT | COVERED | e2e GP1-absolute-node-path + tests/v2/build/manifests | W1-adapters |
| `tests/adapters/jetbrains-copilot.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/kimi-usage.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/kimi.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/kiro-external-mcp-routing.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/policy/external-mcp-ported.test.mjs (#529; v2 matcher has no mcp__ catch-all, decide allows with no hint, ADR-0008 table, D-M7-RR-2) | W1-adapters |
| `tests/adapters/kiro.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/memory-conventions.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/index/auto-memory.test.mjs + GP5/non-ascii-auto-memory-match | W1-adapters |
| `tests/adapters/omp-plugin.test.ts` |  | PORT | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/omp-usage.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/omp.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/openclaw-usage-handler.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/openclaw.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/opencode.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/pi-adapter.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/pi.test.mjs + tests/v2/plugins/pi.test.mjs | W1-adapters |
| `tests/adapters/pi-bridge-parent-death.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/plugins/pi-ported.test.mjs (#534/#809/#545; in-process Pi has no bridge child, ADR-0001 §3, ADR-0016) | W1-adapters |
| `tests/adapters/pi-extension-workspace-resolve.test.ts` | yes | KEEP-PASS | COVERED | COVERED (reclassified W1-adapters): tests/v2/plugins/pi-ported.test.mjs #545 + tests/v2/store/resolve.test.mjs 'resolveProject reads piCwd for pi'. KEEP-PASS file, W2 deletes | W1-adapters |
| `tests/adapters/pi-help-skip-bootstrap.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/plugins/pi-ported.test.mjs (#534/#809/#545; in-process Pi has no bridge child, ADR-0001 §3, ADR-0016) | W1-adapters |
| `tests/adapters/pi-mcp-bridge-env-scrub.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/plugins/pi-ported.test.mjs (#534/#809/#545; in-process Pi has no bridge child, ADR-0001 §3, ADR-0016) | W1-adapters |
| `tests/adapters/pi-mcp-bridge.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/plugins/pi-ported.test.mjs (#534/#809/#545; in-process Pi has no bridge child, ADR-0001 §3, ADR-0016) | W1-adapters |
| `tests/adapters/pi-no-orphan-on-help.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/plugins/pi-ported.test.mjs (#534/#809/#545; in-process Pi has no bridge child, ADR-0001 §3, ADR-0016) | W1-adapters |
| `tests/adapters/qwen-code-external-mcp-routing.test.ts` |  | PORT | COVERED | PORTED W1-adapters: tests/v2/policy/external-mcp-ported.test.mjs (#529; v2 matcher has no mcp__ catch-all, decide allows with no hint, ADR-0008 table, D-M7-RR-2) | W1-adapters |
| `tests/adapters/qwen-code-usage.test.ts` | yes | KEEP-PASS | RETIRE | RETIRE (reclassified W1-adapters): per-turn file-tail usage capture and pricing removed, ADR-0015 L48; v2 usage rows are tests/v2/hooks/usage.test.mjs (opencode step-finish). KEEP-PASS file, W2 deletes | W1-adapters |
| `tests/adapters/qwen-code.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/vscode-copilot.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/<agent>.test.mjs + e2e GP3-hooks | W1-adapters |
| `tests/adapters/zed.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-adapters |
| `tests/adapters/zod3tov4-e2e.test.ts` | yes | KEEP-PASS | RETIRE | impl/00 §1 (src/adapters/{pi,opencode}.ts are event glue; src/entries use zod/v4 directly; zod3tov4.ts unreached) | W1-adapters |
| `tests/adapters/zod3tov4-production.test.ts` | yes | KEEP-PASS | RETIRE | impl/00 §1 (src/adapters/{pi,opencode}.ts are event glue; src/entries use zod/v4 directly; zod3tov4.ts unreached) | W1-adapters |
| `tests/adapters/zod3tov4.test.ts` | yes | KEEP-PASS | RETIRE | impl/00 §1 (src/adapters/{pi,opencode}.ts are event glue; src/entries use zod/v4 directly; zod3tov4.ts unreached) | W1-adapters |
| `tests/analytics/format-report.test.ts` | yes | - | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/analytics/lifetime-stats-config-dir.test.ts` | yes | - | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/analytics/metrics.test.ts` | yes | - | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/analytics/price-per-token.test.ts` | yes | - | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 reports bytes only (#1023) | W1-session-stats |
| `tests/cli/open-browser.test.ts` | yes | - | RETIRE | ADR-0015 README row 5 (ctx_insight removed; tests/v2/repo/readme-upgrading) | W1-ops |
| `tests/cli/upgrade-mcp-json-assertion.test.ts` |  | - | RETIRE | ADR-0011 (no npm for v2; upgrade = ctx_upgrade, tests/v2/tools/upgrade) | W1-ops |
| `tests/cli/upgrade-plugin-json-assertion.test.ts` |  | - | RETIRE | ADR-0011 (no npm for v2; upgrade = ctx_upgrade, tests/v2/tools/upgrade) | W1-ops |
| `tests/cli/upgrade-rewrites-shell-snapshots.test.ts` |  | - | RETIRE | ADR-0011 (no npm for v2; upgrade = ctx_upgrade, tests/v2/tools/upgrade) | W1-ops |
| `tests/cli/upgrade-verifies-binding.test.ts` |  | - | RETIRE | ADR-0011 (no npm for v2; upgrade = ctx_upgrade, tests/v2/tools/upgrade) | W1-ops |
| `tests/codex/marketplace-layout.test.ts` |  | - | RETIRE | ADR-0011 (Codex v2 install is a config.toml rewrite, not the v1 .agents marketplace) | W1-ops |
| `tests/core/auto-memory-adapter.test.ts` | yes | - | COVERED | tests/v2/index/auto-memory.test.mjs | W1-core |
| `tests/core/auto-memory-config-dir.test.ts` | yes | - | COVERED | tests/v2/index/auto-memory.test.mjs | W1-core |
| `tests/core/cache-plugin-root.test.ts` |  | - | COVERED | tests/v2/ops/plugin-root.test.mjs | W1-core |
| `tests/core/cli.test.ts` |  | - | COVERED | unknown-platform fail-open: tests/v2/hooks/hook-entry + dispatch "unknown agent id"; npm/bundle/.mcp.json/ABI rows RETIRE per ADR-0011 (no npm, no bundle) and D2 (no ensure-deps) | W1-core |
| `tests/core/deny-policy.test.ts` |  | - | COVERED | ported: tests/v2/policy/security-ported.test.mjs (Windows glob rows); src-text guards RETIRE (v1 server.ts gone) | W1-core |
| `tests/core/echo-commands.test.ts` |  | - | COVERED | ported: tests/v2/tools/index-ported.test.mjs #717/#736 | W1-core |
| `tests/core/executor.test.ts` | yes | - | COVERED | tests/v2/tools/execute + tests/v2/sandbox/spawn + e2e GP4-execute | W1-core |
| `tests/core/fetch-cleanup.test.ts` | yes | - | COVERED | tests/v2/sandbox/fetch.test.mjs | W1-core |
| `tests/core/routing.test.ts` |  | - | RETIRE | D-M7-RR-2 (no PreToolUse hint, owner decision DECISIONS-r10 (2)); deny cases in tests/v2/policy/decide.test.mjs | W1-core |
| `tests/core/search-flood-guard.test.ts` | yes | - | RETIRE | ADR-0015 (flood-guard dropped, not replaced; readme-upgrading row) | W1-core |
| `tests/core/search-project-filter.test.ts` |  | - | RETIRE | triage R no-fallback-chains (ADR-0016); ctx_search covered by tests/v2/tools/search + GP5 | W1-core |
| `tests/core/search.test.ts` |  | - | RETIRE | triage R no-fallback-chains (ADR-0016); ctx_search covered by tests/v2/tools/search + GP5 | W1-core |
| `tests/core/server-timeline-adapter.test.ts` | yes | - | PORT | RETIRE-pending W2: no ctx_timeline in v2 TOOL_ORDER (PRD 8); timeline is ctx_search sort:"timeline", tests/v2/tools/search-decision | W1-core |
| `tests/core/server.test.ts` |  | - | COVERED | exit class ported: tests/v2/tools/index-ported.test.mjs; caps: tests/v2/sandbox/cap + spawn; storage path: tests/v2/store/config-dir; cap-kill rows RETIRE ADR-0016 | W1-core |
| `tests/executor.test.ts` | yes | - | COVERED | tests/v2/tools/execute + tests/v2/sandbox/spawn + GP4-execute | W1-core |
| `tests/executor/cwd-override.test.ts` | yes | - | COVERED | tests/v2/tools/execute + tests/v2/sandbox/spawn + GP4-execute | W1-core |
| `tests/executor/win-sandbox-782-788.test.ts` | yes | - | PORT | ported: tests/v2/sandbox/win-build-ported.test.mjs (#782, D-M7-CLN-4) + index-ported (#788); W2 deletes | W1-core |
| `tests/formatters.test.ts` | yes | - | COVERED | tests/v2/adapters/*.test.mjs (encode) + GP3-hooks | W1-hooks |
| `tests/guidance-throttle.test.ts` | yes | - | RETIRE | ADR-0008 amendment 2026-10-20 (DECISIONS-r10: all hints removed) | W1-hooks |
| `tests/hook-runtime-resolution.test.ts` | yes | - | COVERED | e2e GP1-absolute-node-path | W1-hooks |
| `tests/hooks/antigravity-cli-hooks.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-hooks |
| `tests/hooks/cache-heal-self-heal.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/hooks/claude-stop.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/codex-goal-compact.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/codex-sessionstart-rule-capture.test.ts` | yes | KEEP-PASS | PORT | triage P or no v2 case named yet; check GP3-hooks + tests/v2/hooks/* first | W1-hooks |
| `tests/hooks/copilot-cli-hooks.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/core-routing.test.ts` |  | PORT | PORTED, deleted | tests/v2/hooks/routing-ported.test.mjs | W1-hooks |
| `tests/hooks/cursor-hooks.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-hooks |
| `tests/hooks/ensure-deps.test.ts` | yes | KEEP-PASS | RETIRE | D2 (no runtime installs; deps bundled; v2-issue-map REMOVED:D2) | W1-hooks |
| `tests/hooks/formatters.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/adapters/*.test.mjs (encode) + GP3-hooks | W1-hooks |
| `tests/hooks/gemini-hooks.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/hook-latency.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hook-perf + bench/hook-gs6.mjs | W1-hooks |
| `tests/hooks/integration.test.ts` |  | PORT | PORTED, deleted | tests/v2/hooks/routing-ported.test.mjs | W1-hooks |
| `tests/hooks/jetbrains-hooks.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-hooks |
| `tests/hooks/kimi-config-dir.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-hooks |
| `tests/hooks/kimi-hooks.test.ts` | yes | KEEP-PASS | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-hooks |
| `tests/hooks/kiro-hooks.test.ts` | yes | KEEP-PASS | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/normalize-hooks-bun.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/hooks/platform-bridge-wire.test.ts` | yes | KEEP-PASS | PORT | triage P or no v2 case named yet; check GP3-hooks + tests/v2/hooks/* first | W1-hooks |
| `tests/hooks/post-upgrade-first-hook-fire.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/hooks/precompact-snapshot-event.test.ts` |  | PORT | RETIRE | ADR-0009 / D9 (no injected snapshot; ctx_resume is explicit, GP6) | W1-hooks |
| `tests/hooks/redirect-marker-bash.test.ts` |  | PORT | RETIRE | ADR-0008 amendment 2026-10-20 (hints and redirect markers removed) | W1-hooks |
| `tests/hooks/redirect-marker-read.test.ts` |  | PORT | RETIRE | ADR-0008 amendment 2026-10-20 (hints and redirect markers removed) | W1-hooks |
| `tests/hooks/redirect-marker-webfetch.test.ts` |  | PORT | RETIRE | ADR-0008 amendment 2026-10-20 (hints and redirect markers removed) | W1-hooks |
| `tests/hooks/require-security.test.ts` |  | PORT | PORTED, deleted | tests/v2/hooks/routing-ported.test.mjs | W1-hooks |
| `tests/hooks/run-hook.test.ts` |  | PORT | PORTED, deleted | tests/v2/hooks/entry-ported.test.mjs | W1-hooks |
| `tests/hooks/sessionstart-resume-event.test.ts` |  | PORT | RETIRE | ADR-0009 / D9 (no injected snapshot; ctx_resume is explicit, GP6) | W1-hooks |
| `tests/hooks/sessionstart-shell-snapshot-heal.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/hooks/shell-snapshot-heal.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/hooks/stdin-idle-timeout.test.ts` |  | PORT | PORT (open gap) | v2 hook entry has no stdin idle timeout (#242 #639 #719); kept, see DEVIATIONS D-M7-CLN-2 | W1-hooks |
| `tests/hooks/tool-naming.test.ts` |  | PORT | PORTED, deleted | tests/v2/hooks/routing-ported.test.mjs | W1-hooks |
| `tests/hooks/vscode-hooks.test.ts` |  | PORT | COVERED | e2e GP3-hooks + tests/v2/hooks/dispatch(-compact) | W1-hooks |
| `tests/hooks/windows-hooks-normalization.test.ts` |  | PORT | RETIRED, deleted | D2 + ADR-0002 (heal/normalize/shell-snapshot scripts removed; v2 writes absolute-path hook commands at build, GP1-absolute-node-path + GP11 doctor/upgrade; DEVIATIONS D-M7-CLN-2) | W1-hooks |
| `tests/integration/commit-message-symmetry.test.ts` | yes | - | PORT | see plan note: platform rollup forward (bridge.maybeForward) has no v2 code; no ADR drops it yet; OWNER DECISION, W2 does not delete until decided | W1-core |
| `tests/integration/cross-project-attribution.test.ts` | yes | - | COVERED | e2e GP7-scope + tests/v2/store/resolve | W1-core |
| `tests/integration/project-dir-strict.test.ts` |  | - | COVERED | e2e GP7-scope + tests/v2/store/resolve | W1-core |
| `tests/integration/seed-parity-coverage.test.ts` | yes | - | PORT | see plan note: platform rollup forward (bridge.maybeForward) has no v2 code; no ADR drops it yet; OWNER DECISION, W2 does not delete until decided | W1-core |
| `tests/lifecycle.test.ts` | yes | - | COVERED | tests/v2/lifecycle/exit.test.mjs + e2e GP9-lifecycle | W1-core |
| `tests/opencode-plugin.test.ts` |  | - | PORT | triage P: check tests/v2/plugins/opencode + tests/v2/hooks/usage first | W1-ops |
| `tests/pi-extension.test.ts` |  | - | PORT | triage P: check tests/v2/plugins/pi + GP11-pi-agy first | W1-ops |
| `tests/plugins/codex-manifest.test.ts` | yes | - | COVERED | tests/v2/build/manifests + e2e GP1-release-tree | W1-ops |
| `tests/plugins/openclaw.test.ts` |  | - | RETIRE | TECH-SPEC §3.10 (removed agent) | W1-ops |
| `tests/runtime.test.ts` | yes | - | COVERED | tests/v2/sandbox/runtimes.test.mjs | W1-core |
| `tests/scripts/assert-bundle.test.ts` | yes | - | RETIRE | ADR-0011/0013 (release tree built by build/build.mjs; GP1-release-tree) | W1-ops |
| `tests/scripts/asymmetric-drift-assert.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no start.mjs in v2) | W1-ops |
| `tests/scripts/start-mjs-mcp-boot.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no start.mjs in v2) | W1-ops |
| `tests/scripts/start-mjs-reexec-teardown-862.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no start.mjs in v2) | W1-ops |
| `tests/scripts/start-mjs-win-install-861.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no start.mjs in v2) | W1-ops |
| `tests/scripts/version-sync.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no start.mjs in v2) | W1-ops |
| `tests/security.test.ts` |  | - | COVERED | ported: tests/v2/policy/security-ported.test.mjs; lexer fix D-M7-CLN-2 | W1-core |
| `tests/security/project-boundary-852.test.ts` |  | - | COVERED | ported: tests/v2/policy/security-ported.test.mjs #852 + tests/v2/store/contain | W1-core |
| `tests/server-stdin-eof-exit.test.ts` | yes | - | COVERED | tests/v2/lifecycle/exit.test.mjs + e2e GP9-lifecycle | W1-core |
| `tests/session-hooks-smoke.test.ts` | yes | - | COVERED | e2e GP3-hooks | W1-hooks |
| `tests/session/classifier.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0009 (role/intent classifier and keyword rule detection removed, #856) | W1-session-journal |
| `tests/session/cleanup-preserves-live-uuid-events.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/{db,schema,cleanup,owners} + tests/v2/tools/purge + GP8-concurrency | W1-session-store |
| `tests/session/content-store-path-migration.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0002 (one fresh v2 DB per project; v1 DB not migrated, ADR-0011 v1 cleanup) | W1-session-store |
| `tests/session/continuity.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/resume + e2e GP6-journal-resume | W1-session-store |
| `tests/session/cross-session-bleed.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/resume + e2e GP6-journal-resume | W1-session-store |
| `tests/session/db-path-canonical-migration.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0002 (one fresh v2 DB per project; v1 DB not migrated, ADR-0011 v1 cleanup) | W1-session-store |
| `tests/session/detect-locale-esm.test.ts` |  | PORT | PORT | triage P: locale use outside the removed classifier not confirmed | W1-session-journal |
| `tests/session/event-emit.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-agent-usage.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-bash-outcome.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-bytes-retrieved.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-exit-plan-mode.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-exit-worktree.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-file-read-metadata.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-git-commit.test.ts` | yes | KEEP-PASS | PORT | git events: confirm v2 journal keeps them (compaction candidates) or name the ADR that drops them | W1-session-journal |
| `tests/session/extract-multilang.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-plan-fallback.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-prompt-features.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-rule-detection.test.ts` |  | PORT | RETIRE | ADR-0009 (role/intent classifier and keyword rule detection removed, #856) | W1-session-journal |
| `tests/session/extract-session-settings.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/extract-transcript-usage-since.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/extract-transcript-usage.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/extract-webfetch-metadata.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/format-cost.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/format-datetime.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/format-report-real-bytes.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/format-timeline.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/lifetime-stats.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/multi-adapter-render.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/multi-adapter-stats.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/parse-gemini-usage.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/parse-git-invocation.test.ts` | yes | KEEP-PASS | PORT | git events: confirm v2 journal keeps them (compaction candidates) or name the ADR that drops them | W1-session-journal |
| `tests/session/parse-openclaw-usage.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/parse-opencode-usage.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/hooks/usage.test.mjs + GP10/usage-events-idempotent-per-turn | W1-session-stats |
| `tests/session/parse-pi-usage.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/pricing.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0015 (pricing.ts, model-prices.json deleted); GP10 bytes only | W1-session-stats |
| `tests/session/project-attribution.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/resolve + e2e GP7-scope | W1-session-store |
| `tests/session/purge-session.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/{db,schema,cleanup,owners} + tests/v2/tools/purge + GP8-concurrency | W1-session-store |
| `tests/session/real-bytes-stats.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/resolve-session-path.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/resolve + e2e GP7-scope | W1-session-store |
| `tests/session/resume-leg-boundary.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/resume + e2e GP6-journal-resume | W1-session-store |
| `tests/session/retrieval-marker.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/server-tool-call-wiring.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/session-db-bytes-migration.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0002 (one fresh v2 DB per project; v1 DB not migrated, ADR-0011 v1 cleanup) | W1-session-store |
| `tests/session/session-db.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/{db,schema,cleanup,owners} + tests/v2/tools/purge + GP8-concurrency | W1-session-store |
| `tests/session/session-extract.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/session-goal.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/session-pipeline.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/session/session-snapshot.test.ts` | yes | KEEP-PASS | RETIRE | ADR-0009 / D9 (no injected snapshot) | W1-session-store |
| `tests/session/stats-output-format.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/tools/stats.test.mjs + e2e GP10-stats | W1-session-stats |
| `tests/session/tool-calls-persistence.test.ts` | yes | KEEP-PASS | COVERED | tests/v2/store/journal + tests/v2/hooks/dispatch + tests/v2/compaction/candidates + e2e GP6-journal-resume | W1-session-journal |
| `tests/stale-detection.test.ts` | yes | - | PORT | ported: tests/v2/tools/index-ported.test.mjs (D-M7-CLN-3); W2 deletes | W1-core |
| `tests/statusline-sqlite.test.ts` | yes | - | RETIRE | ADR-0015 README row 5 (statusline removed; readme-upgrading) | W1-ops |
| `tests/statusline.test.ts` | yes | - | RETIRE | ADR-0015 README row 5 (statusline removed; readme-upgrading) | W1-ops |
| `tests/store-bytecap.test.ts` |  | - | RETIRE | triage R, ADR-0016 (no truncation; BM25 selection only) | W1-core |
| `tests/store-directory.test.ts` | yes | - | COVERED | tests/v2/store/{db,fts,config-dir} + e2e GP5-index-search | W1-core |
| `tests/store.test.ts` | yes | - | COVERED | tests/v2/store/{db,fts,config-dir} + e2e GP5-index-search | W1-core |
| `tests/tier2-smoke-assert.test.ts` | yes | - | RETIRE | ADR-0013 (smoke is scripts/release/smoke.mjs) | W1-ops |
| `tests/truncate-removal.test.ts` |  | - | RETIRE | triage R, ADR-0016 (no truncation; BM25 selection only) | W1-core |
| `tests/truncate.test.ts` |  | - | RETIRE | triage R, ADR-0016 (no truncation; BM25 selection only) | W1-core |
| `tests/util/claude-config.test.ts` | yes | - | COVERED | tests/v2/store/config-dir.test.mjs | W1-ops |
| `tests/util/cli-upgrade-verification.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/codex-session-cwd-resolution.test.ts` | yes | - | PORT | triage P / KEEP-PASS: check tests/v2/store/resolve + GP7-scope first | W1-ops |
| `tests/util/ctx-doctor-distinguishes-states.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/ctx-upgrade-platform-threading.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/db-base-platform-gate.test.ts` |  | - | PORT | triage P / KEEP-PASS: check tests/v2/store/resolve + GP7-scope first | W1-ops |
| `tests/util/heal-better-sqlite3-python.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/heal-better-sqlite3.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/heal-installed-plugins.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/isolated-env.test.ts` | yes | - | RETIRE | v1 vitest helper; goes with the v1 suite (no v2 test imports it) | W2-keep-pass |
| `tests/util/no-dynamic-require.test.ts` | yes | - | PORT | #511 guard: v2 bundles are ESM too; add a GP1-release-tree check | W1-ops |
| `tests/util/package-deps-policy.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/postinstall-heal-mcp-json.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/postinstall-heal.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/project-dir-matrix.test.ts` |  | - | PORT | triage P / KEEP-PASS: check tests/v2/store/resolve + GP7-scope first | W1-ops |
| `tests/util/project-dir.test.ts` |  | - | PORT | triage P / KEEP-PASS: check tests/v2/store/resolve + GP7-scope first | W1-ops |
| `tests/util/start-mjs-no-poison.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/util/start-mjs-self-heal.test.ts` |  | - | RETIRE | ADR-0011 (no npm, no postinstall/self-heal in v2) | W1-ops |
| `tests/worktree-suffix.test.ts` | yes | - | COVERED | tests/v2/store/resolve (git common dir hash, ADR-0007 decision 4) + GP7-scope | W1-core |

PORT rows say "check X first": the task opens X; if X already asserts the same behaviour the row becomes COVERED (name the test), else the task writes the case before the delete.

## 4. v1 test support files

| Path | Class | Task | Reason |
|---|---|---|---|
| `tests/benchmark-results-v04.json` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/benchmark.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/context-comparison.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/core/.gitkeep` | DELETE | W2-keep-pass | empty v1 folder marker |
| `tests/ecosystem-benchmark.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/fixtures/access.log` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/analytics.csv` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/api-response.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/build-output.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/claude-code-transcript.jsonl` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/context7-nextjs-docs.md` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/context7-react-docs.md` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/context7-supabase-edge.md` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/context7-tailwind-docs.md` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/cursor/posttooluse-mcp.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/cursor/posttooluse-shell.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/cursor/pretooluse-mcp.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/cursor/pretooluse-shell.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/cursor/sessionstart.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/git-diff.patch` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/git-log.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/github-issues.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/github-prs.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/kimi-wire.jsonl` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/mcp-tools.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/package-large.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/playwright-console.json` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/playwright-network.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/playwright-snapshot.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/source-example.ts` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/test-output.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/tsc-errors.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/fixtures/utf8-content.txt` | DELETE | W2-keep-pass | read by v1 tests only (3 files); no tests/v2, e2e or bench file reads tests/fixtures |
| `tests/keep-pass.list.json` | DELETE | W2-keep-pass | KEEP-PASS runner input (gen-keep-pass, gate, ci.yml); goes when the list is empty |
| `tests/live-benchmark-v04.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/live-benchmark.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/mcp-integration.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/session/.gitkeep` | DELETE | W2-keep-pass | empty v1 folder marker |
| `tests/setup-home.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/shared/.gitkeep` | DELETE | W2-keep-pass | empty v1 folder marker |
| `tests/use-cases.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/util/isolated-env-state.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/util/isolated-env.ts` | DELETE | W2-keep-pass | v1 test support, used only by v1 tests or v1 npm scripts (`benchmark`, `test:use-cases`, ...) |
| `tests/vitest.config.ts` | DELETE | W2-keep-pass | KEEP-PASS runner input (gen-keep-pass, gate, ci.yml); goes when the list is empty |

## W3-v1-src-hooks status (2026-10-21)

Done: 156 v1 src files, hooks/ (85), scripts/heal-*.mjs, vitest.config.ts deleted; tsconfig.json is v2-only noEmit. 4 tests (platform-bridge-wire, stdin-idle-timeout, commit-message-symmetry, seed-parity-coverage) deleted with their code; each is an OPEN PORT row in tickets/port/W3-v1-src-hooks.md (DEVIATIONS D-M7-CLN-W3-v1-src-hooks).
