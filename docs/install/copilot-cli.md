# Install context-mode v2 on Copilot CLI

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Copilot CLI, the manual fallback, the known limits and what was checked.

## Install

What setup does for Copilot CLI: Runs `copilot mcp add context-mode -- node <package>/server.mjs --agent copilot-cli`. It rewrites old context-mode hook commands in `~/.copilot/hooks/context-mode.json` to the absolute v2 form, but only if that file exists.

It writes `~/.copilot/mcp-config.json`. Hooks: not written on a fresh HOME. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Same command that setup runs, with the package path filled by `npm root -g`.

```sh
copilot mcp add context-mode -- node "$(npm root -g)/context-mode/server.mjs" --agent copilot-cli
```

Restart Copilot CLI after the install.

## Verify

```sh
context-mode doctor --agents copilot-cli
copilot mcp list
```

`context-mode` must be listed. Then run `/ctx-doctor` in Copilot CLI.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents copilot-cli
```

Or run `context-mode upgrade --agents copilot-cli`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- On a fresh HOME setup writes `~/.copilot/mcp-config.json` only; no hook file.
- The plugin install does not work yet: the release branch has no `marketplace.json` for Copilot.
- The shipped `hooks/copilot-cli.json` is a template: the writer fills the path; do not copy hooks/copilot-cli.json by hand.


## Uninstall

```sh
context-mode setup --remove --agents copilot-cli
copilot mcp remove context-mode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

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
