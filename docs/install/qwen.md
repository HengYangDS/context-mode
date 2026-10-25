# Install context-mode v2 on Qwen Code

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for Qwen Code, the manual fallback, the known limits and what was checked.

## Install

What setup does for Qwen Code: Runs `qwen extensions link <package folder>` and answers its risk prompt with `y` on stdin, because Qwen has no consent flag. The extension ships the MCP server and four hooks (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse). Setup drops old context-mode hook commands from `~/.qwen/settings.json`.

It writes `~/.qwen/extensions/context-mode/` (link), `extension-store/state.json`. Hooks: shipped by the extension. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. The git route installs the extension from the `release` branch. Keep the `:context-mode` suffix: without `--consent` a URL with no suffix opens a plugin picker.

```sh
qwen extensions install https://github.com/mksglu/context-mode:context-mode --ref release --consent
```

Restart Qwen Code after the install.

## Verify

```sh
context-mode doctor --agents qwen
qwen extensions list
```

`context-mode` must be listed. `qwen mcp list` must show it Connected. Then run `/ctx-doctor` in Qwen Code, and `/hooks` to see the four context-mode hooks.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents qwen
```

Or run `context-mode upgrade --agents qwen`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- `qwen extensions update context-mode` updates a git-route install. A linked install updates when you run `npm i -g context-mode@next` again.
- No logged-in Qwen session ran `/ctx-doctor`, `/hooks` or the other three hooks.


## Uninstall

```sh
context-mode setup --remove --agents qwen
qwen extensions uninstall context-mode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents qwen`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | Qwen Code version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents qwen` | 0.26.0 | 2026-10-23 | Pass: `~/.qwen/extensions/context-mode/` (link), `extension-store/state.json` written |
| `context-mode setup --yes --agents qwen` (second run) | 0.26.0 | 2026-10-23 | Pass |
| `context-mode doctor --agents qwen` | 0.26.0 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 0.26.0 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in Qwen Code session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
