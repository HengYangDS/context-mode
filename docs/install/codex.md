# Install context-mode v2 on Codex

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Codex, the manual fallback, the known limits and what was checked.

## Install

What setup does for Codex: Writes a `[mcp_servers.context-mode]` table to `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`) with the absolute `node` and `server.mjs` paths. It rewrites old context-mode hook commands in `~/.codex/hooks.json` to the absolute v2 form, but only if they exist.

It writes `~/.codex/config.toml`. Hooks: not written on a fresh HOME. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Adds the MCP server only.

```sh
codex mcp add context-mode -- node "$(npm root -g)/context-mode/server.mjs" --agent codex
```

Restart Codex after the install.

## Verify

```sh
context-mode doctor --agents codex
codex mcp list
```

`context-mode` must show as enabled. Then run `/ctx-doctor` in Codex.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents codex
```

Or run `context-mode upgrade --agents codex`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- On a fresh HOME setup does not create `~/.codex/hooks.json`. It writes only `config.toml`, so a new Codex install has the MCP server and no hooks (see [Verified](#verified), clean-HOME run).
- A Codex plugin install does not work yet: there is no `.agents/plugins/marketplace.json`.
- The shipped `hooks/codex.json` is a template: the writer fills the path; do not copy hooks/codex.json by hand.


## Uninstall

```sh
context-mode setup --remove --agents codex
codex mcp remove context-mode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

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
