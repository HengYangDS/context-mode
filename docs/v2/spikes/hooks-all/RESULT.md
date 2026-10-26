# hooks-all: live saving runs

Date: 2026-10-26. Branch `exp/hooks-all`, merged into `v2-design` at 87443e30 ([ADR-0020](../../adr/0020-hooks-and-skills-on-every-agent.md)).

## Method

- One large tool result per agent (a `cat` of a log of about 200 KB). "off" = bytes that reach the model with no context-mode. "v2" = bytes that reach the model with the installed v2 hook or plugin.
- Each run used a clean temporary HOME, setup from the built package, then doctor.
- No run used a logged-in model session. Each run piped the host's documented hook payload into the installed hook command or plugin. A pass means the hook output is right. It does not prove what a real model saw.

## Runs

| Agent | Effect | off (bytes) | v2 (bytes) | Result | Problems found |
|---|---|---|---|---|---|
| claude-code | R | 200,079 | 319 | pass | No live session. The first setup failed because `claude` on PATH was a worktree shim; setup rolled back and reported it. Setup needs the real host CLI on PATH. |
| codex | D | 200,090 | 427 | pass | No live session. PostToolUse does not replace output (empty stdout for the 200,090-byte result). Saving rests on the PreToolUse deny and the `ctx_execute` redirect. |
| gemini | R | 250,930 | 208 | pass | No live session, no login. Doctor shows WARN `hook-seen` until a real host tool call. |
| opencode | D | 200,072 | 264 | pass | opencode not installed, no login; the run drove the installed plugin directly. Journal had only prompt rows; `ctx_stats` showed 0 B, so stats do not record this saving. |
| qwen | D | 200,120 | 286 | pass | No login. qwen 0.26.1 checked only through the extensions list and the hook registry log. |
| pi | R | 200,067 | 200,067 | fail | Dispatch never passed `piCwd`, so every hook returned allow with `NO_PROJECT`. Doctor `hook-runs`/`hook-seen` passed anyway. Fixed after the run (D-HA-PI-PROJECT-1, D-HA-PI-NAMES-1); live re-run open. |
| vscode | D | 200,049 | 404 | fail | Setup writes the hook command and MCP args without `--workspace-folder`; the hook exits 0 with `NO_PROJECT`, and `ctx_execute` through the MCP args returns isError. Open. |
| zcode | D | 200,067 | 447 | fail | Setup writes bare handlers, not matcher groups `{matcher, hooks:[...]}`; MCP goes under top-level `mcpServers`, not `mcp.servers` with `features.mcp: true`. Open. |
| copilot-cli | R | - | - | not run | Probe on copilot-cli 1.0.103 found shell tool `bash` unmapped and no replace (D-HA-COPILOT-NAMES-1, D-HA-COPILOT-REPLACE-1). Fixed in tests; live run open. |
| kiro | D | - | - | not run | Kiro not installed. |

## Fixes made in this run (tests first)

Red commit f8df5d05 (`tests/v2/hooks/saving-live-shapes.test.mjs`), then green:

- D-HA-PI-PROJECT-1: dispatch passes `ev.cwd` as `piCwd` on pi.
- D-HA-PI-NAMES-1: pi `bash` -> `Bash`, `read` -> `Read`.
- D-HA-COPILOT-NAMES-1: copilot-cli `bash` -> `Bash`.
- D-HA-COPILOT-REPLACE-1: copilot-cli postToolUse returns `modifiedResult`; snake decode reads `tool_result`.

## Checks before merge

| Check | exp/hooks-all | merged tree |
|---|---|---|
| `node --test tests/v2/` | 1538 tests, 0 fail, 2 skip | 1559 tests, 0 fail, 2 skip |
| `node scripts/gate.mjs --all --quick` | green (live layer skipped by `--quick`) | green |
| setup + doctor per agent, clean HOME | codex, vscode, kiro, zcode, opencode pass (as on base); claude-code fails on both (shim on PATH); gemini, qwen, copilot-cli, pi skipped on both (not on PATH) | - |

No agent that passed setup and doctor on the v2-design head failed on the branch.
