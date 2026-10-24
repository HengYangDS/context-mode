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
