# Install context-mode v2 on Qwen Code

This guide uses the Qwen Code extension install. It adds the MCP server and the four hooks (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse) from the release branch. You do not need `~/.context-mode-app`.

## Install

The same commands work in PowerShell (not run on Windows yet).

```sh
npm install -g @qwen-code/qwen-code
qwen extensions install https://github.com/mksglu/context-mode:context-mode --ref release --consent
```

`--consent` accepts the extension risk prompt, so the command does not stop to ask.

## Verify

```sh
qwen mcp list
qwen extensions list
```

`context-mode` must show as Connected, and `qwen extensions list` must show `context-mode (2.0.0)` with Ref `release`. Then run `/ctx-doctor` in Qwen Code, and `/hooks` to see the four context-mode hooks.

## Update

```sh
qwen extensions update context-mode
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

```sh
qwen extensions uninstall context-mode
```

If you used the older `qwen mcp add` method, also run:

```sh
qwen mcp remove -s user context-mode
rm -rf ~/.context-mode-app
```

## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 05e97724.

| Command | Qwen Code version | Date | Result |
|---|---|---|---|
| `qwen extensions install https://github.com/mksglu/context-mode:context-mode --ref release --consent` | 0.26.0 | 2026-10-22 | Pass: installed and enabled, server path `<home>/.qwen/extensions/context-mode/server.mjs` |
| `qwen mcp list` | 0.26.0 | 2026-10-22 | Pass: Connected |
| hook registration (`qwen -p` with `--debug`, no login) | 0.26.0 | 2026-10-22 | Pass: "Hook registry initialized with 4 hook entries"; SessionStart ran `hook.mjs` with `${CLAUDE_PLUGIN_ROOT}` set to the extension folder, exit 0 |
| `qwen extensions update context-mode` | 0.26.0 | 2026-10-22 | Pass: "already up to date" |
| `qwen extensions uninstall context-mode` | 0.26.0 | 2026-10-22 | Pass: extension folder removed, `qwen mcp list` empty |

Without `--consent`, the URL with no `:context-mode` suffix opens a plugin picker, so keep the suffix. Not run: a logged-in Qwen session, so `/ctx-doctor`, `/hooks` and the other three hooks did not run. Windows commands.
