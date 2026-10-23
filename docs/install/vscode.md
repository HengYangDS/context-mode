# Install context-mode v2 on VS Code (Copilot)

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for VS Code (Copilot), the manual fallback, the known limits and what was checked.

## Install

What setup does for VS Code (Copilot): Writes the `context-mode` entry (key `servers`) to `.vscode/mcp.json` under your home folder, with the absolute `node` and `server.mjs` paths.

It writes `~/.vscode/mcp.json`. Hooks: not written. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Writes the same entry with one `node` command. For one project, run it from a copy that points `f` at that project's `.vscode/mcp.json`.

```sh
node -e 'const fs=require("fs"),p=require("path"),cp=require("child_process"),h=require("os").homedir(),f=p.join(h,".vscode","mcp.json"),s=p.join(cp.execSync("npm root -g").toString().trim(),"context-mode","server.mjs");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}(c.servers??={})["context-mode"]=({command:process.execPath,args:[s,"--agent","vscode"]});fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2))'
```

Restart VS Code (Copilot) after the install.

## Verify

```sh
context-mode doctor --agents vscode
```

Open VS Code, open the MCP server list, and run `/ctx-doctor` in Copilot agent mode.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents vscode
```

Or run `context-mode upgrade --agents vscode`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- Setup writes no hook file. VS Code reads hooks from `.github/hooks/` in a project; that is not part of the setup run.
- VS Code itself was not run, so no run showed that VS Code reads `.vscode/mcp.json` under the home folder.
- The shipped `hooks/vscode.json` is a template: the writer fills the path; do not copy hooks/vscode.json by hand.

## Upgrade from v1

Run the same two commands as a new install. Setup finds v1 entries first (`context-mode doctor` lists them). For VS Code (Copilot) it writes a new v2 entry. Setup backs up every file it touches under `~/.context-mode/backups`. See the [upgrade steps](./README.md#upgrade-from-v1).

## Rollback to v1

Run `context-mode setup --remove`, then install v1 with `npm install -g context-mode@1`. Then add the v1 entry for VS Code (Copilot) as the [Rollback table](../../README.md#upgrading-from-v1) says.

## Uninstall

```sh
context-mode setup --remove --agents vscode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents vscode`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | VS Code (Copilot) version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents vscode` | not installed | 2026-10-23 | Pass: `~/.vscode/mcp.json` written |
| `context-mode setup --yes --agents vscode` (second run) | not installed | 2026-10-23 | Pass |
| `context-mode doctor --agents vscode` | not installed | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | not installed | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

VS Code (Copilot) was not installed, so a Pass here means the config entry and the MCP handshake checked out, not that VS Code (Copilot) loaded the server. See [CLI report](../v2/CLI-REPORT.md) and the [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md). Windows commands are not run.
