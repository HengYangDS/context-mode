# Performance

Every number here is copied from a measured source in this repo. Each row names the source, the date and the agent version.
A number with no measured source is not written here. Budgets come from `src/core/contracts/constants.ts` and TECH-SPEC §1 (GS6).

## Hook latency (GS6)

Source: `docs/v2/TECH-SPEC.md` §1.1 (M7 sign-off status, M7-S4). Measured 2026-10-20 on `origin/v2-design`, macOS, Node 26, one machine, other load not checked.
Agent: Claude Code (agent version not stated in the source). GS6 status: **FAIL**.

| Measure | Measured | Budget | Result |
|---|---|---|---|
| Claude Code `mcp_tool` hook, p95 wall (`T-GS6`, n=200) | 41 ms | `HOOK_P95_MS` 40 ms | FAIL |
| Command hooks, p95 wall (`T-GS6`) | 43 ms | `HOOK_COMBINED_P95_MS` 60 ms | pass |
| Command hooks, CPU over bare Node (`T-GS6`) | 20 ms | `HOOK_CPU_OVER_NODE_MS` 20 ms | pass |
| `T-F1` Case B, 65536 B PostToolUse, p95 wall (live run) | 62 ms | `HOOK_COMBINED_P95_MS` 60 ms | FAIL |
| `bench/hook-index.mjs`, 64 KB, p95 (50 runs x 3, loadavg 4.8 to 5.6) | 50.5 to 55.0 ms (before the fix: 58.4 to 82.7 ms) | none set for this script | as measured |
| `bench/hook-index.mjs`, 1 MiB, p95 | 113.8 to 120.8 ms (before the fix: 150.0 to 154.7 ms) | `HOOK_COMBINED_P95_MS` 60 ms | about 2x over |
| Live 1 MiB check | 134 ms | `HOOK_COMBINED_P95_MS` 60 ms | over |
| Bare Node, p95 | 31 to 33 ms | reference only | - |

The misses at 64 KB and in `T-GS6` are 1 to 2 ms over the budget. The 1 MiB case is about 2x over. Open items: `.impl/BLOCKED-M7.md`; fixes so far: D-M7-FT-1, D-M7-FT-2 in `docs/v2/impl/DEVIATIONS.md`.

## Context bytes

See `docs/v2/benchmarks.md` for the offline replay (byte count over real transcripts) and the live A/B run, and `docs/v2/prompt/results.md` for live routing.
A short summary is in the README "Benchmarks" section and in `docs/v2/LAUNCH.md`.
