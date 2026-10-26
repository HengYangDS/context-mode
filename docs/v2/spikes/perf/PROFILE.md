# Profile: D3 hook overhead and GP-SEARCH held-out p95 (P1, owner rule: never forget profiling)

Limits: D3 hook overhead p95 15 ms (CI windows node 24 read 17 ms); GP-SEARCH held-out ctx_search p95 50 ms
(CI ubuntu node 24 read 67 ms). Budgets are not changed. Goal: 30% headroom on a local 10-run p95.

Method:
- Hook: `node --cpu-prof --cpu-prof-interval 50 release-out/hook.mjs --agent claude-code < PreToolUse Bash payload`,
  3 runs, self time per frame averaged per run. Inclusive time from an unminified build of the same entry.
- Search: the GP-SEARCH-heldout flow (index held-out sources + 1 MB of docs/v2), then a fresh server with
  `NODE_OPTIONS=--cpu-prof --cpu-prof-interval 100` runs the 50 held-out queries 10 times; self time per frame.
- Host: macOS, Node 26.8.1, load average about 13 (shared machine, 14 other agents). Numbers are noisy.

## Before (b5848ef6)

### Hook, PreToolUse cold start, self time per run (ms)

```
total 18.54 ms/run
   9.73 (idle) :-1
   3.32 compileSourceTextModule utils:337
   0.42 (anon) hook.mjs:0
   0.25 read :-1
   0.23 normalizeString node:path:91
   0.23 Nc hook.mjs:185
   0.23 (program) :-1
   0.17 Mi hook.mjs:23
   0.16 getCLIOptionsFromBinding options:31
   0.14 dt hook.mjs:15
   0.13 stat :-1
   0.12 bu hook.mjs:21
```

### Search, 500 ctx_search calls, self time per profile (ms)

```
total 3791.51 ms/run
 909.33 ftsQuery server.mjs:31552
 885.22 porter server.mjs:31556
 353.88 withWrite server.mjs:28926
 249.38 (idle) :-1
 201.90 stmt server.mjs:31500
 176.28 closeDb server.mjs:28937
  92.36 typoTerms server.mjs:31527
  53.83 realpath :-1
  50.00 openReadOnly server.mjs:28892
  40.39 readUserVersion server.mjs:28857
  37.51 find server.mjs:29475
  34.52 (garbage collector) :-1
  34.51 buildSnippet server.mjs:29409
  31.71 compileSourceTextModule utils:337
  30.89 (anon) server.mjs:31565
```
