# Install context-mode v2 on VS Code

VS Code (GitHub Copilot agent mode) reads MCP servers from `.vscode/mcp.json` and hooks from `.github/hooks/` in your project. Run the command below in the root folder of each project. It writes both files with the real path to the context-mode files.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),m=p.join(process.cwd(),".vscode","mcp.json");let c={};try{c=JSON.parse(fs.readFileSync(m,"utf8"))}catch(e){}c.servers=c.servers||{};c.servers["context-mode"]={type:"stdio",command:"node",args:[p.join(a,"server.mjs"),"--agent","vscode"]};fs.mkdirSync(p.dirname(m),{recursive:true});fs.writeFileSync(m,JSON.stringify(c,null,2)+"\n");const k=JSON.parse(fs.readFileSync(p.join(a,"hooks","vscode.json"),"utf8"));for(const e in k.hooks)for(const x of k.hooks[e])x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent vscode";fs.mkdirSync(p.join(process.cwd(),".github","hooks"),{recursive:true});fs.writeFileSync(p.join(process.cwd(),".github","hooks","context-mode.json"),JSON.stringify(k,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),m=p.join(process.cwd(),".vscode","mcp.json");let c={};try{c=JSON.parse(fs.readFileSync(m,"utf8"))}catch(e){}c.servers=c.servers||{};c.servers["context-mode"]={type:"stdio",command:"node",args:[p.join(a,"server.mjs"),"--agent","vscode"]};fs.mkdirSync(p.dirname(m),{recursive:true});fs.writeFileSync(m,JSON.stringify(c,null,2)+"\n");const k=JSON.parse(fs.readFileSync(p.join(a,"hooks","vscode.json"),"utf8"));for(const e in k.hooks)for(const x of k.hooks[e])x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent vscode";fs.mkdirSync(p.join(process.cwd(),".github","hooks"),{recursive:true});fs.writeFileSync(p.join(process.cwd(),".github","hooks","context-mode.json"),JSON.stringify(k,null,2)+"\n")
'@ | node -
```

The command keeps your other servers. Reload the VS Code window.

## Verify

Open the Command Palette and run **MCP: List Servers**. `context-mode` must be listed. Then run `/ctx-doctor` in Copilot Chat.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Reload the VS Code window.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In VS Code, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for VS Code as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

In the root folder of each project:

macOS / Linux:

```sh
node -e 'const fs=require("fs"),p=require("path"),m=p.join(process.cwd(),".vscode","mcp.json"),c=JSON.parse(fs.readFileSync(m,"utf8"));delete c.servers["context-mode"];fs.writeFileSync(m,JSON.stringify(c,null,2)+"\n");fs.rmSync(p.join(process.cwd(),".github","hooks","context-mode.json"),{force:true})'
```

Windows (PowerShell), not run on Windows yet:

```powershell
@'
const fs=require("fs"),p=require("path"),m=p.join(process.cwd(),".vscode","mcp.json"),c=JSON.parse(fs.readFileSync(m,"utf8"));delete c.servers["context-mode"];fs.writeFileSync(m,JSON.stringify(c,null,2)+"\n");fs.rmSync(p.join(process.cwd(),".github","hooks","context-mode.json"),{force:true})
'@ | node -
```

When no project uses it any more:

macOS / Linux:

```sh
rm -rf ~/.context-mode-app
```

Windows (PowerShell):

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | VS Code version | Date | Result |
|---|---|---|---|
| install command (sh) in a project folder | not installed | 2026-10-21 | Pass: both files written with the real path |
| uninstall command (sh) | not installed | 2026-10-21 | Pass |

Not run: VS Code itself, so no run showed VS Code load the server or fire the hooks. Windows commands.
