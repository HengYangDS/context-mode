# Install context-mode v2 on Kiro

## Install

```sh
npm i -g context-mode@next
context-mode setup --agents kiro
```

Restart Kiro after setup.

Prefer to do it by hand? Run `context-mode setup --print kiro` and follow what it prints.

## What setup changes

- Adds the `context-mode` entry to `~/.kiro/settings/mcp.json`. Other servers stay.
- Writes no hooks.
- Backs up each file first. A failed step is rolled back byte for byte.
- Never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

## Verify

```sh
context-mode doctor --agents kiro
```

Run `/ctx-doctor` in Kiro. Run `kiro-cli doctor -a` if the tools do not show.

## Remove

```sh
context-mode setup --remove --agents kiro
```

It puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Known limits

- Setup writes no hook file. The hook file `~/.kiro/hooks/context-mode.json` is not part of the setup run.
- Kiro has no npm package, so no run showed Kiro load the server or fire a hook.

## Report a problem

Run `context-mode doctor --agents kiro`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Kiro version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents kiro` | not installed | 2026-10-23 | Pass: `~/.kiro/settings/mcp.json` written |
| `context-mode setup --yes --agents kiro` (second run) | not installed | 2026-10-23 | Pass |
| `context-mode doctor --agents kiro` | not installed | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | not installed | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Kiro was not installed, so a Pass here means the config entry and the MCP handshake checked out, not that Kiro loaded the server. See [CLI report](../v2/CLI-REPORT.md) and the [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md). Windows commands are not run.
