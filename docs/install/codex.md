# Install context-mode v2 on Codex

## Install

```sh
npm i -g context-mode@next
context-mode setup --agents codex
```

With no terminal (a script or CI), add `--yes`: `context-mode setup --yes --agents codex`. Without it, setup stops with exit 2.

Restart Codex after setup.

Prefer to do it by hand? Run `context-mode setup --print codex` and follow what it prints.

## What setup changes

- Adds a `[mcp_servers.context-mode]` table to `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`).
- Updates old context-mode hook commands in `~/.codex/hooks.json`, only if they exist.
- Backs up each file first. A failed step is rolled back byte for byte.
- Never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

## Verify

```sh
context-mode doctor --agents codex
codex mcp list
```

`context-mode` must show as enabled. The Auth column may say `Unsupported`: that is normal, because the server needs no login. Then run `/ctx-doctor` in Codex.

## Remove

```sh
context-mode setup --remove --agents codex
```

It puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Known limits

- On a fresh HOME setup does not create `~/.codex/hooks.json`. It writes only `config.toml`, so a new Codex install has the MCP server and no hooks (see [Verified](#verified), clean-HOME run).
- A Codex plugin install does not work yet: there is no `.agents/plugins/marketplace.json`.
- The shipped `hooks/codex.json` is a template: the writer fills the path; do not copy hooks/codex.json by hand.

## Report a problem

Run `context-mode doctor --agents codex`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Codex version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents codex` | 0.164.0 | 2026-10-23 | Pass: `~/.codex/config.toml` written |
| `context-mode setup --yes --agents codex` (second run) | 0.164.0 | 2026-10-23 | Pass |
| `context-mode doctor --agents codex` | 0.164.0 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 0.164.0 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Codex session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
