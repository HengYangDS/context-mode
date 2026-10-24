# compact round 3: short source handle (exp/r3-handle)

Branch `exp/r3-handle` from v2-design 5a79496d. Evals frozen: e2e/live/compact-hard (32f57beb), bench/m2 (69077b8a).

Defects on the base:
1. The D-CR2-HANDLE-1 line sits outside REPLACE_RETURN_BYTES; M2 main fell 92.47 (18e4a6cd) -> 84.03 (fbd4f781).
2. The line names the source by its full label ("Bash:cat config/deploy.json#toolu_..."). The model shortens it,
   and ctx_search filters with `label = :source`, so it gets "No hits ... across 0 source(s)".

Plan:
1. Every source gets a short stable id (`s` + rowid in base36). The handle line is one short line: id, size, call.
   ctx_search `source` resolves, in this order: the id, the full label, the label without the `#<call id>` suffix.
   Same for ctx_resume output.
2. The handle line counts inside REPLACE_RETURN_BYTES (selection budget = budget - handle bytes).
3. Measure M2 main, compaction main + heldout. Guards: oracles, GP5/GP6/GP7, D3, unit, prompt lint.

Results: filled in below.

## Results (time cap reached; not finished)

Commits on exp/r3-handle: 5996c145 (plan), c98b71a6 (short id + resolver + handle line inside the budget), next commit (label text kept in the handle line).

Done:
- `sources.id` is the stored short id: `s` + base36(id) (`sourceHandle` / `parseSourceHandle` in src/core/store/fts.ts; digit walk, no regex). No schema change: the AUTOINCREMENT key is already stored and never reused.
- `ctx_search` `source` resolves in this order: short id, full label, label without the `#<call id>` suffix (split on the last `#`, newest row wins). `resolveSourceLabel` in src/core/store/fts.ts; called once in the search handler.
- The replace path: one handle line replaces the more line and the D-CR2-HANDLE-1 line. Selection budget = REPLACE_RETURN_BYTES + bytes("\n" + 18e4a6cd more line) - bytes(handle line), so a replace is never larger than at 18e4a6cd.
- Golden tests: tests/v2/hooks/dispatch.test.mjs (D-CR3-HANDLE-1 golden line + byte bound), tests/v2/tools/search.test.mjs (id, full label, label without suffix; a partial label still gets 0 sources).

Not done:
- ctx_resume output does not use the id yet (indexed_sources lines come from journal keys, which carry no row id).
- Unit: 1387 tests, all failures except one are pre-existing on 5996c145 (cli/build tests need a build). New failure: tests/v2/bench/fixtures-run.test.mjs `run.mjs --check`: v2 hook bytes moved > 5% (part1 3010 vs 4817, part2 7573 vs 8293). The handle line keeps the full label as text (tests read `#<tool_use_id>`), so with REPLACE_RETURN_BYTES = 96 the selection budget falls near zero. Open question: drop the label text (needs the owner to accept a change to six label-reading assertions) or keep it and accept a smaller selection.
- No live run: M2 main, compaction main and heldout, D3 and prompt lint are not measured on this branch. No DEVIATIONS.md row yet.
