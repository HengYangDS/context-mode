# Install context-mode v2 on OpenCode

This guide adds the MCP server to `~/.config/opencode/opencode.json` with one command. On macOS and Linux the entry uses OpenCode's own `{env:HOME}` variable. On Windows it holds the real path.

The context-mode hooks plugin for OpenCode is not part of this guide yet: no OpenCode build on npm loads the release `opencode/plugin.js` ("Plugin export is not a function").

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
npm install -g opencode-ai
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),d=p.join(h,".config","opencode"),f=p.join(d,"opencode.json"),s=process.platform==="win32"?p.join(h,".context-mode-app","server.mjs"):"{env:HOME}/.context-mode-app/server.mjs";let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcp=c.mcp||{};c.mcp["context-mode"]={type:"local",command:["node",s,"--agent","opencode"],enabled:true};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g opencode-ai
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),d=p.join(h,".config","opencode"),f=p.join(d,"opencode.json"),s=process.platform==="win32"?p.join(h,".context-mode-app","server.mjs"):"{env:HOME}/.context-mode-app/server.mjs";let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.mcp=c.mcp||{};c.mcp["context-mode"]={type:"local",command:["node",s,"--agent","opencode"],enabled:true};fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
```

The command keeps your other settings.

## Verify

```sh
opencode mcp list
```

`context-mode` must show as connected. The first run can take 30 seconds. Then run `/ctx-doctor` in OpenCode.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart OpenCode.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In OpenCode, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode@1
```

Then add the v1 entry for OpenCode as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
node -e 'const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".config","opencode","opencode.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcp["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
@'
const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".config","opencode","opencode.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.mcp["context-mode"];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | OpenCode version | Date | Result |
|---|---|---|---|
| entry with `{env:HOME}/.context-mode-app/server.mjs`, then `opencode mcp list` | 1.19.3 | 2026-10-21 | Pass: connected, path expanded |
| install command (sh) | n/a | 2026-10-21 | Pass: entry written, other keys kept |
| release `opencode/plugin.js` as a plugin | 1.19.3 | 2026-10-21 | Fail: does not load |

Not run: hooks (no working plugin). Windows commands.

## Sources

- https://opencode.ai/docs/config/
- https://opencode.ai/docs/mcp-servers/
