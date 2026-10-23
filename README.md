# Context Mode

[![clones](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmksglu%2Fcontext-mode%2Fmain%2Fmetrics%2Ftraffic.json&query=%24.clones.count&label=clones&color=blue)](https://github.com/mksglu/context-mode/graphs/traffic)
[![GitHub stars](https://img.shields.io/github/stars/mksglu/context-mode?style=flat&color=yellow)](https://github.com/mksglu/context-mode/stargazers)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)

Context Mode is a free plugin that keeps large tool output out of your coding agent's context window.

## The problem

A coding agent reads files, runs commands and fetches pages. Each result goes into its context window.
A big log or a large file fills that window fast, and the agent forgets what it was doing.
Context Mode stops the big output before it lands, keeps it on disk, and gives back only the part the agent asks for.

- **Sandbox tools.** The agent runs code and commands through `ctx_execute` and `ctx_batch`. Only the result it prints comes back.
- **One index per project, with search.** Full output goes into one local SQLite file per project. `ctx_search` finds the lines the agent needs.
- **State after compaction.** When the agent compacts its context, a small state block tells it what it was doing. `ctx_resume` reads any row in full.

## Install

Two commands. You need Node 24.15.0 or later (v2 uses the built-in `node:sqlite`).

```sh
npm i -g context-mode@next && context-mode setup
```

`@next` is the v2 preview. A plain `npm i -g context-mode` installs v1 until v2 moves to `latest`.
Setup finds your agents, shows a plan, applies it, and checks each agent. It rolls back an agent that fails.
Restart the agent, then run `/ctx-doctor` in it. Each check prints PASS, or FAIL with the command that fixes it.
Uninstall: `context-mode setup --remove && npm rm -g context-mode`. Details: [docs/install/README.md](docs/install/README.md).

**full** = setup installs the hooks and the MCP server. **MCP only** = setup adds the MCP server; the agent page says why there are no hooks.

<!-- agents:install:start (node build/readme-agents.mjs --write) -->
| Agent | Support | Guide |
|---|---|---|
| Claude Code | full | [docs/install/claude-code.md](docs/install/claude-code.md#install) |
| Codex | MCP only | [docs/install/codex.md](docs/install/codex.md#install) |
| Copilot CLI | MCP only | [docs/install/copilot-cli.md](docs/install/copilot-cli.md#install) |
| Gemini CLI | full | [docs/install/gemini.md](docs/install/gemini.md#install) |
| Kiro | MCP only | [docs/install/kiro.md](docs/install/kiro.md#install) |
| OpenCode | MCP only | [docs/install/opencode.md](docs/install/opencode.md#install) |
| Pi | full | [docs/install/pi.md](docs/install/pi.md#install) |
| Qwen Code | full | [docs/install/qwen.md](docs/install/qwen.md#install) |
| VS Code (Copilot) | MCP only | [docs/install/vscode.md](docs/install/vscode.md#install) |
| ZCode | MCP only | [docs/install/zcode.md](docs/install/zcode.md#install) |
<!-- agents:install:end -->

The table comes from `src/adapters/table.ts` and `src/setup/registry.ts`; `build/check-readme.mjs` fails when it differs.

## Upgrading from v1

Do these steps in one sitting:

1. Install v2 with `npm i -g context-mode@next && context-mode setup`. Setup finds the v1 entries and removes or rewrites them.
2. Restart the agent. Run `/ctx-doctor`. If it lists v1 files, run `/ctx-upgrade`, then restart again.

Do not run `npm uninstall -g context-mode`. The v1 hooks for Copilot CLI, VS Code, Codex, Gemini and Kiro call the global `context-mode` binary, and `npm i -g context-mode@next` replaces that binary under the same name.

<!-- agents:upgrade:start (node build/readme-agents.mjs --write) -->
| Agent | Support | Guide |
|---|---|---|
| Claude Code | full | [docs/install/claude-code.md](docs/install/claude-code.md#upgrade-from-v1) |
| Codex | MCP only | [docs/install/codex.md](docs/install/codex.md#upgrade-from-v1) |
| Copilot CLI | MCP only | [docs/install/copilot-cli.md](docs/install/copilot-cli.md#upgrade-from-v1) |
| Gemini CLI | full | [docs/install/gemini.md](docs/install/gemini.md#upgrade-from-v1) |
| Kiro | MCP only | [docs/install/kiro.md](docs/install/kiro.md#upgrade-from-v1) |
| OpenCode | MCP only | [docs/install/opencode.md](docs/install/opencode.md#upgrade-from-v1) |
| Pi | full | [docs/install/pi.md](docs/install/pi.md#upgrade-from-v1) |
| Qwen Code | full | [docs/install/qwen.md](docs/install/qwen.md#upgrade-from-v1) |
| VS Code (Copilot) | MCP only | [docs/install/vscode.md](docs/install/vscode.md#upgrade-from-v1) |
| ZCode | MCP only | [docs/install/zcode.md](docs/install/zcode.md#upgrade-from-v1) |
<!-- agents:upgrade:end -->

| v1 feature | v2 | Why / what to use now |
|---|---|---|
| `statusline` (`context-mode statusline`) | Removed | `ctx_doctor` and `ctx_stats` show the same numbers in the agent |
| The `context-mode` CLI | Changed | Only `setup`, `doctor` and `upgrade`; in the agent use `/ctx-stats`, `/ctx-doctor`, `/ctx-upgrade` |
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

v1 memory rows are not moved into v2. To go back to v1, first run `context-mode setup --remove`, then the command for your agent:

| Agent | Rollback |
|---|---|
| Claude Code | `npm install -g context-mode@1`, then `claude plugin uninstall context-mode@context-mode` |
| Codex | `npm install -g context-mode@1`, put the v1 entry (`npx -y context-mode mcp`) back in `[mcp_servers.context-mode]` of `config.toml`, add the v1 `hooks.json` entries again, then restart Codex |
| Gemini | `gemini extensions uninstall context-mode`, then add by hand to `~/.gemini/settings.json`: `"mcpServers": {"context-mode": {"command": "npx", "args": ["-y", "context-mode", "mcp"]}}` |
| Qwen Code | Same as Gemini, in `~/.qwen/settings.json` |
| Copilot CLI | `copilot plugin uninstall context-mode`, `copilot mcp remove context-mode`, `npm install -g context-mode@1`, then make `~/.copilot/hooks/context-mode.json` again with the v1 install step |
| VS Code | Delete the v2 `context-mode` entry in `.vscode/mcp.json`, `npm install -g context-mode@1`, then make `<project>/.github/hooks/context-mode.json` again with the v1 install step |
| Kiro | Remove the v2 entry in `~/.kiro/settings/mcp.json` and the v2 hook file, `npm install -g context-mode@1`, then add the `.hooks.*` entries in `~/.kiro/agents/default.json` again with the v1 install step |
| Pi | Remove the git entry from `packages[]` in `~/.pi/agent/settings.json`, then add `"npm:context-mode"` |
| OpenCode | `npm install -g context-mode@1`, delete `mcp.context-mode` and the v2 plugin file in `plugins/`, then add `"context-mode"` to `.plugin[]` |
| ZCode | `npm install -g context-mode@1`, then make the `~/.zcode/cli/hooks.json` entry again with the v1 install step |

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

## Results against v1

Every number links to a file in this repo. Full page with all rows: [docs/benchmarks/v2-vs-v1/README.md](docs/benchmarks/v2-vs-v1/README.md).

| What | v1 | v2 | Source |
|---|---|---|---|
| Cost vs Claude Code alone, six short tasks (Opus 5.5) | +34.6 % | +2.2 % | [v1-v2-gateway](docs/benchmarks/v1-v2-gateway/README.md) |
| Search: held-out recall@5 / MRR@10 (50 queries) | 0.84 / 0.76 | 0.98 / 0.827 | [DIAGNOSIS §8](docs/v2/spikes/search/DIAGNOSIS.md#8-verbatim-fence-aware-snippets-d-search-7-2026-10-23-node-26-macos) |
| Search: code blocks whole in replies | 21 / 70 | 42 / 70 | same |
| Large output, median tool_result bytes (Sonnet 5.5; no plugin: 4,694.5) | 2,436.5 | 734.5 | [ab-final2.json](docs/benchmarks/data/ab-final2.json) |
| Install | npm, then a config entry and a hook file per agent | 2 commands | [CLI-REPORT.md](docs/v2/CLI-REPORT.md) |

Where v2 is not better ([full list](docs/benchmarks/v2-vs-v1/README.md#where-v2-is-not-better)):

- On short tasks v2 still costs more than no plugin: +2.2 % on six tasks, +15.5 % on the try-it prompts. The tools and hooks add about 2,000 tokens per session.
- Search is slower than v1 (p95 11.2-11.8 ms vs 7.7 ms on +1 MB) and returns more bytes.
- The Claude Code hook p95 is 41 ms against a 40 ms budget: FAIL.
- Session tokens on large tasks are not settled: one run shows 19.6 % more than no plugin, a later run 3.8 % fewer.
- 27 issue rows have no decision yet ([ISSUE-COVERAGE.md](docs/v2/ISSUE-COVERAGE.md)).

## Context Mode Gateway (paid)

The Gateway is the paid plan. It sits between the agent and the model API: you set `ANTHROPIC_BASE_URL` to it, and the model needs no plugin tool calls.
On the same six short tasks it cost 24.5 % less than Claude Code alone (84 of 88 pairs cost less).
Loss: on the try-it prompts it passed the task check in 15 of 20 sessions; direct passed 20 of 20.
Requests go through the Gateway server, so it is not local only. [Measured rows](docs/benchmarks/v2-vs-v1/README.md#context-mode-gateway-the-upgrade-path), [plans](https://context-mode.com/pricing).

## Privacy

- No telemetry. Context Mode sends no data about you or your code anywhere.
- No LLM calls. Context Mode never calls a model.
- All data stays in the `context.db` file of each project, on your machine.
- Network use: npm when you install or upgrade, `git ls-remote` in doctor (to check for a new version), and your agent's own install steps.
- `ctx_index` fetches a URL only when the agent asks for that URL.

## Docs

- [docs/install/README.md](docs/install/README.md): install, options, uninstall, troubleshooting.
- [docs/how-it-works.md](docs/how-it-works.md), [docs/algorithms.md](docs/algorithms.md) (search, ranking, size limits, deny rules), [docs/tools.md](docs/tools.md).
- [docs/benchmarks/](docs/benchmarks/README.md): all benchmarks, with data files and reproduce commands.
- [docs/v2/OPEN-ITEMS.md](docs/v2/OPEN-ITEMS.md): known gaps.

## Issues and license

Open an [issue](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) with the full `/ctx-doctor` report.
Only v2 gets fixes. This repo does not take pull requests.

License: [Elastic License 2.0](LICENSE).
