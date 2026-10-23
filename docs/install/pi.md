# Install context-mode v2 on Pi

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Pi, the manual fallback, the known limits and what was checked.

## Install

What setup does for Pi: Runs `pi install <package folder>`. Pi reads the `pi` key in the package `package.json` (`pi/index.js` and `skills`), so Pi gets the extension and the skills. Pi does not need an MCP entry.

It writes `~/.pi/agent/settings.json` (`packages`). Hooks: in-process extension. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. The git route installs from the `release` branch. `pi update --extensions` updates it.

```sh
pi install git:github.com/mksglu/context-mode@release
```

Restart Pi after the install.

## Verify

```sh
context-mode doctor --agents pi
pi list
```

The package must be listed. In a run with no login, Pi loads the extension and its hooks print a `hooks: no project: NO_PROJECT` line before the "No API key" error. That line shows the extension loaded.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents pi
```

Or run `context-mode upgrade --agents pi`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- Pi has no `/ctx-doctor` or `/ctx-upgrade` command (D-FU-RM-DOCS-1). Use `context-mode doctor` in a shell.
- No logged-in Pi session (needs an API key) fired a hook. The git-route runs below used commit 05e97724.

## Upgrade from v1

Run the same two commands as a new install. Setup finds v1 entries first (`context-mode doctor` lists them). For Pi it writes a new v2 entry. Setup backs up every file it touches under `~/.context-mode/backups`. See the [upgrade steps](./README.md#upgrade-from-v1).

## Rollback to v1

Run `context-mode setup --remove`, then install v1 with `npm install -g context-mode@1`. Then add the v1 entry for Pi as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

```sh
context-mode setup --remove --agents pi
pi remove git:github.com/mksglu/context-mode@release
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents pi`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Pi version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents pi` | 1.4.0 | 2026-10-23 | Pass: `~/.pi/agent/settings.json` (`packages`) written |
| `context-mode setup --yes --agents pi` (second run) | 1.4.0 | 2026-10-23 | Pass |
| `context-mode doctor --agents pi` | 1.4.0 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 1.4.0 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Pi session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).

Earlier git-route run, commit 05e97724, Pi 1.4.0, 2026-10-22: `pi install git:github.com/mksglu/context-mode@release` Pass; `pi list` Pass; `pi update --extensions` Pass; `pi remove` Pass; `/ctx-doctor` in Pi Fail (the command does not exist, D-FU-RM-DOCS-1).
