# Install context-mode v2 on ZCode

This guide covers the ZCode CLI. It writes the MCP entry to `~/.zcode/cli/config.json` with one command, with the real path to the context-mode files.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),d=p.join(h,".zcode","cli"),f=p.join(d,"config.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcp=c.mcp||{};c.mcp.servers=c.mcp.servers||{};c.mcp.servers["context-mode"]={type:"stdio",command:"node",args:[p.join(h,".context-mode-app","server.mjs"),"--agent","zcode"]};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),d=p.join(h,".zcode","cli"),f=p.join(d,"config.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcp=c.mcp||{};c.mcp.servers=c.mcp.servers||{};c.mcp.servers["context-mode"]={type:"stdio",command:"node",args:[p.join(h,".context-mode-app","server.mjs"),"--agent","zcode"]};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
```

The command keeps your other settings. Restart ZCode.

## Verify

In ZCode, run `/mcp list`. `context-mode` must be listed. Then run `/ctx-doctor`.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart ZCode.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In ZCode, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode@1
```

Then add the v1 entry for ZCode as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
node -e 'const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".zcode","cli","config.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcp.servers["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
@'
const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".zcode","cli","config.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcp.servers["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | ZCode version | Date | Result |
|---|---|---|---|
| install command (sh) | not installed | 2026-10-21 | Pass: entry written with the real path |
| uninstall command (sh) | not installed | 2026-10-21 | Pass |

Not run: ZCode itself (no package we could put in a temporary folder). Hooks: this guide does not add them yet. The ZCode desktop app. Windows commands.

## Sources

- https://github.com/zai-org/ZCode (apps/zcode-cli README)
