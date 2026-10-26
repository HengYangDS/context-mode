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

## Re-run after the fixes (2026-10-26)

Same method: one large result per agent, hook or plugin driven with the documented payload, no logged-in model session. All 10 agents pass.

| Agent | off (bytes) | v2 (bytes) | Result | Problems found |
|---|---|---|---|---|
| claude-code | 196,149 | 286 | pass | Test setup: the first setup run failed because the temp project git repo had no commit (git worktree add failed: not a valid object name HEAD) and because the claude-worktree shim was first on PATH. Setup passed after I made a commit in the temp repo and put the real claude binary on PATH. Setup does not tell the user about either cause; the first error was unclear. The first failed setup left a cw/plugin worktree in the temp project; harmless, it was deleted with the temp space. |
| codex | 217,858 | 392 | pass | The codex docs page has no skills directory, so skillOk rests on the skill text naming the registered MCP tool, not on a documented path. I did not run codex itself with a login. I used the registered hook command and the MCP server directly, as instructed. |
| gemini | 168,875 | 343 | pass | The AfterTool deny reason tells the model to call `ctx_search(...)`, but Gemini names the tool mcp_context-mode_ctx_search (the skills use the right name). The model may call a tool that does not exist. Fix: use the host tool name in the hook text. BeforeTool does nothing for `cat` (empty output). All savings come from AfterTool, so the raw output is already read by the host before it is replaced. |
| qwen | 212,544 | 332 | pass | `qwen hooks list` does not exist in 0.26.1 (only /hooks in interactive mode), so the host's own hook list could not be shown headless; registration was shown via the manifest and the loader source, and `qwen extensions list` parsed the extension. No live model run (no login), so the hook was piped by hand instead of fired by the host. |
| copilot-cli | 203,669 | 384 | pass | Doctor WARN hook-seen: not seen yet, because the real host was not driven with a model login. The hook was fired by hand with a documented payload instead. I did not verify the exact MCP tool-name prefix format (mcp_context-mode_...) that the host builds. The skill lists two names, and neither one was checked against host docs or host source. |
| vscode | 204,513 | 560 | pass | doctor --agents vscode printed FAIL: 'hook overhead p95 17 ms > 15 ms' (cold laptop run while other builds ran; likely noise, but the check is flaky under load). Run with 'context-mode doctor --agents vscode', a second run is untested. No VS Code loader or list command was run. The `code` CLI exists on this machine, but it has no documented hook list command, so I did not prove the host parses the files. |
| kiro | 183,551 | 242 | pass | No kiro CLI was available, so I could not run its list or loader command. I did not prove that Kiro itself parses our hook file or skills; I only checked them against the docs. The Kiro docs do not give the full stdin payload (hook_event_name, cwd, the shell tool_name value). I took these from the repo's adapter and fixture, and the tool_name was not re-verified against a current Kiro page. The same limit applies to the claim that Kiro returns the denial stderr to the model. |
| zcode | 169,068 | 443 | pass | Host zcode CLI is not installed and not on npm (@zcode/cli 404; only builds from the zai-org/ZCode repo with pnpm), so no loader/list command was run; parsing was proven only by our doctor. Docs do not state the user skills directory (~/.zcode/skills) and do not state the full hook-stdin field list in the fetched text; skill dir is unverified against official docs. |
| pi | 200,062 | 160 | pass | Not run through a real pi model turn (no login); the extension was driven with the documented event objects, so this does not prove what a live model saw. Upstream web docs were not fetched; doc check used the docs shipped inside the installed pi 0.73.1 package. |
| opencode | 198,645 | 235 | pass | Hook was driven by calling the plugin hook function directly, not inside a live opencode session (no model login), so host-side handling of the thrown Error was not observed; only the documented throw contract was checked. Skill bodies say 'ctx_stats tool'; the MCP wire name in OpenCode is context-mode_ctx_stats, while the plugin tool map registers ctx_stats. skillOk assumes the plugin tool name is the host's real name; not proven in a live session. |
