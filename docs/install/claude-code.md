# Install context-mode v2 on Claude Code

## Install

```sh
npm i -g context-mode@next
context-mode setup --agents claude-code
```

With no terminal (a script or CI), add `--yes`: `context-mode setup --yes --agents claude-code`. Without it, setup stops with exit 2.

Restart Claude Code after setup.

Prefer to do it by hand? Run `context-mode setup --print claude-code` and follow what it prints.

## What setup changes

- Runs `claude plugin marketplace add` on the installed package folder, then `claude plugin install context-mode@context-mode`.
- The plugin brings the MCP server and the hooks.
- Removes old context-mode hook commands from `~/.claude/settings.json`.
- Backs up each file first. A failed step is rolled back byte for byte.
- Never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

## Verify

```sh
context-mode doctor --agents claude-code
claude plugin list
```

`context-mode@context-mode` must be listed and enabled. Then run `/ctx-doctor` in Claude Code.

## Remove

```sh
context-mode setup --remove --agents claude-code
```

It puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Known limits

- The git route (`claude plugin marketplace add mksglu/context-mode`) works after the owner-only ADR-0011 step b (`marketplace.json` source -> github ref `release` on `main`). Setup does not use it; it adds the package folder from npm.
- No live, logged-in Claude Code session fired the hooks in any run.
- `claude mcp add` by hand adds the MCP server only, with no hooks. Use `context-mode setup --print claude-code` instead.

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
