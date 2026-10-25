# Install context-mode v2 on Copilot CLI

## Install

```sh
npm i -g context-mode@next
context-mode setup --agents copilot-cli
```

With no terminal (a script or CI), add `--yes`: `context-mode setup --yes --agents copilot-cli`. Without it, setup stops with exit 2.

Restart Copilot CLI after setup.

Prefer to do it by hand? Run `context-mode setup --print copilot-cli` and follow what it prints.

## What setup changes

- Runs `copilot mcp add context-mode`, which writes `~/.copilot/mcp-config.json`.
- Updates old context-mode hook commands in `~/.copilot/hooks/context-mode.json`, only if that file exists.
- Backs up each file first. A failed step is rolled back byte for byte.
- Never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

## Verify

```sh
context-mode doctor --agents copilot-cli
copilot mcp list
```

`context-mode` must be listed. Then run `/ctx-doctor` in Copilot CLI.

## Remove

```sh
context-mode setup --remove --agents copilot-cli
```

It puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Known limits

- On a fresh HOME setup writes `~/.copilot/mcp-config.json` only; no hook file.
- The plugin install does not work yet: the release branch has no `marketplace.json` for Copilot.
- The shipped `hooks/copilot-cli.json` is a template: the writer fills the path; do not copy hooks/copilot-cli.json by hand.

## Report a problem

Run `context-mode doctor --agents copilot-cli`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Copilot CLI version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents copilot-cli` | 1.0.103 | 2026-10-23 | Pass: `~/.copilot/mcp-config.json` written |
| `context-mode setup --yes --agents copilot-cli` (second run) | 1.0.103 | 2026-10-23 | Pass |
| `context-mode doctor --agents copilot-cli` | 1.0.103 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 1.0.103 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Copilot CLI session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
