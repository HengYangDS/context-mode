# Context Mode

Keeps large tool output out of your coding agent's context window.

[![clones](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmksglu%2Fcontext-mode%2Fmain%2Fmetrics%2Ftraffic.json&query=%24.clones.count&label=clones&color=blue)](https://github.com/mksglu/context-mode/graphs/traffic)
[![GitHub stars](https://img.shields.io/github/stars/mksglu/context-mode?style=flat&color=yellow)](https://github.com/mksglu/context-mode/stargazers)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)

> **v2 installs from git, not npm.**
> Coming from v1? See [Upgrading from v1](#upgrading-from-v1).

## What it does

A coding agent reads files, runs commands and fetches pages. Each result goes into its context window.
A big log or a large file fills that window fast, and the agent forgets what it was doing.
Context Mode stops the big output before it lands, keeps it on disk, and gives back only the part the agent asks for.

- **Sandbox tools.** The agent runs code and commands through `ctx_execute` and `ctx_batch`. Only the result it prints comes back.
- **One index per project, with search.** Full output goes into one local SQLite file per project. `ctx_search` finds the lines the agent needs.
- **State after compaction.** When the agent compacts its context, a small state block tells it what it was doing. `ctx_resume` reads any row in full.

See [docs/how-it-works.md](docs/how-it-works.md) for the full picture.

## Install

Pick your agent and follow its guide. A row shows a command only after a live install test on that agent passes.
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
You do not need npm. Each agent installs Context Mode from the `release` branch of this repo.

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

Only measured numbers. Each row names its source file and date. Full method and caveats: [docs/v2/benchmarks.md](docs/v2/benchmarks.md), [docs/v2/prompt/results.md](docs/v2/prompt/results.md), [docs/performance.md](docs/performance.md). Agent: Claude Code 2.1.303, claude-sonnet-5-5, effort low, unless a row says otherwise.

**Final A/B** (`bench/live/results/ab-final.json`, 2026-10-20). 54 sessions (3 runs x 6 tasks x 3 arms), all pass 18/18 per arm. Median session tokens: off 36,217; v1 42,557; v2 38,252.

| Arm | Pass | Saving vs off (median / min / max) | Median tool_result bytes | ctx calls | Cost USD |
|---|---|---|---|---|---|
| off | 18/18 | - | 46.5 | 0 | 0.534 |
| v1 | 18/18 | -17.5 / -61.3 / -15.1 % | 46.5 | 2 | 0.747 |
| v2 | 18/18 | -5.5 / -5.7 / +30.4 % | 31 | 3 | 0.687 |

v2 vs v1: +10.2 / +10.0 / +56.9 % (median / min / max). Total cost 1.97 USD. A negative saving means the arm used more tokens than off. On tasks where the model made no ctx call, the plugin adds a fixed prompt cost. v2 saves where the output is large (json-1 -30.4% vs off).

**Other measured rows**

| What | Result | Source, date |
|---|---|---|
| Saving loop score (M1 offline, M2 live) | M1 94.12, M2 88.9, guards pass; head 1d55d561f4cf62e5f8584c4958ee60522b012bd5. The 90 target was reached for M1, not for M2 | `bench/saving-score-last.json`, 2026-10-20 |
| Offline replay, bytes v2 would return vs bytes the model got (23175 tool calls, 820 sessions) | 1.1% saving; -1.5% with the re-run bound | benchmarks.md, 2026-10-19, Claude Code 2.1.149 to 2.1.283 transcripts |
| Live A/B, 20 tasks x 3 runs, session input saving (median) | -6.7% (min -6.9, max +29.7); pass on 60/60, off 60/60. Earlier v2 build, before the 2026-10-20 replace changes | benchmarks.md, 2026-10-19 |
| Live routing, under / over (run 4, 20 large + 20 small per model) | under 0/20 on all 3 models; over 0/20, 0/20, 1/20 (opus-5-5, sonnet-5-5, haiku-5-5) | prompt/results.md, 2026-10-19 |
| Claude Code hook p95 (GS6) | 41 ms, budget 40 ms: FAIL | TECH-SPEC §1.1, 2026-10-20, macOS, Node 26 |
| 64 KB PostToolUse hook p95 (`T-F1`) | 62 ms, budget 60 ms: FAIL | TECH-SPEC §1.1, 2026-10-20 |

**Memory** (`e2e/live/run.mjs --only`, one case per run, 2026-10-21): all 4 cases PASS.
- `memory-r6-eval-local`: PASS. The last-request seq matches ground truth in both fixtures. No model call.
- `memory-retrieval-local`: PASS. R2 recall@5 = 1.000 (6 of 6 queries), MRR 0.653. Timeline order-correct 2/2, paging-complete 2/2. Decision tag D3 precision 1.000, recall 1.000, 0 false positives. This is a fixture smoke gate (N = 6), not a real recall estimate.
- `memory-r6-resume-quality`: PASS (reply `TESTS`, 0.0075 USD). `decision-q3-applied`: PASS (reply `PASS`, 0.0435 USD). Total model spend 0.0510 USD for 2 sessions, under the 0.25 cap each.
- Stored real-data numbers, not re-run (private journals): R2 recall@5 0.743, MRR 0.671 (148 queries); R2 decision recall@5 0.744 (39 queries); timeline 43/47 order-correct; compaction v2 block open-error hit 11/12.

**Compaction pointer (`T-CMP`, 2026-10-21, Sonnet 5.5 low).** Clean isolation, 10 sessions per arm, all arms (a-e). Correct: 7/10 in every arm. `ctx_resume`/`ctx_search` call rate: 0/10 in every arm. Bytes returned by those tools: 0 in all 50 sessions. Cost per arm: a 0.8682, b 0.9114, c 0.9014, d 0.8898, e 0.9514 USD; total 4.5222 USD. The 15 misses are all fixture session-03 (case-sensitive exactMatch). This gate is still open: see TECH-SPEC §1.1 (GS11).

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
