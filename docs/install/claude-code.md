# Install context-mode v2 on Claude Code

This guide adds the context-mode MCP server with `claude mcp add` and writes the hooks to `~/.claude/settings.json` with one command. The plugin install (`claude plugin marketplace add`) does not work yet: the release branch has no `.claude-plugin/marketplace.json`.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
claude mcp add -s user context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent claude-code
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),f=p.join(h,".claude","settings.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.hooks=c.hooks||{};const s=JSON.parse(fs.readFileSync(p.join(a,"hooks","claude-code.json"),"utf8")).hooks;for(const k in s){c.hooks[k]=(c.hooks[k]||[]).filter(e=>!JSON.stringify(e).includes(".context-mode-app"));for(const e of s[k]){for(const x of e.hooks)x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent claude-code";c.hooks[k].push(e)}}fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
claude mcp add -s user context-mode -- node "$env:USERPROFILE\.context-mode-app\server.mjs" --agent claude-code
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),f=p.join(h,".claude","settings.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.hooks=c.hooks||{};const s=JSON.parse(fs.readFileSync(p.join(a,"hooks","claude-code.json"),"utf8")).hooks;for(const k in s){c.hooks[k]=(c.hooks[k]||[]).filter(e=>!JSON.stringify(e).includes(".context-mode-app"));for(const e of s[k]){for(const x of e.hooks)x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent claude-code";c.hooks[k].push(e)}}fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
```

The last command adds the context-mode hooks to `~/.claude/settings.json` with the real path to `hook.mjs`. It keeps your other hooks. Run it again after a move; it does not add duplicates.
Restart Claude Code.

## Verify

```sh
claude mcp list
```

`context-mode` must show as connected. Then run `/ctx-doctor` in Claude Code.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Claude Code. The MCP entry and hooks point at the same folder, so nothing else changes.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Claude Code, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Claude Code as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
claude mcp remove -s user context-mode
node -e 'const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".claude","settings.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));for(const k in c.hooks){c.hooks[k]=c.hooks[k].filter(e=>!JSON.stringify(e).includes(".context-mode-app"));if(!c.hooks[k].length)delete c.hooks[k]}fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
claude mcp remove -s user context-mode
@'
const fs=require("fs"),p=require("path"),f=p.join(require("os").homedir(),".claude","settings.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));for(const k in c.hooks){c.hooks[k]=c.hooks[k].filter(e=>!JSON.stringify(e).includes(".context-mode-app"));if(!c.hooks[k].length)delete c.hooks[k]}fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Claude Code version | Date | Result |
|---|---|---|---|
| `claude mcp add -s user context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent claude-code` | 2.1.274 | 2026-10-21 | Pass: entry has the real path |
| `claude mcp list` | 2.1.274 | 2026-10-21 | Pass: context-mode listed |
| hooks command (sh) | n/a | 2026-10-21 | Pass: 5 events written, other hooks kept, no duplicates on a second run |
| `claude plugin marketplace add mksglu/context-mode@release` | 2.1.274 | 2026-10-21 | Fail: no marketplace.json on the release branch |
| `claude mcp remove -s user context-mode` | 2.1.274 | 2026-10-21 | Pass |

Not run: a live Claude Code session that fires the hooks (needs a login). Windows commands.
