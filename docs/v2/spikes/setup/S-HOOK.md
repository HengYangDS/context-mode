# S-HOOK: hook latency for three command forms

## Question
ADR-0019 pass column: the absolute path form `node /abs/hook.mjs` is under 40 ms p95. Record `context-mode hook` (global bin) and `npx context-mode hook`.

## Method
- Repo `v2-design` at d36e46f9. `npm install --ignore-scripts`, `npm run build` -> `release-out/` (hook.mjs 155606 bytes).
- Node v26.8.1, npm 11.19.0, macOS Darwin 23.5.0 (arm64 or x64 not recorded).
- Temp HOME, temp npm cache, temp prefix. Real global prefix untouched. No publish.
- Payloads: `e2e/fixtures/claude-code/2.1.303/PostToolUse-Bash-large.json` (11440 bytes, `cwd` set to a temp git repo) and a small PreToolUse payload (`Bash`, `ls`).
- Forms:
  1. `node <abs>/release-out/hook.mjs --agent claude-code`
  2. `<prefix>/bin/context-mode hook --agent claude-code`: `npm pack` tarball with `bin` -> `cli.mjs`, which imports `hook.mjs`; installed with `npm i -g --prefix`.
  3. `npx --prefix <tmp> --offline --no-install context-mode hook ...` (package installed in that prefix, cache warm).
- Per form and payload: 1 cold run (first run, first spawn) + 50 warm runs. Time = wall clock of `spawnSync` from the parent (includes process spawn). Percentile = nearest rank.
- Exit code 0 in all runs. Post stdout 285 bytes (updatedToolOutput), Pre stdout empty (allow).
- Baseline: `node -e ""` spawn, 50 runs: p50 30.0 ms, p95 31.7 ms.

## Raw numbers (ms)
| payload/form | cold | p50 | p95 | max |
|---|---|---|---|---|
| post / abs node | 46.5 | 43.9 | 47.8 | 50.2 |
| post / global shim | 43.4 | 44.9 | 48.8 | 53.2 |
| post / npx (warm) | 477.6 | 220.9 | 234.2 | 251.5 |
| pre / abs node | 39.5 | 39.0 | 41.1 | 41.5 |
| pre / global shim | 41.7 | 40.1 | 43.1 | 44.0 |
| pre / npx (warm) | 225.7 | 222.6 | 239.8 | 241.9 |

Extra: `npx -y ./context-mode-0.0.0-spike.tgz hook` with an empty npm cache (cold install from tarball, local file, no network): 2004 ms, exit 0. A registry install would add network time.

## Result against ADR-0019
- Pass rule (1) abs path under 40 ms p95: **FAIL on this host**. Post 47.8 ms, Pre 41.1 ms. `HOOK_P95_MS` is 40 (`src/core/contracts/constants.ts:66`).
- The node start alone costs 30 ms here (Node 26.8.1). The hook adds about 9 ms (Pre) to 14 ms (Post) over the baseline. The 40 ms budget leaves 10 ms for the hook on this host.
- Global shim adds 1 to 5 ms over abs (the extra import hop). Same order as abs.
- npx costs about 220 ms warm and about 2 s cold. Over budget by 5x. Not usable in hooks.
- Single host, single Node version, no CPU pinning. Other agents ran spikes in parallel on the same machine, so noise is likely. Re-run on a quiet host and on Node 20/22 before changing the constant.

## What ADR-0019 must change
1. Keep: hooks use the absolute `node /abs/.../hook.mjs` command. Never `npx`. The data supports this (npx 220 ms vs 44 ms).
2. The "global bin `context-mode hook`" form: allowed as a fallback only, with the shim reading no extra modules. It costs 1 to 5 ms more and adds a PATH lookup (already banned in step 4 of the plan).
3. The 40 ms pass rule is not met on this host by the baseline alone. Choose one: (a) define the budget as hook time minus bare node start (measure `node -e ""` in the same run and subtract), or (b) raise `HOOK_P95_MS` after a re-run on the target hosts, or (c) cut hook.mjs work (155 KB bundle load, git lookup) and re-measure. Doctor D5 compares wall time to `HOOK_P95_MS` and will report FAIL on this host today.
4. Doctor D5 should print the node baseline next to the measured time so a slow Node start is not reported as a hook fault.
