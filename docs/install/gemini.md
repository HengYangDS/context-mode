# Install context-mode v2 on Gemini CLI

This guide adds the MCP server with `gemini mcp add`. This gives the context-mode tools, but no hooks.

The extension install (`gemini extensions install https://github.com/mksglu/context-mode --ref release`) is the better method, because it also adds the hooks and updates by itself. It does not work yet: the release build has a relative server path in `gemini-extension.json` and no `hooks/hooks.json`, so the server shows as Disconnected. This guide will move to it when the build is fixed.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
npm install -g @google/gemini-cli
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
gemini mcp add -s user context-mode node "$HOME/.context-mode-app/server.mjs" --agent gemini
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g @google/gemini-cli
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
gemini mcp add -s user context-mode node "$env:USERPROFILE\.context-mode-app\server.mjs" --agent gemini
```

Gemini turns off all MCP servers in a folder you have not trusted. Trust the folder when Gemini asks.

## Verify

```sh
gemini mcp list
```

`context-mode` must show as Connected. Then run `/ctx-doctor` in Gemini CLI.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Gemini CLI.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Gemini CLI, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Gemini CLI as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
gemini mcp remove -s user context-mode
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
gemini mcp remove -s user context-mode
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Gemini CLI version | Date | Result |
|---|---|---|---|
| `gemini mcp add -s user context-mode node "$HOME/.context-mode-app/server.mjs" --agent gemini` | 0.65.0 | 2026-10-21 | Pass: settings.json has the real path |
| `gemini mcp list` | 0.65.0 | 2026-10-21 | Pass: Connected |
| `gemini extensions install https://github.com/mksglu/context-mode --ref release` | 0.65.0 | 2026-10-21 | Fail: installs, but server Disconnected and no hooks |

Not run: hooks (this method has none). A live Gemini session (needs a login). `gemini mcp remove` and Windows commands.

## Sources

- https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md
- https://github.com/google-gemini/gemini-cli
