# Install context-mode v2 on ZCode

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for ZCode, the manual fallback, the known limits and what was checked.

## Install

What setup does for ZCode: Writes the `context-mode` entry to `~/.zcode/cli/config.json` with the absolute `node` and `server.mjs` paths.

It writes `~/.zcode/cli/config.json`. Hooks: not written. A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Writes the same entry with one `node` command.

```sh
node -e 'const fs=require("fs"),p=require("path"),cp=require("child_process"),h=require("os").homedir(),f=p.join(h,".zcode","cli","config.json"),s=p.join(cp.execSync("npm root -g").toString().trim(),"context-mode","server.mjs");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}(c.mcpServers??={})["context-mode"]=({command:process.execPath,args:[s,"--agent","zcode"]});fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2))'
```

Restart ZCode after the install.

## Verify

```sh
context-mode doctor --agents zcode
```

Run `/ctx-doctor` in ZCode.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents zcode
```

Or run `context-mode upgrade --agents zcode`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- Setup writes no hooks for ZCode.
- ZCode has no npm package, so no run showed ZCode load the server. The ZCode desktop app is not covered.


## Uninstall

```sh
context-mode setup --remove --agents zcode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents zcode`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | ZCode version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents zcode` | not installed | 2026-10-23 | Pass: `~/.zcode/cli/config.json` written |
| `context-mode setup --yes --agents zcode` (second run) | not installed | 2026-10-23 | Pass |
| `context-mode doctor --agents zcode` | not installed | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | not installed | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

ZCode was not installed, so a Pass here means the config entry and the MCP handshake checked out, not that ZCode loaded the server. See [CLI report](../v2/CLI-REPORT.md) and the [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md). Windows commands are not run.
