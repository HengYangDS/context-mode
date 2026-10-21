# Install guides — status

Ten guides, one per agent. Each guide gives install, update, upgrade-from-v1,
rollback, uninstall and troubleshooting steps for context-mode v2. "Status"
below says how far each guide was checked against the live agent, as of
2026-10-17. No v2 MCP server build exists on `v2-design` yet, so every
"Verified" step used a stand-in stdio server or a placeholder command in its
place; no guide below confirms the real context-mode tools end to end yet.

| Agent | Guide | Status |
|---|---|---|
| Claude Code | [claude-code.md](./claude-code.md) | Blocked — plugin marketplace add step needs owner login; CLI-on-PATH check only. |
| Codex | [codex.md](./codex.md) | Partial — `codex mcp add` and `mcp list` verified with a placeholder command; no real server run. |
| Copilot CLI | [copilot-cli.md](./copilot-cli.md) | Docs-only — built from public docs; not run against a live CLI. |
| Gemini CLI | [gemini.md](./gemini.md) | Blocked — extension install needs owner login and the `release` ref, which does not exist yet. |
| Kiro | [kiro.md](./kiro.md) | Docs-only — built from public docs; not run against a live CLI. |
| OpenCode | [opencode.md](./opencode.md) | Partial — install and MCP/hook config verified with a stand-in server. |
| Pi | [pi.md](./pi.md) | Partial — install verified against the `v2-design` ref (the `release` ref does not exist yet). |
| Qwen Code | [qwen.md](./qwen.md) | Partial — CLI install and `extensions --help` shape verified; real extension install not run (no v2 build). |
| VS Code | [vscode.md](./vscode.md) | Docs-only — built from public docs; not run against a live install. |
| ZCode | [zcode.md](./zcode.md) | Partial — install verified with a stand-in server; found the config file the guide named is not the one the CLI reads (see Deviations). |

## Get the files

The `release` ref appears with the first v2 release. Until then the
commands below fail with "Remote branch release not found". `v2-design`
holds source, not built files, so it does not work as a stand-in.

Codex, OpenCode, Kiro, VS Code and ZCode run a local copy of the built files.
Use one folder for all of them: `~/.context-mode-app` (Windows:
`%USERPROFILE%\.context-mode-app`). The folder `~/.context-mode/` is not
used: v1 keeps data there and `/ctx-upgrade` deletes it (ADR-0011).

macOS / Linux:

```bash
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
```

Windows (PowerShell):

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
```

Update: `git -C ~/.context-mode-app pull` (Windows: `git -C "$env:USERPROFILE\.context-mode-app" pull`).

The `release` branch holds built files only (ADR-0013). Files used by the guides:

| File | Use |
|---|---|
| `server.mjs` | MCP server. Start: `node ~/.context-mode-app/server.mjs --agent <id>` |
| `hook.mjs` | Hook command. `node ~/.context-mode-app/hook.mjs --agent <id>` |
| `hooks/<agent>.json` | Hook entries per agent |

`<id>` is the agent id of the guide (`codex`, `opencode`, `kiro`, `vscode`, `zcode`).
Claude Code, Copilot CLI, Gemini, Qwen and Pi install from their own
marketplace or extension command and do not need this folder.

Some config files do not expand `~`. The guides then show `/Users/you/...`:
change `/Users/you` to your home folder.

## What "Partial" and "Blocked" mean

- **Partial**: the agent CLI and its config-file steps were run and checked, but the real context-mode v2 server was not, because no build exists on `v2-design` yet.
- **Blocked**: a step needs the repo owner's own login/auth, so it could not be run here.
- **Docs-only**: no isolated live run; the guide follows the agent's public docs only.

## Deviations found

Open items each guide's "Differences from the v2 spec" section raised are
copied into [`docs/v2/impl/DEVIATIONS.md`](../v2/impl/DEVIATIONS.md) as open
rows for the M3 adapter work.
