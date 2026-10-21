# Install context-mode v2 on Pi

Pi installs context-mode as a package straight from the release branch. Pi does not need `~/.context-mode-app`.

Not proven yet: that Pi loads the context-mode extension after the install. The release branch has no `package.json` with a `pi` key, so Pi may install the package and still load nothing. `pi list` shows only that the package is there.

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

`git:github.com/mksglu/context-mode@release` must be listed. Then start Pi and run `/ctx-doctor`. If Pi does not know `/ctx-doctor`, the extension did not load: [report it](#report-a-problem).

## Update

```sh
pi update --extensions
```

Plain `pi update` skips packages: it updates only Pi itself.


## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Pi, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
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

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Pi version | Date | Result |
|---|---|---|---|
| `npm install -g @earendil-works/pi-coding-agent` | 1.3.0 | 2026-10-22 | Pass |
| `pi install git:github.com/mksglu/context-mode@release` | 1.3.0 | 2026-10-22 | Pass: cloned and added |
| `pi list` | 1.3.0 | 2026-10-22 | Pass: package listed |
| `pi update --extensions` (checkout set one commit back first) | 1.3.0 | 2026-10-22 | Pass: moved to 0438537 |
| `pi update` | 1.3.0 | 2026-10-21 | Fail: "Extensions are skipped", checkout did not move |
| `pi remove git:github.com/mksglu/context-mode@release` | 1.3.0 | 2026-10-22 | Pass |

Not run: a live Pi session (needs a login), so no run showed Pi load `pi/index.js` or list the context-mode tools. The release branch has no `package.json` and no `extensions/` folder, so Pi may install the package and load nothing. Windows commands.
