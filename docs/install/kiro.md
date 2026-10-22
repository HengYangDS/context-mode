# Install context-mode v2 on Kiro

This guide writes the MCP entry to `~/.kiro/settings/mcp.json` and the hook file `~/.kiro/hooks/context-mode.json` with one command. Both hold the real path to the context-mode files. Kiro has no `mcp add` command and no variable for the home folder in these files, so a `node` command writes them.

Kiro CLI V3 loads global hooks from `~/.kiro/hooks/`.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=p.join(h,".kiro","settings"),f=p.join(d,"mcp.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcpServers=c.mcpServers||{};c.mcpServers["context-mode"]={command:"node",args:[p.join(a,"server.mjs"),"--agent","kiro"]};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");const k=JSON.parse(fs.readFileSync(p.join(a,"hooks","kiro.json"),"utf8"));for(const x of k.hooks)x.action.command="node "+q+p.join(a,"hook.mjs")+q+" --agent kiro";fs.mkdirSync(p.join(h,".kiro","hooks"),{recursive:true});fs.writeFileSync(p.join(h,".kiro","hooks","context-mode.json"),JSON.stringify(k,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=p.join(h,".kiro","settings"),f=p.join(d,"mcp.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcpServers=c.mcpServers||{};c.mcpServers["context-mode"]={command:"node",args:[p.join(a,"server.mjs"),"--agent","kiro"]};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");const k=JSON.parse(fs.readFileSync(p.join(a,"hooks","kiro.json"),"utf8"));for(const x of k.hooks)x.action.command="node "+q+p.join(a,"hook.mjs")+q+" --agent kiro";fs.mkdirSync(p.join(h,".kiro","hooks"),{recursive:true});fs.writeFileSync(p.join(h,".kiro","hooks","context-mode.json"),JSON.stringify(k,null,2)+"\n")
'@ | node -
```

The command keeps your other MCP servers. Restart Kiro.

## Verify

Run `/ctx-doctor` in Kiro. Run `kiro-cli doctor -a` if the tools do not show.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Kiro.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Kiro, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Kiro as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),f=p.join(h,".kiro","settings","mcp.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcpServers["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");fs.rmSync(p.join(h,".kiro","hooks","context-mode.json"),{force:true})'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),f=p.join(h,".kiro","settings","mcp.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcpServers["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");fs.rmSync(p.join(h,".kiro","hooks","context-mode.json"),{force:true})
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Kiro version | Date | Result |
|---|---|---|---|
| install command (sh) | not installed | 2026-10-22 | Pass: mcp.json and hook file written with the real path, other servers kept |
| written hook command, run from another folder (SessionStart) | not installed | 2026-10-22 | Pass: exit 0; SessionStart printed context |
| written hook command, UserPromptSubmit payload | not installed | 2026-10-22 | Fail on release 87a17f8: "unknown hook event UserPromptSubmit"; fixed in the build after it |
| `git -C ~/.context-mode-app pull` | n/a | 2026-10-21 | Pass: "Already up to date" |
| uninstall command (sh) | not installed | 2026-10-22 | Pass: entry and hook file removed, other servers kept |

Checked against kiro.dev on 2026-10-22: the hooks page shows the keys `version` "v1", `name`, `trigger`, `matcher` (`@mcp`), `action.type` "command" and `action.command`. The field table also lists `hooks[].timeout` (seconds) and `hooks[].enabled`, and says `trigger` is PascalCase. Kiro CLI V3 loads global hooks from `~/.kiro/hooks/` and reads user MCP servers from `~/.kiro/settings/mcp.json` under `mcpServers`.

The prompt hook: the docs name the trigger "Prompt Submit" and give no ID, but the docs' sample payload for that hook has `"hook_event_name": "UserPromptSubmit"`. The release `hooks/kiro.json` uses the trigger `UserPromptSubmit`, and `hook.mjs --agent kiro` accepts both `UserPromptSubmit` and the older `PromptSubmit` (fixed 2026-10-22, D-FU-RM-KIRO-2). Release builds before that fix drop `UserPromptSubmit` with "unknown hook event"; run the Update step to get the fix. The Kiro CLI cannot block a prompt, so this hook never stops your prompts.

Not run: Kiro itself. Kiro has no npm package we could put in a temporary folder, so no run showed Kiro load the server or fire the hooks, and `/ctx-doctor` did not run. Windows commands.

## Sources

- https://kiro.dev/docs/hooks/ (hook file fields, `~/.kiro/hooks/` global location for CLI V3)
- https://kiro.dev/docs/hooks/types/ (triggers, `@mcp` matcher, `USER_PROMPT` env var, sample payloads)
- https://kiro.dev/docs/mcp/configuration/ (`~/.kiro/settings/mcp.json`, `mcpServers`)
