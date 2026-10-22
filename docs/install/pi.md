# Install context-mode v2 on Pi

Pi installs context-mode as a package straight from the release branch. Pi does not need `~/.context-mode-app`.

The release branch has a `package.json` with a `pi` key that points at `pi/index.js` and `skills`. Pi has no `/ctx-doctor` or `/ctx-upgrade` command. Not proven yet: that a logged-in Pi session fires the hooks.

## Install

```sh
npm install -g @earendil-works/pi-coding-agent
pi install git:github.com/mksglu/context-mode@release
```

The same commands work in PowerShell (not run on Windows yet).

## Verify

```sh
pi list
```

`git:github.com/mksglu/context-mode@release` must be listed. In a run with no login, Pi loads the extension and its hooks print a `hooks: no project: NO_PROJECT` line before the "No API key" error. That line shows the extension loaded.

## Update

```sh
pi update --extensions
```

Plain `pi update` skips packages: it updates only Pi itself.


## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. Remove the v1 entry `"npm:context-mode"` from `packages[]` in `~/.pi/agent/settings.json` by hand.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Pi as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

```sh
pi remove git:github.com/mksglu/context-mode@release
```


## Report a problem

Run `pi list` and `pi --version`. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste both outputs.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 05e97724.

| Command | Pi version | Date | Result |
|---|---|---|---|
| `npm install -g @earendil-works/pi-coding-agent` | 1.4.0 | 2026-10-22 | Pass |
| `pi install git:github.com/mksglu/context-mode@release` | 1.4.0 | 2026-10-22 | Pass: cloned to `$HOME/.pi/agent/git/`, HEAD 05e97724 |
| `pi list` | 1.4.0 | 2026-10-22 | Pass: package listed |
| load `pi/index.js` with a stub API | 1.4.0 | 2026-10-22 | Pass: handlers on `before_agent_start`, `input`, `tool_call`, `tool_result`, `session_compact`; no `registerCommand` |
| `pi -p` with no login | 1.4.0 | 2026-10-22 | Pass: hooks printed `hooks: no project: NO_PROJECT`, then "No API key" |
| `pi update --extensions` (checkout set one commit back first) | 1.4.0 | 2026-10-22 | Pass: moved to 05e97724 |
| `pi remove git:github.com/mksglu/context-mode@release` | 1.4.0 | 2026-10-22 | Pass: `pi list` printed "No packages installed." |
| `/ctx-doctor` in Pi | 1.4.0 | 2026-10-22 | Fail: the command does not exist in the extension (D-FU-RM-DOCS-1) |

Not run: a logged-in Pi session (needs an API key), so no tool call and no hook fired in a real session. The Upgrade from v1 and Rollback to v1 steps. Windows commands.
