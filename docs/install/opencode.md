# Install context-mode v2 on OpenCode

Run the two commands on the [install page](./README.md). This page lists what `context-mode setup` does for OpenCode, the manual fallback, the known limits and what was checked.

## Install

What setup does for OpenCode: Writes `mcp.context-mode` (`type: local`, the absolute command, `enabled: true`) to `~/.config/opencode/opencode.json`. Other keys stay.

It writes `~/.config/opencode/opencode.json`. Hooks: not written (plugin does not load). A failed step is rolled back byte for byte; setup never edits `CLAUDE.md`, `AGENTS.md` or other instruction files.

Manual fallback. Writes the same entry with one `node` command.

```sh
node -e 'const fs=require("fs"),p=require("path"),cp=require("child_process"),h=require("os").homedir(),f=p.join(h,".config","opencode","opencode.json"),s=p.join(cp.execSync("npm root -g").toString().trim(),"context-mode","server.mjs");let c={};try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}(c.mcp??={})["context-mode"]=({type:"local",command:[process.execPath,s,"--agent","opencode"],enabled:true});fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(c,null,2))'
```

Restart OpenCode after the install.

## Verify

```sh
context-mode doctor --agents opencode
opencode mcp list
```

`context-mode` must show as connected. Then run `/ctx-doctor` in OpenCode.

## Update

```sh
npm i -g context-mode@next && context-mode setup --repair --agents opencode
```

Or run `context-mode upgrade --agents opencode`. After the owner moves the `latest` tag, drop `@next`.

## Known limits

- The context-mode hooks plugin is not part of setup: no OpenCode build loads the release `opencode/plugin.js` ("Plugin export is not a function"). Setup adds the MCP server only.


## Uninstall

```sh
context-mode setup --remove --agents opencode
```

`setup --remove` puts each touched file back. To remove the package too, see [Uninstall](./README.md#uninstall).

## Report a problem

Run `context-mode doctor --agents opencode`. A failed check prints a `gh issue create` command and a report file under `~/.context-mode/reports/`. Open the [v2 bug form](https://github.com/mksglu/context-mode/issues/new?template=bug.yml) and paste the report.

## Verified

Tested on macOS (arm64), Node 26, a clean temporary HOME, the npm-packed build of commit 5c41eb61.

| Command | OpenCode version | Date | Result |
|---|---|---|---|
| `context-mode setup --yes --agents opencode` | 1.19.4 | 2026-10-23 | Pass: `~/.config/opencode/opencode.json` written |
| `context-mode setup --yes --agents opencode` (second run) | 1.19.4 | 2026-10-23 | Pass |
| `context-mode doctor --agents opencode` | 1.19.4 | 2026-10-23 | Pass |
| `context-mode setup --remove --yes` | 1.19.4 | 2026-10-23 | Pass: files restored (`Restored N file(s).`) |

Not run: a live, logged-in OpenCode session that fires the hooks. Windows commands. Evidence: [CLI report](../v2/CLI-REPORT.md), [engine tests](../../tests/v2/setup/engine.test.mjs), [DEVIATIONS](../v2/impl/DEVIATIONS.md).
