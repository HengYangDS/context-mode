# Install context-mode v2 on OpenCode

## Install

```sh
npm i -g context-mode@next
context-mode setup --agents opencode
```

With no terminal (a script or CI), add `--yes`: `context-mode setup --yes --agents opencode`. Without it, setup stops with exit 2.

Restart OpenCode after setup.

Prefer to do it by hand? Run `context-mode setup --print opencode` and follow what it prints.

## What setup changes

- Adds `mcp.context-mode` (`type: local`, `enabled: true`) to `~/.config/opencode/opencode.json`. Other keys stay.
- Writes no hooks.
- Backs up each file first. A failed step is rolled back byte for byte.
- Never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

## Verify

```sh
context-mode doctor --agents opencode
opencode mcp list
```

`context-mode` must show as connected. Then run `/ctx-doctor` in OpenCode.

## Remove

```sh
context-mode setup --remove --agents opencode
```

It puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Known limits

- Setup adds the hooks plugin to the `plugin` list in `~/.config/opencode/opencode.json`. On its first start after that, OpenCode installs `@opencode-ai/plugin` into `~/.config/opencode` (about 76 s on OpenCode 1.19.4, needs the network). The first `context-mode setup --agents opencode` can fail with "opencode mcp list does not list context-mode" and roll back. Run the same command again; it passes.

## Report a problem

Run `context-mode doctor --agents opencode`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | OpenCode version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents opencode` | 1.19.4 | 2026-10-23 | Pass: `~/.config/opencode/opencode.json` written |
| `context-mode setup --yes --agents opencode` (second run) | 1.19.4 | 2026-10-23 | Pass |
| `context-mode doctor --agents opencode` | 1.19.4 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 1.19.4 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in OpenCode session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
