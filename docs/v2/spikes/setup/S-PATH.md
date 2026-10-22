# S-PATH: where `npm i -g` puts the package, and can the CLI find its own absolute path

Date: 2026-10-22. ADR: 0019. Pass column: 6 of 6 layouts give the real absolute path.

## Question
Where does `npm i -g` put a package with a `bin`, and does the CLI always learn its own absolute install path?

## Method
- Minimal package `cm-spike-path` (ESM, `bin: context-mode`). The CLI prints `import.meta.url`, `fileURLToPath`, `realpathSync`, `isAbsolute`, `process.argv[1]`, `process.execPath` as JSON.
- Local (macOS, Homebrew node 26.8.1, npm 11.19.0): `npm pack`, then `npm i -g <abs tgz>` into a temp prefix and a temp HOME. Run direct, via PATH, via `spawnSync` with `shell:false`, and via a user symlink to the bin.
- CI: branch `spike/setup-path`, workflow matrix ubuntu/macos/windows x node 24.15.0/26 (run 39777443062, all 6 jobs green). Windows steps: bash, `cmd` with `context-mode.cmd`, pwsh. A `spawnSync` script tried: `shell:false` bare name, `shell:false` `.cmd`, `shell:true`, `cmd.exe /c`.
- Not tested: nvm (only the loader is present, no installed node), fnm, Volta (not installed locally; not quick to add safely). Homebrew node and the CI toolcache nodes stand in for these.

## Raw results
Local macOS Homebrew, temp prefix `<prefix>`:
- `<prefix>/bin/context-mode` is a symlink to `../lib/node_modules/cm-spike-path/bin/cli.mjs`.
- Direct, via PATH, `spawnSync shell:false`: `import.meta.url` = `file://<prefix>/lib/node_modules/cm-spike-path/bin/cli.mjs`; `real` equal to file; `abs:true`; `argv1` = the symlink path (`<prefix>/bin/context-mode`), exit 0.
- Via a user symlink elsewhere: `argv1` = the user symlink, but `import.meta.url` and `real` still the true install file. So `argv1` is NOT reliable; `import.meta.url` is.

CI (`npm root -g`, and the path the CLI printed, `abs:true` and `real` = file in every row):

| Layout | npm root -g | PATH run | shell:false spawn of `context-mode` |
|---|---|---|---|
| ubuntu node 24.15.0 | /opt/hostedtoolcache/node/24.15.0/x64/lib/node_modules | real abs path | OK, exit 0 |
| ubuntu node 26.12.1 | /opt/hostedtoolcache/node/26.12.1/x64/lib/node_modules | real abs path | OK |
| macos node 24.15.0 | /Users/runner/hostedtoolcache/node/24.15.0/arm64/lib/node_modules | real abs path | OK |
| macos node 26.12.1 | /Users/runner/hostedtoolcache/node/26.12.1/arm64/lib/node_modules | real abs path | OK |
| windows node 24.15.0 | C:\npm\prefix\node_modules | real abs path (bash, cmd shim, pwsh) | ENOENT |
| windows node 26.12.1 | C:\npm\prefix\node_modules | real abs path (bash, cmd shim, pwsh) | ENOENT |

Windows extra spawn results (both versions): `shell:false` with `context-mode.cmd` gives EINVAL (Node blocks `.cmd` without a shell). `shell:true` and `cmd.exe /c context-mode` both work and print the real path. Note the Windows layout has no `lib/`: packages sit directly under `<prefix>\node_modules`.

## Verdict
PASS, 6 of 6 layouts: the CLI printed a real, absolute path every time (Linux, macOS, Windows; Node 24.15.0 and 26; bash, cmd shim, pwsh).
Caveat (not in the pass column): on Windows a Node process cannot start the CLI with `shell:false` by bare name (ENOENT) or by `.cmd` (EINVAL).

## What ADR-0019 must change
1. Setup must get its own path from `fileURLToPath(import.meta.url)` then `realpathSync`. Never use `process.argv[1]` (it is the bin symlink or a user symlink) and never `npm root -g` or a PATH lookup.
2. Write `node <abs>/server.mjs` and hook commands using `process.execPath` plus the resolved absolute file. Do not write the bin name. This also avoids the Windows `shell:false` ENOENT/EINVAL failure.
3. Document that the layout differs: Unix `<prefix>/lib/node_modules/<pkg>`, Windows `<prefix>\node_modules\<pkg>`. Code must not assume `lib/`.
4. Record that the path is tied to the node version dir under nvm/fnm/Volta-style managers (CI toolcache paths contain the node version). After a node switch or `npm i -g` under another node, the stored path can go stale. Add a `doctor` check that the stored absolute path still exists and `setup`/`upgrade` rewrite it. nvm, fnm and Volta were not run here; keep S-PATH open for those three layouts, or accept the CI toolcache as a proxy.
