# Install guides

One guide per agent. Every command block runs as copied, with no edit: no user path, no placeholder.
`build/check-install-docs.mjs` checks this in CI.

## Get the files

Most agents run a local copy of the built files from the `release` branch, in one fixed folder.

macOS / Linux:

```sh
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
```

Windows (PowerShell):

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
```

Pi does not need this folder: it installs from the release branch itself, and `pi update --extensions` updates it.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Then restart the agent. Every config entry points at this folder, so nothing else changes.

## Methods

Order of preference: 1. the agent's own plugin or extension install; 2. the agent's own `mcp add` command (your shell expands `$HOME` or `$env:USERPROFILE`); 3. a config value with a variable the agent expands itself; 4. one `node` command that writes the config with the real path.

"Verified" means the command ran on macOS with a temporary HOME against the release branch (commit 0438537), and the agent listed the server. No guide is checked on Windows yet, and no run had a live, logged-in agent session fire the hooks.

| Agent | Guide | Method | Verified |
|---|---|---|---|
| Claude Code | [claude-code.md](./claude-code.md) | 2 (`claude mcp add`) + 4 (hooks) | yes, 2026-10-21, 2.1.274 |
| Codex | [codex.md](./codex.md) | 2 (`codex mcp add`) + 4 (hooks) | yes, 2026-10-21, 0.163.0 |
| Copilot CLI | [copilot-cli.md](./copilot-cli.md) | 2 (`copilot mcp add`) + 4 (hooks) | yes, 2026-10-21, 1.0.102 |
| Gemini CLI | [gemini.md](./gemini.md) | 2 (`gemini mcp add`), no hooks | yes, 2026-10-21, 0.65.0 (Connected in a trusted folder) |
| Kiro | [kiro.md](./kiro.md) | 4 (MCP and hooks) | no, 2026-10-22: command ran, hook keys match kiro.dev; Kiro not installed; prompt trigger ID not in the docs |
| OpenCode | [opencode.md](./opencode.md) | 3 (`{env:HOME}`), written by 4; no hooks | yes, 2026-10-21, 1.19.3 |
| Pi | [pi.md](./pi.md) | 1 (`pi install git:github.com/mksglu/context-mode@release`) | no, 2026-10-22, 1.3.0: installs and updates; not loaded in a session |
| Qwen Code | [qwen.md](./qwen.md) | 2 (`qwen mcp add`), no hooks | yes, 2026-10-21, 0.25.3 |
| VS Code | [vscode.md](./vscode.md) | 4 (MCP and hooks, per project) | no: command ran, VS Code not run |
| ZCode | [zcode.md](./zcode.md) | 4 (MCP), no hooks | no: command ran, ZCode not installed |

## Release build fixes needed for method 1

Each of these would let the agent's own install replace the steps above:

- Claude Code, Copilot CLI: a `.claude-plugin/marketplace.json` on the release branch.
- Codex: `.agents/plugins/marketplace.json` and `.codex-plugin/plugin.json`.
- Gemini CLI: `gemini-extension.json` args `${extensionPath}${/}server.mjs`, and a `hooks/hooks.json` with `node "${extensionPath}${/}hook.mjs" --agent gemini`.
- Qwen Code: `qwen-extension.json` args `${extensionPath}${/}server.mjs`, a `"hooks"` key, and hook commands with `${CLAUDE_PLUGIN_ROOT}`.
- OpenCode: `opencode/plugin.js` must export a plain function; no OpenCode build loads it today.
- Pi: a `package.json` with a `pi` key that points at `pi/index.js`.
- Kiro (not method 1): `hook.mjs --agent kiro` must accept the event name `UserPromptSubmit`; the Kiro docs show it in the prompt hook payload.
- All `hooks/*.json`: the command `node hook.mjs` is relative and fails from a project folder.
