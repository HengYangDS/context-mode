# Install context-mode v2 on Gemini CLI

This guide installs the extension. It adds the MCP server and the hooks, and it updates by itself.

## Install

macOS / Linux:

```sh
npm install -g @google/gemini-cli
gemini extensions install https://github.com/mksglu/context-mode --ref release --consent
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g @google/gemini-cli
gemini extensions install https://github.com/mksglu/context-mode --ref release --consent
```

Gemini turns off all MCP servers in a folder you have not trusted. Start `gemini` once in your project folder and choose to trust it.

## Verify

`gemini mcp list` does not ask about trust, so in an untrusted folder it shows `Disabled`. This command checks the server without that step:

macOS / Linux:

```sh
GEMINI_CLI_TRUST_WORKSPACE=true gemini mcp list
```

Windows (PowerShell), not run on Windows yet:

```powershell
$env:GEMINI_CLI_TRUST_WORKSPACE="true"; gemini mcp list; Remove-Item Env:GEMINI_CLI_TRUST_WORKSPACE
```

`context-mode` must show as Connected, from the extension `context-mode`. Then start `gemini` in a trusted folder and run `/ctx-doctor`.

## Update

```sh
gemini extensions update context-mode
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

```sh
gemini extensions uninstall context-mode
```

If you used the older `gemini mcp add` method, also run:

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

Tested on macOS with a temporary HOME, against the release branch, commit 05e97724.

| Command | Gemini CLI version | Date | Result |
|---|---|---|---|
| `gemini extensions install https://github.com/mksglu/context-mode --ref release --consent` | 0.65.0 | 2026-10-22 | Pass: installed; `hooks/hooks.json` registers BeforeTool, AfterTool, BeforeAgent |
| `gemini extensions link <local copy of release-out> --consent`, `extensions list`; BeforeTool and BeforeAgent hook command run by hand | 0.65.0 | 2026-10-22 | Pass: linked and enabled; hooks exit 0. `hooks/hooks.json` has no SessionStart (D-FU-GCH-1), so no resume hint at session start |
| `GEMINI_CLI_TRUST_WORKSPACE=true gemini mcp list` | 0.65.0 | 2026-10-22 | Pass: Connected, `${extensionPath}` resolved to the extension folder |
| `tools/list` over stdio to `server.mjs --agent gemini` | 0.65.0 | 2026-10-22 | Pass: 9 tools |
| `gemini mcp add -s user ...` (older method), `mcp list`, `mcp remove` | 0.65.0 | 2026-10-22 | Pass: real path in settings.json, Connected, removed |
| `gemini extensions update` / `uninstall` | 0.65.0 | not run | Not run |

Not run: whether a live Gemini session loads the hooks, `/ctx-doctor` and the trust prompt (needs a login). `gemini extensions update` and `uninstall`. Windows commands.

## Sources

- https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md
- https://github.com/google-gemini/gemini-cli
