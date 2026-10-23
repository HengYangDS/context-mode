# Install context-mode v2

Two commands install context-mode v2 for every agent on your machine. Setup finds your agents, shows a plan, applies it, then checks each agent (MCP handshake, one hook call). A failed agent is rolled back byte for byte.

## Requirements

- Node 24.15.0 or later. v2 uses the built-in `node:sqlite`.
- npm.
- At least one supported agent. Run `context-mode setup --list` to see which ones work.

## Install

```sh
npm i -g context-mode@next && context-mode setup
```

`@next` is the v2 preview. After the owner moves the `latest` tag, you run `npm i -g context-mode && context-mode setup` without `@next`. Until then a plain `npm i -g context-mode` still installs v1.

Restart your agent after setup. Then run `/ctx-doctor` in the agent, or `context-mode doctor` in a shell.

## What setup does

1. Finds each agent: its command on `PATH` or its config folder.
2. Shows the plan: for each agent, the exact command it will run or the exact file change.
3. Asks once, then applies. `--yes` skips the question.
4. Checks each agent: the config entry, v1 leftovers, an MCP handshake, one hook call.
5. Rolls back any agent that fails, and prints a `gh issue create` command with a report file.

Setup backs up every file it touches under `~/.context-mode/backups`. It writes only the files in the plan. It never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Run it again at any time. A second run changes nothing (checked in [Verified](#verified)).

## Options

| Command | Use |
|---|---|
| `context-mode setup --list` | Print every supported agent and whether it is found. Changes nothing. |
| `context-mode setup --dry-run` | Show the plan. Changes nothing. |
| `context-mode setup --yes --agents codex,claude-code` | Do not ask; only these agents. |
| `context-mode setup --json` | JSON only on stdout, for scripts. |
| `context-mode doctor` | Check every agent. Changes nothing. |
| `context-mode upgrade` | Run `npm i -g context-mode@<tag>`, then `setup --repair`. |

Exit codes: 0 success, 1 a check or step failed, 2 usage error or an answer is needed with no TTY, 130 Ctrl-C.

## Agents

Each page lists what setup does for that agent, the manual fallback, known limits and what was checked.

| Agent | Page | What setup runs | Checked in a clean HOME |
|---|---|---|---|
| Claude Code | [claude-code.md](./claude-code.md) | `claude plugin marketplace add` + `plugin install` | yes, 2.1.309 |
| Codex | [codex.md](./codex.md) | writes `~/.codex/config.toml` (no hooks on a fresh HOME) | yes, 0.164.0 |
| Copilot CLI | [copilot-cli.md](./copilot-cli.md) | `copilot mcp add` | yes, 1.0.103 |
| Gemini CLI | [gemini.md](./gemini.md) | `gemini extensions link --consent` | yes, 0.65.0 |
| Kiro | [kiro.md](./kiro.md) | writes `~/.kiro/settings/mcp.json` | config only: Kiro not installed |
| OpenCode | [opencode.md](./opencode.md) | writes `opencode.json` (no hooks) | yes, 1.19.4 |
| Pi | [pi.md](./pi.md) | `pi install <package folder>` | yes, 1.4.0 |
| Qwen Code | [qwen.md](./qwen.md) | `qwen extensions link` | yes, 0.26.0 |
| VS Code (Copilot) | [vscode.md](./vscode.md) | writes `~/.vscode/mcp.json` | config only: VS Code not run |
| ZCode | [zcode.md](./zcode.md) | writes `~/.zcode/cli/config.json` (no hooks) | config only: ZCode not installed |

"Checked in a clean HOME" means the command ran on macOS with a temporary HOME against the npm-packed build, the agent CLI was installed in a temporary prefix, and setup, a second setup, doctor and remove all passed. It does not mean a logged-in agent session fired the hooks: no run did that. No page is checked on Windows.

The git `release` branch stays for two routes: the Claude Code marketplace (ADR-0011 step b) and the Gemini and Qwen git-route extension install. Setup does not need it. See [ADR-0019](../v2/adr/0019-interactive-setup-and-npm-channel.md).

## Upgrade from v1

Run the same two commands. Setup lists the v1 entries it finds, then:

- Claude Code, Gemini, Qwen: drops v1 hook commands (`context-mode hook ...`) from the host settings file. The plugin or extension ships its own hooks, and a v1 copy would run twice.
- Codex, Copilot CLI: rewrites a v1 hook command to the absolute v2 form, if the hook file exists.
- Other agents: writes a new v2 entry.

Do not run `npm uninstall -g context-mode` before setup. v1 hooks call the global `context-mode` command, and the v2 package uses the same name, so `npm i -g context-mode@next` replaces the v1 package under the same name.  For the feature changes and the rollback table, see [Upgrading from v1](../../README.md#upgrading-from-v1).

## Uninstall

```sh
context-mode setup --remove && npm rm -g context-mode
```

`setup --remove` puts each touched file back. It reports what it restored.

## Troubleshooting

Run `context-mode doctor`. It checks each agent and changes nothing. On a TTY, a failed agent gets one question: fix now.

A failed check prints the agent, the reason, a fix command, and a `gh issue create` command. The report file is under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste it.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME per run, npm-packed build of commit 5c41eb61. Seven agent CLIs were installed in a temporary prefix: Claude Code 2.1.309, Codex 0.164.0, Copilot CLI 1.0.103, Gemini CLI 0.65.0, OpenCode 1.19.4, Pi 1.4.0, Qwen Code 0.26.0.

| Step | Date | Result |
|---|---|---|
| `context-mode setup --yes --agents <all seven>` | 2026-10-23 | Pass: 7 of 7 |
| the same command again | 2026-10-23 | Pass: no change |
| `context-mode doctor --agents <all seven>` | 2026-10-23 | Pass: 7 of 7 |
| `context-mode setup --remove --yes` | 2026-10-23 | Pass: touched files restored (`Restored N file(s).`) |

The first run failed, and the failures were real defects. All four are fixed and logged in [DEVIATIONS](../v2/impl/DEVIATIONS.md):

| Defect | Row |
|---|---|
| `gemini extensions install <folder>` hangs on a trust prompt; Qwen needs `link` with `y` on stdin | D-INST-1 |
| Gemini 0.65.0 prints its extension list to stderr, so the list check failed | D-INST-2 |
| The npm package had no `.claude-plugin/marketplace.json`, and Claude Code needs an `owner` object in it | D-INST-3 |
| Install-docs checker had no rule for CLI flags or page content | D-INST-4 |

Open: Kiro, VS Code and ZCode were not installed, so their rows prove the config entry and handshake only. No logged-in agent session fired a hook. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [manifest tests](../../tests/v2/build/manifests.test.mjs).
