# Install context-mode v2 on Kiro

This guide writes the MCP entry to `~/.kiro/settings/mcp.json` and the hook file `~/.kiro/hooks/context-mode.json` with one command. Both hold the real path to the context-mode files. The hook file uses the standalone hook format from the Kiro docs (`version` `v1`, a `hooks` list with `trigger` and `action`). Kiro CLI V3 loads global hooks from `~/.kiro/hooks/`.

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
| install command (sh) | not installed | 2026-10-21 | Pass: mcp.json and hook file written with the real path, other servers kept |
| uninstall command (sh) | not installed | 2026-10-21 | Pass |

| hook file format vs. kiro.dev hook docs | n/a | 2026-10-21 | Pass: same keys (`version` `v1`, `name`, `trigger`, `matcher` `@mcp`, `action.type` `command`, `timeout` in seconds). The docs show the IDs `SessionStart`, `PreToolUse`, `PostToolUse` and list Prompt Submit for the CLI, but do not show the exact ID `PromptSubmit`. |

Not verified: Kiro itself. Kiro has no npm package we could put in a temporary folder, so no run showed Kiro load the server or fire the hooks, and `/ctx-doctor` did not run. Windows commands.

## Sources

- https://kiro.dev/docs/hooks/
- https://kiro.dev/docs/hooks/types/
