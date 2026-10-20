# PORT tickets from W3-v1-src-hooks

Source: git log --follow per deleted v1 file (src/**, hooks/**, scripts/heal-*.mjs), fix/issue commits whose issue number appears nowhere in tests/v2, e2e, src/core, src/adapters, src/entries, src/prompt, build, bench, docs/v2 or tickets/v2-issue-map.md. Last commit with v1 files: cc00362a (git show cc00362a:<path>).

Status: OPEN. Each row needs a v2 case, or an ADR/decision that retires it. No v2 behaviour was changed by W3.

## A. Test gaps (tests deleted in W3 because the v1 code they import is gone)

- tests/hooks/stdin-idle-timeout.test.ts: v2 hook entry (src/core/hooks/io.ts readStdin) has no stdin idle timeout. Issues #242 (partial >1MB stdin then stall must reject), #639 (open pipe with zero bytes must exit). v1 env CONTEXT_MODE_HOOK_STDIN_IDLE_MS. Decision tied to the hook budget (open owner item). Recover: git show cc00362a:tests/hooks/stdin-idle-timeout.test.ts.
- tests/hooks/platform-bridge-wire.test.ts, tests/integration/commit-message-symmetry.test.ts, tests/integration/seed-parity-coverage.test.ts: platform rollup forward (bridge.maybeForward) has no v2 code and no ADR drops it. OWNER DECISION.

## B. Issue numbers with no v2 case

| Issue | Commit | Subject | v1 files |
|---|---|---|---|
| #479 | 990586a2 | fix(codex): normalize hook errors and guard patch continuity (#479) | hooks/codex/posttooluse.mjs, hooks/kimi/posttooluse.mjs, src/adapters/codex/hooks.ts, src/adapters/codex/index.ts (+2) |
| #325 | 270a56f0 | feat(session): per-event project attribution for session tracking (#325) | hooks/codex/posttooluse.mjs, hooks/codex/userpromptsubmit.mjs, hooks/copilot-cli/userpromptsubmit.mjs, hooks/cursor/posttooluse.mjs (+16) |
| #773 | 9f63a0b2 | fix(hooks): capture Stop turn ends (#773) | hooks/codex/stop.mjs, hooks/hooks.json, hooks/stop.mjs, src/adapters/claude-code/hooks.ts (+2) |
| #581 | e63271b2 | fix(opencode): detect desktop sessions via OPENCODE_CLIENT/OPENCODE_TERMINAL (#581) | hooks/core/platform-detect.mjs, hooks/security.bundle.mjs, src/adapters/detect.ts, src/cli.ts |
| #778 | a67c4fb8 | fix(pi): detect package server via PI_CODING_AGENT (#778) | hooks/security.bundle.mjs, src/adapters/detect.ts |
| #579 | 7f1e1e8e | fix(upgrade): heal ~/.claude.json user MCP registrations after version bump (#579) | scripts/heal-installed-plugins.mjs, src/cli.ts |
| #853 | 2608e344 | refactor(antigravity-cli): one-command agy plugin install (drop npm wrapper) + doc cleanup (#853) | src/adapters/antigravity-cli/index.ts |
| #810 | 7cc9d3be | fix(upgrade): skip settings.json wiring only for true plugin installs (#810) | src/adapters/claude-code/index.ts |
| #480 | 84b8d15c | feat(adapters): add OMP (Oh My Pi) platform adapter (#473) (#480) | src/adapters/detect.ts, src/adapters/omp/index.ts, src/adapters/pi/index.ts, src/adapters/types.ts |
| #597 | 09efefdc | feat(opencode): register ctx tools natively via plugin (#574) (#597) | src/adapters/opencode/index.ts, src/adapters/pi/mcp-bridge.ts, src/server.ts |
| #815 | 56e9e9a7 | fix: preserve ZodEffects preprocess and ZodType coerce in zod3tov4 (#815) | src/adapters/opencode/zod3tov4.ts |
| #734 | 926481e8 | fix(opencode): convert Zod v3 schemas to v4 for in-process plugin host (#734) | src/adapters/opencode/zod3tov4.ts |
| #601 | 3de856e4 | fix(pi): move behavioral_directive to end of system prompt (#601) | src/adapters/pi/extension.ts |
| #488 | 228c34d5 | fix(pi): parse session age timestamps as UTC (#488) | src/adapters/pi/extension.ts |
| #676 | dee946c6 | fix(pi): prevent mixed-width TUI over-width crashes (CJK/Korean/emoji) (#676) | src/adapters/pi/mcp-bridge.ts |
| #585 | 3e39ff7d | fix(pi): move respawn guard to request() + single-flight + smoke pin (#583 follow-up) (#585) | src/adapters/pi/mcp-bridge.ts |
| #839 | 10e2850d | Fix PowerShell Unicode path handling (#839) | src/executor.ts |
| #709 | 59f4d10d | fix(executor): handle Windows shell runtimes robustly (#709) | src/executor.ts, src/runtime.ts |
| #459 | 702dc751 | fix: preserve shell executor PATH after startup (#459) | src/executor.ts |
| #405 | 427efae2 | fix: add ps1 extension for Windows PowerShell -File scripts (#405) | src/executor.ts |
| #685 | f1878a70 | fix(stats): v1.0.148 hotfix — schema migration + META-scope + strict-compression formula (#685) | src/server.ts, src/session/analytics.ts, src/session/db.ts |
| #657 | 3988090a | fix(batch_execute): preserve heredoc commands (#657) | src/server.ts |
| #679 | 7a3482ed | fix(server): add z.preprocess coercions to ctx_fetch_and_index force and requests params (#679) | src/server.ts |
| #522 | 8970ba59 | fix(server): suppress startup banner when running as MCP child (#522) | src/server.ts |
| #402 | b8e11bfd | fix(stats): persist dollars_saved_lifetime for statusline (#402) | src/server.ts |
| #715 | 14ce9c10 | perf: remove redundant allocations in search reranking and analytics rendering (#715) | src/session/analytics.ts, src/store.ts |
