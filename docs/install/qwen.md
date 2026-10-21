# Install context-mode v2 on Qwen Code

This guide adds the MCP server with `qwen mcp add`. This gives the context-mode tools, but no hooks.

The extension install (`qwen extensions install https://github.com/mksglu/context-mode:context-mode --ref release`) is the better method. It does not work yet: the release build has a relative server path in `qwen-extension.json` and no hooks entry, so the server shows as Disconnected. This guide will move to it when the build is fixed.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
npm install -g @qwen-code/qwen-code
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
qwen mcp add -s user context-mode node "$HOME/.context-mode-app/server.mjs" --agent qwen
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g @qwen-code/qwen-code
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
qwen mcp add -s user context-mode node "$env:USERPROFILE\.context-mode-app\server.mjs" --agent qwen
```


## Verify

```sh
qwen mcp list
```

`context-mode` must show as Connected. Then run `/ctx-doctor` in Qwen Code.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Qwen Code.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Qwen Code, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Roll back to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Qwen Code as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
qwen mcp remove -s user context-mode
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
qwen mcp remove -s user context-mode
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Qwen Code version | Date | Result |
|---|---|---|---|
| `qwen mcp add -s user context-mode node "$HOME/.context-mode-app/server.mjs" --agent qwen` | 0.25.3 | 2026-10-21 | Pass |
| `qwen mcp list` | 0.25.3 | 2026-10-21 | Pass: Connected |
| `qwen extensions install https://github.com/mksglu/context-mode:context-mode --ref release` | 0.25.3 | 2026-10-21 | Fail: installs, but server Disconnected and no hooks |
| `qwen mcp remove -s user context-mode` | 0.25.3 | 2026-10-21 | Pass |

Not run: hooks (this method has none). A live Qwen session (needs a login). Windows commands.
