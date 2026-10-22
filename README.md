# Context Mode

Keeps large tool output out of your coding agent's context window.

[![clones](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmksglu%2Fcontext-mode%2Fmain%2Fmetrics%2Ftraffic.json&query=%24.clones.count&label=clones&color=blue)](https://github.com/mksglu/context-mode/graphs/traffic)
[![GitHub stars](https://img.shields.io/github/stars/mksglu/context-mode?style=flat&color=yellow)](https://github.com/mksglu/context-mode/stargazers)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)

> **v2 installs from git, or from npm as the `@next` preview.** Coming from v1? See [Upgrading from v1](#upgrading-from-v1).

## What it does

A coding agent reads files, runs commands and fetches pages. Each result goes into its context window.
A big log or a large file fills that window fast, and the agent forgets what it was doing.
Context Mode stops the big output before it lands, keeps it on disk, and gives back only the part the agent asks for.

- **Sandbox tools.** The agent runs code and commands through `ctx_execute` and `ctx_batch`. Only the result it prints comes back.
- **One index per project, with search.** Full output goes into one local SQLite file per project. `ctx_search` finds the lines the agent needs.
- **State after compaction.** When the agent compacts its context, a small state block tells it what it was doing. `ctx_resume` reads any row in full.

See [docs/how-it-works.md](docs/how-it-works.md) for the full picture.

## Install

v2 preview from npm, then the guided setup. `@next` is the v2 preview; a plain `npm i -g context-mode` still installs v1 until v2 is released.

```sh
npm i -g context-mode@next && context-mode setup
```

Or pick your agent and follow its guide. A row shows a command only after a live install test on that agent passes.
No agent has passed that test yet, so each row says "see guide" for now. [docs/install/README.md](docs/install/README.md) shows how far each guide is checked.

| Agent | Command | Guide |
|---|---|---|
| Claude Code | see guide | [docs/install/claude-code.md](docs/install/claude-code.md#install) |
| Codex | see guide | [docs/install/codex.md](docs/install/codex.md#install) |
| Copilot CLI | see guide | [docs/install/copilot-cli.md](docs/install/copilot-cli.md#install) |
| Gemini CLI | see guide | [docs/install/gemini.md](docs/install/gemini.md#install) |
| Kiro | see guide | [docs/install/kiro.md](docs/install/kiro.md#install) |
| OpenCode | see guide | [docs/install/opencode.md](docs/install/opencode.md#install) |
| Pi | see guide | [docs/install/pi.md](docs/install/pi.md#install) |
| Qwen Code | see guide | [docs/install/qwen.md](docs/install/qwen.md#install) |
| VS Code (Copilot) | see guide | [docs/install/vscode.md](docs/install/vscode.md#install) |
| ZCode | see guide | [docs/install/zcode.md](docs/install/zcode.md#install) |

You need Node 24.15.0 or later; v2 uses the built-in `node:sqlite`.
Without npm, each agent installs Context Mode from the `release` branch of this repo.

After the install, run `/ctx-doctor` in the agent.
Every check prints PASS, or a FAIL line with the exact command that fixes it.

Each guide also covers update, rollback, uninstall and troubleshooting for that agent.

## Upgrading from v1

Do these steps in one sitting, in this order:

1. Install v2 with your agent's guide (table below).
2. Run `/ctx-upgrade`. It finds the v1 files and removes them. Then restart the agent.
3. Only then run `npm uninstall -g context-mode`.

Do not uninstall the npm package first. The v1 hooks for Copilot CLI, VS Code, Codex, Gemini and Kiro call the global `context-mode` binary. They fail until `/ctx-upgrade` runs.

A row shows a command only after a live install test on that agent passes. No agent has passed it yet.

| Agent | Command | Guide |
|---|---|---|
| Claude Code | see guide | [docs/install/claude-code.md](docs/install/claude-code.md#upgrade-from-v1) |
| Codex | see guide | [docs/install/codex.md](docs/install/codex.md#upgrade-from-v1) |
| Copilot CLI | see guide | [docs/install/copilot-cli.md](docs/install/copilot-cli.md#upgrade-from-v1) |
| Gemini CLI | see guide | [docs/install/gemini.md](docs/install/gemini.md#upgrade-from-v1) |
| Kiro | see guide | [docs/install/kiro.md](docs/install/kiro.md#upgrade-from-v1) |
| OpenCode | see guide | [docs/install/opencode.md](docs/install/opencode.md#upgrade-from-v1) |
| Pi | see guide | [docs/install/pi.md](docs/install/pi.md#upgrade-from-v1) |
| Qwen Code | see guide | [docs/install/qwen.md](docs/install/qwen.md#upgrade-from-v1) |
| VS Code (Copilot) | see guide | [docs/install/vscode.md](docs/install/vscode.md#upgrade-from-v1) |
| ZCode | see guide | [docs/install/zcode.md](docs/install/zcode.md#upgrade-from-v1) |

| v1 feature | v2 | Why / what to use now |
|---|---|---|
| `statusline` (`context-mode statusline`) | Removed | No npm CLI in v2. `ctx_doctor` and `ctx_stats` show the same numbers in the agent |
| The `context-mode` CLI | Removed | No npm in v2. Use `/ctx-stats`, `/ctx-doctor`, `/ctx-upgrade` in the agent |
| `ctx_insight` | Removed | Its numbers are in `ctx_stats` |
| v1 fetch and batch tools | Renamed | `ctx_index` takes a `url`; `ctx_batch` runs many commands |
| `ctx_purge` scopes | Changed | Pick one scope: `session`, `source`, `project` |
| Search call-rate limit (`flood-guard.ts`) | Removed, not replaced | It blocked many subagents that searched at the same time (#769) |
| Large resume snapshot | 2 KB state block | Run `ctx_resume(seq:N)` on a pointer line to read the full row |
| Event eviction | None | Old rows stay; the block picks rows by score |
| Auto-injected rules and persona | Removed | Put standing rules in `CLAUDE.md` or your agent's rules file |
| Decisions found in prose | Answers to a choice only | `ctx_search(source:"decision")` |
| Search by category | Search by text or source | `ctx_search(queries:["…"], scope:"project")` |
| Cross-project timeline | Current project only | `ctx_search(scope:"project")`; there is no cross-project scope |
| `CONTEXT_MODE_REQUIRE_SECURITY` | Kept | Same name; `=1` denies every call when your deny rules cannot be read |
| `CONTEXT_MODE_BASH_NUDGE_MIN_COMMAND_BYTES` | Ignored | v2 shows the hint once per session |

v1 memory rows are not moved into v2. To go back to v1, run the command for your agent:

| Agent | Rollback |
|---|---|
| Claude Code | `npm install -g context-mode`, then `claude plugin uninstall context-mode@context-mode` |
| Codex | `npm install -g context-mode`, put the v1 entry (`npx -y context-mode mcp`) back in `[mcp_servers.context-mode]` of `config.toml`, add the v1 `hooks.json` entries again, then restart Codex |
| Gemini | `gemini extensions uninstall context-mode`, then add by hand to `~/.gemini/settings.json`: `"mcpServers": {"context-mode": {"command": "npx", "args": ["-y", "context-mode", "mcp"]}}` |
| Qwen Code | Same as Gemini, in `~/.qwen/settings.json` |
| Copilot CLI | `copilot plugin uninstall context-mode`, `copilot mcp remove context-mode`, `npm install -g context-mode`, then make `~/.copilot/hooks/context-mode.json` again with the v1 install step |
| VS Code | Delete the v2 `context-mode` entry in `.vscode/mcp.json`, `npm install -g context-mode`, then make `<project>/.github/hooks/context-mode.json` again with the v1 install step |
| Kiro | Remove the v2 entry in `~/.kiro/settings/mcp.json` and the v2 hook file, `npm install -g context-mode`, then add the `.hooks.*` entries in `~/.kiro/agents/default.json` again with the v1 install step |
| Pi | Remove the git entry from `packages[]` in `~/.pi/agent/settings.json`, then add `"npm:context-mode"` |
| OpenCode | `npm install -g context-mode`, delete `mcp.context-mode` and the v2 plugin file in `plugins/`, then add `"context-mode"` to `.plugin[]` |
| ZCode | `npm install -g context-mode`, then make the `~/.zcode/cli/hooks.json` entry again with the v1 install step |

Gemini and Qwen have no scripted rollback. If the steps above fail, read the [Gemini](docs/install/gemini.md#rollback-to-v1) or [Qwen](docs/install/qwen.md#roll-back-to-v1) guide, then open an [issue](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) with your `/ctx-doctor` report.

## Tools

| Tool | What it does |
|---|---|
| `ctx_execute` | Runs code or a shell command in a sandbox; returns only what it prints |
| `ctx_batch` | Runs many commands, indexes the output, and searches it in one call |
| `ctx_index` | Indexes a file, a text or a URL into the project database |
| `ctx_search` | Searches the index; returns the matching parts only |
| `ctx_resume` | Returns the state block, or one full row by `seq` |
| `ctx_stats` | Shows how much output stayed out of context |
| `ctx_doctor` | Checks the install; each FAIL line names its fix |
| `ctx_upgrade` | Installs, upgrades or uninstalls; removes v1 files |
| `ctx_purge` | Deletes indexed data by session, source or project |

Full reference: [docs/tools.md](docs/tools.md).

## Commands

| Command | What it does |
|---|---|
| `/ctx-stats` | Calls `ctx_stats` and shows the result |
| `/ctx-doctor` | Calls `ctx_doctor`; use its report when you open an issue |
| `/ctx-upgrade` | Calls `ctx_upgrade`, then `ctx_doctor` |

## How it works

Context Mode has two parts that run inside one agent session:

- **Hooks.** Four hooks: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`. They watch each tool call and log what happens.
- **MCP server.** The nine tools above. The agent calls them to do the same work without the flood.
- **One database per project.** One `context.db` file per project holds the index and the session log.
- **Run, then replace.** A host tool result over the cap is indexed whole. The agent gets the best-matching whole chunks and a `ctx_search` line for the rest (DECISIONS-r10). A `Read` of a file over the cap with no range is denied, and the deny message names the ways to read it.
- **State after compaction.** After a compaction, the agent gets a state block of at most 2 KB. It is built from the session log.

Read more: [docs/how-it-works.md](docs/how-it-works.md), [docs/algorithms.md](docs/algorithms.md) (search and ranking),
[docs/tools.md](docs/tools.md) (tool inputs). Size limits and deny rules are in docs/algorithms.md §1, §2 and §7.

## Benchmarks

Full publish pack with data files and reproduce commands: [docs/benchmarks/](docs/benchmarks/README.md). Only measured numbers. Each row names its source and date. Method and caveats: [docs/v2/benchmarks.md](docs/v2/benchmarks.md), [docs/v2/prompt/results.md](docs/v2/prompt/results.md), [docs/performance.md](docs/performance.md). Agent: Claude Code 2.1.303, claude-sonnet-5-5, effort low, keyless `claude -p`, unless a row says otherwise.

**Large output: what the model sees** (v2-design `980272a5`, 2026-10-21, [method](docs/v2/benchmarks.md#replace-live-proof-final)). The task runs `seq 1 N` and asks for the last number. 16 runs (4 sizes x git and non-git cwd x 2): no error, the model got a reply under 200 characters instead of the full output, and the answer was right 16 of 16.

| Full output (bytes) | 8,893 | 19,998 | 28,003 | 60,090 |
|---|---:|---:|---:|---:|
| Model saw (chars) | 152 | 187 | 182 | 190 |

**Saving score** (`bench/saving-score.mjs`, 3 runs, 2026-10-21, `980272a5`, lock hash OK). Median M1 94.21 (offline replay, bytes). Median M2 87.23 (live, tool_result bytes the model saw, median over json-1, multi-1, big-tests, big-json). Target 90: M1 met, M2 not met. M2 per run: 89.32, 85.83, 87.23; big-json moves most (74.5 to 86.6 %). `guardsOk` was false in all 3 runs: the gate guard failed on layer `check-removed`; the success, small-output and token guards passed. `bench/saving-score-last.json` still holds an older run (M2 84.02, 2026-10-20).

**Session tokens, off vs v1 vs v2** (`bench/live/results/ab-final2.json`, 2026-10-21, 81 sessions, 3 runs per task and arm, all sessions pass). A negative saving means the arm used more tokens than off.

| Group | Arm | Median session tokens | Saving vs off | Median tool_result bytes | Cost USD |
|---|---|---:|---:|---:|---:|
| Large (4 tasks) | off | 55,897 | - | 4,694.5 | 0.607 |
| Large | v1 | 65,599 | -16.5 % | 2,436.5 | 0.754 |
| Large | v2 | 60,390 | -19.6 % | 734.5 | 0.391 |
| Small (5 tasks) | off | 36,184 | - | 31 | 0.330 |
| Small | v1 | 42,493 | -17.4 % | 31 | 0.537 |
| Small | v2 | 38,210 | -5.7 % | 8 | 0.359 |

v2 cuts the bytes the model reads on large output (734.5 vs 4,694.5, 84 % fewer), but it does not cut session tokens in this run. Fixed cost: on tasks with tiny output the plugin adds about 2,000 tokens for v2 and about 6,300 for v1 (tool schemas and hooks). Per task, tokens off / v2: big-tests 53,104 / 38,359 (-28 %); multi-1 108,290 / 140,110 (+29 %); big-json 56,707 / 98,955 (+74 %). On those two the extra turns for 5 `ctx_*` calls cost more than the bytes saved. Not tuned yet. v2 vs v1: +10.2 % on small, -2.7 % on large.

**Other measured rows**

| What | Result | Source, date |
|---|---|---|
| Offline replay, old policy with hints (23175 tool calls, 820 sessions) | 1.1 % byte saving; -1.5 % with the re-run bound | benchmarks.md, 2026-10-19, Claude Code 2.1.149 to 2.1.283 transcripts |
| Live routing, under / over (20 large + 20 small per model) | under 0/20 on 3 models; over 0/20, 0/20, 1/20 (opus-5-5, sonnet-5-5, haiku-5-5) | prompt/results.md, 2026-10-19 |
| Claude Code hook p95 (GS6) | 41 ms, budget 40 ms: FAIL | TECH-SPEC §1.1, 2026-10-20, macOS, Node 26 |
| 64 KB PostToolUse hook p95 (`T-F1`) | 62 ms, budget 60 ms: FAIL | TECH-SPEC §1.1, 2026-10-20 |
| Memory live cases (`e2e/live/run.mjs --only`) | 4 of 4 PASS; fixture recall@5 1.000 on 6 queries (smoke gate, not an estimate); 0.0510 USD | benchmarks.md "Memory", 2026-10-21 |
| Compaction pointer (`T-CMP`, 10 sessions x 5 arms) | correct 10/10 in every arm after case-insensitive re-score (7/10 before); the model made 0 `ctx_resume`/`ctx_search` calls; gate open (GS11) | benchmarks.md, TECH-SPEC §1.1, 2026-10-21 |

## Privacy

- No telemetry. Context Mode sends no data about you or your code anywhere.
- No LLM calls. Context Mode never calls a model.
- All data stays in the `context.db` file of each project, on your machine.
- Network use is limited to `git ls-remote` (to check for a new version) and your agent's own git fetch when it installs or updates.
- `ctx_index` fetches a URL only when the agent asks for that URL.

## Issues and license

Open an [issue](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) with the full `/ctx-doctor` report.
Only v2 gets fixes. This repo does not take pull requests.

License: [Elastic License 2.0](LICENSE).
