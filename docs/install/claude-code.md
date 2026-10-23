# Install context-mode v2 on Claude Code

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Claude Code, the manual fallback, the known limits and what was checked.

## Install

What setup does for Claude Code: Runs `claude plugin marketplace add` on the installed package folder, then `claude plugin install context-mode@context-mode`. The package carries `.claude-plugin/marketplace.json` and `plugin.json`, and the plugin ships the MCP server and the hooks. Setup also drops v1 hook commands from `~/.claude/settings.json`.

It writes `~/.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`) and `~/.claude.json`. Hooks: shipped by the plugin. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Adds the MCP server only. The hooks come with the plugin, so only `context-mode setup` gives you both.

```sh
claude mcp add -s user context-mode -- node "$(npm root -g)/context-mode/server.mjs" --agent claude-code
```

Restart Claude Code after the install.

## Verify

```sh
context-mode doctor --agents claude-code
claude plugin list
```

`context-mode@context-mode` must be listed and enabled. Then run `/ctx-doctor` in Claude Code.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents claude-code
```

Or run `context-mode upgrade --agents claude-code`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- The git route (`claude plugin marketplace add mksglu/context-mode`) works after the owner-only ADR-0011 step b (`marketplace.json` source -> github ref `release` on `main`). Setup does not use it; it adds the package folder from npm.
- No live, logged-in Claude Code session fired the hooks in any run.

## Upgrade from v1

Run the same two commands as a new install. Setup finds v1 entries first (`context-mode doctor` lists them). For Claude Code it drops the v1 hook commands (`context-mode hook ...`) from the host settings file, because the plugin or extension ships its own hooks. Setup backs up every file it touches under `~/.context-mode/backups`. See the [upgrade steps](./README.md#upgrade-from-v1).

## Rollback to v1

Run `context-mode setup --remove`, then install v1 with `npm install -g context-mode@1`. Then add the v1 entry for Claude Code as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

```sh
context-mode setup --remove --agents claude-code
claude plugin uninstall context-mode@context-mode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents claude-code`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Claude Code version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents claude-code` | 2.1.309 | 2026-10-23 | Pass: `~/.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`) and `~/.claude.json` written |
| `context-mode setup --yes --agents claude-code` (second run) | 2.1.309 | 2026-10-23 | Pass |
| `context-mode doctor --agents claude-code` | 2.1.309 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 2.1.309 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Claude Code session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
