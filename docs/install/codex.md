# Install context-mode v2 on Codex

This guide adds the MCP server with `codex mcp add` and writes the hooks to `~/.codex/hooks.json` (or `$CODEX_HOME/hooks.json`) with one command. A Codex plugin install does not work yet: the release branch has no `.agents/plugins/marketplace.json`.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
npm install -g @openai/codex
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
codex mcp add context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent codex
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=process.env.CODEX_HOME||p.join(h,".codex"),f=p.join(d,"hooks.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.hooks=c.hooks||{};const s=JSON.parse(fs.readFileSync(p.join(a,"hooks","codex.json"),"utf8")).hooks;for(const k in s){c.hooks[k]=(c.hooks[k]||[]).filter(e=>!JSON.stringify(e).includes(".context-mode-app"));for(const e of s[k]){for(const x of e.hooks)x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent codex";c.hooks[k].push(e)}}fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g @openai/codex
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
codex mcp add context-mode -- node "$env:USERPROFILE\.context-mode-app\server.mjs" --agent codex
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=process.env.CODEX_HOME||p.join(h,".codex"),f=p.join(d,"hooks.json");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}c.hooks=c.hooks||{};const s=JSON.parse(fs.readFileSync(p.join(a,"hooks","codex.json"),"utf8")).hooks;for(const k in s){c.hooks[k]=(c.hooks[k]||[]).filter(e=>!JSON.stringify(e).includes(".context-mode-app"));for(const e of s[k]){for(const x of e.hooks)x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent codex";c.hooks[k].push(e)}}fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
```

The last command writes the hooks with the real path to `hook.mjs`. It keeps your other hooks and adds no duplicates. Start Codex and approve the context-mode hooks once in the trust prompt.

## Verify

```sh
codex mcp list
```

`context-mode` must show as enabled. Then run `/ctx-doctor` in Codex.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Codex.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Codex, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Codex as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
codex mcp remove context-mode
node -e 'const fs=require("fs"),p=require("path"),f=p.join(process.env.CODEX_HOME||p.join(require("os").homedir(),".codex"),"hooks.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));for(const k in c.hooks){c.hooks[k]=c.hooks[k].filter(e=>!JSON.stringify(e).includes(".context-mode-app"));if(!c.hooks[k].length)delete c.hooks[k]}fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
codex mcp remove context-mode
@'
const fs=require("fs"),p=require("path"),f=p.join(process.env.CODEX_HOME||p.join(require("os").homedir(),".codex"),"hooks.json"),c=JSON.parse(fs.readFileSync(f,"utf8"));for(const k in c.hooks){c.hooks[k]=c.hooks[k].filter(e=>!JSON.stringify(e).includes(".context-mode-app"));if(!c.hooks[k].length)delete c.hooks[k]}fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Codex version | Date | Result |
|---|---|---|---|
| `codex mcp add context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent codex` | 0.163.0 | 2026-10-21 | Pass: config.toml has the real path |
| `codex mcp list` | 0.163.0 | 2026-10-21 | Pass: context-mode enabled |
| hooks command (sh), then the written hook command from another folder | 0.163.0 | 2026-10-21 | Pass: exit 0, hook JSON returned |
| `codex mcp remove context-mode` and hooks cleanup | 0.163.0 | 2026-10-21 | Pass |

Not run: a live Codex session that fires the hooks and shows the trust prompt (needs a login). Windows commands.

## Sources

- https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- https://learn.chatgpt.com/docs/hooks
- https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/command_runner.rs
