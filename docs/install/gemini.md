# Install context-mode v2 on Gemini CLI

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Gemini CLI, the manual fallback, the known limits and what was checked.

## Install

What setup does for Gemini CLI: Runs `gemini extensions link <package folder> --consent`. The extension ships the MCP server (`gemini-extension.json`) and the hooks (`hooks/hooks.json`). Setup uses `link`, not `install`, because `install <folder>` waits on a trust prompt and hangs (D-INST-1). It checks the result with `gemini extensions list`, which prints to stderr in 0.65.0 (D-INST-2). It drops old context-mode hook commands from `~/.gemini/settings.json`.

It writes `~/.gemini/extensions/context-mode/` (link), `extension-enablement.json`. Hooks: shipped by the extension. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. The git route installs the extension from the `release` branch. It updates by itself.

```sh
gemini extensions install https://github.com/mksglu/context-mode --ref release --consent
```

Restart Gemini CLI after the install.

## Verify

```sh
context-mode doctor --agents gemini
GEMINI_CLI_TRUST_WORKSPACE=true gemini mcp list
```

`gemini mcp list` does not ask about trust, so in an untrusted folder it shows `Disabled`. The variable above checks the server without that step. `context-mode` must show Connected. Then run `/ctx-doctor` in Gemini CLI.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents gemini
```

Or run `context-mode upgrade --agents gemini`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- `gemini extensions update context-mode` updates a git-route install. A linked install updates when you run `npm i -g context-mode@next` again.
- `hooks/hooks.json` has no SessionStart (D-FU-GCH-1). The resume hint comes on the first BeforeAgent of a session (D-FU-GCH-2).
- No live, logged-in Gemini session loaded the hooks in any run.


## Uninstall

```sh
context-mode setup --remove --agents gemini
gemini extensions uninstall context-mode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents gemini`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Gemini CLI version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents gemini` | 0.65.0 | 2026-10-23 | Pass: `~/.gemini/extensions/context-mode/` (link), `extension-enablement.json` written |
| `context-mode setup --yes --agents gemini` (second run) | 0.65.0 | 2026-10-23 | Pass |
| `context-mode doctor --agents gemini` | 0.65.0 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 0.65.0 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Gemini CLI session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).

Earlier git-route run, commit 05e97724, Gemini CLI 0.65.0, 2026-10-22: `gemini extensions install https://github.com/mksglu/context-mode --ref release --consent` Pass; `GEMINI_CLI_TRUST_WORKSPACE=true gemini mcp list` Pass: Connected; `tools/list` over stdio Pass: 9 tools. `gemini extensions update` and `uninstall` were not run.
