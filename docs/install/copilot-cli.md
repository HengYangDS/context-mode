# Install context-mode v2 on Copilot CLI

This guide adds the MCP server with `copilot mcp add` and writes `~/.copilot/hooks/context-mode.json` with one command. The plugin install does not work yet: the release branch has no `marketplace.json`.

## Install

Get the files first. See [Get the files](./README.md#get-the-files).

macOS / Linux:

```sh
npm install -g @github/copilot
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app
copilot mcp add context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent copilot-cli
node -e 'const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=p.join(process.env.COPILOT_HOME||p.join(h,".copilot"),"hooks"),k=JSON.parse(fs.readFileSync(p.join(a,"hooks","copilot-cli.json"),"utf8"));for(const e in k.hooks)for(const x of k.hooks[e])x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent copilot-cli";fs.mkdirSync(d,{recursive:true});fs.writeFileSync(p.join(d,"context-mode.json"),JSON.stringify(k,null,2)+"\n")'
```

Windows (PowerShell), not run on Windows yet:

```powershell
npm install -g @github/copilot
git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git "$env:USERPROFILE\.context-mode-app"
copilot mcp add context-mode -- node "$env:USERPROFILE\.context-mode-app\server.mjs" --agent copilot-cli
@'
const fs=require("fs"),p=require("path"),h=require("os").homedir(),q=String.fromCharCode(34),a=p.join(h,".context-mode-app"),d=p.join(process.env.COPILOT_HOME||p.join(h,".copilot"),"hooks"),k=JSON.parse(fs.readFileSync(p.join(a,"hooks","copilot-cli.json"),"utf8"));for(const e in k.hooks)for(const x of k.hooks[e])x.command="node "+q+p.join(a,"hook.mjs")+q+" --agent copilot-cli";fs.mkdirSync(d,{recursive:true});fs.writeFileSync(p.join(d,"context-mode.json"),JSON.stringify(k,null,2)+"\n")
'@ | node -
```

The last command writes the hook file with the real path to `hook.mjs`. Restart Copilot CLI.

## Verify

```sh
copilot mcp list
```

`context-mode` must be listed. Then run `/ctx-doctor` in Copilot CLI.

## Update

macOS / Linux:

```sh
git -C ~/.context-mode-app pull
```

Windows (PowerShell):

```powershell
git -C "$env:USERPROFILE\.context-mode-app" pull
```

Restart Copilot CLI.

## Upgrade from v1

Do the steps in this order. The v1 hooks call the global `context-mode` command, so if you remove the npm package first, they break.

1. Install v2 (see above).
2. In Copilot CLI, run `/ctx-doctor`, then `/ctx-upgrade`. They find and remove the v1 entries.
3. Then remove the v1 package:

```sh
npm uninstall -g context-mode
```

## Rollback to v1

Do the Uninstall steps below. Then install v1 again:

```sh
npm install -g context-mode
```

Then add the v1 entry for Copilot CLI as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

macOS / Linux:

```sh
copilot mcp remove context-mode
node -e 'const p=require("path");require("fs").rmSync(p.join(process.env.COPILOT_HOME||p.join(require("os").homedir(),".copilot"),"hooks","context-mode.json"),{force:true})'
rm -rf ~/.context-mode-app
```

Windows (PowerShell), not run on Windows yet:

```powershell
copilot mcp remove context-mode
@'
const p=require("path");require("fs").rmSync(p.join(process.env.COPILOT_HOME||p.join(require("os").homedir(),".copilot"),"hooks","context-mode.json"),{force:true})
'@ | node -
Remove-Item -Recurse -Force "$env:USERPROFILE\.context-mode-app"
```


## Report a problem

Run `/ctx-doctor` first. Then open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste its output.

## Verified

Tested on macOS with a temporary HOME, against the release branch, commit 0438537.

| Command | Copilot CLI version | Date | Result |
|---|---|---|---|
| `copilot mcp add context-mode -- node "$HOME/.context-mode-app/server.mjs" --agent copilot-cli` | 1.0.102 | 2026-10-21 | Pass |
| `copilot mcp list` | 1.0.102 | 2026-10-21 | Pass: context-mode (local) |
| hooks command (sh), then the written sessionStart command from another folder | n/a | 2026-10-21 | Pass: exit 0 |
| `copilot plugin marketplace add` on the release branch | 1.0.102 | 2026-10-21 | Fail: no marketplace.json |
| `copilot mcp remove context-mode` | 1.0.102 | 2026-10-21 | Pass |

Not run: a live Copilot CLI session that fires the hooks (needs a login). Windows commands.
