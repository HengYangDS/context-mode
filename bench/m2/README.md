# bench/m2: frozen M2 eval (main + heldout)

M2 = live saving: UTF-8 bytes of tool_result content the model saw in arm v2 vs arm off (no plugin),
per workload, median over workloads. Definition from `bench/saving-score.mjs` (frozen, see `bench/saving-score.lock`).

- `main` set: the 4 frozen SCORE_TASKS of `bench/live/score-tasks.mjs` (json-1, multi-1, big-tests, big-json).
- `heldout` set: `bench/m2/heldout/tasks.mjs`. Candidates that tune M2 must not read or tune on it.

Work in progress: eval command and baseline follow in the next commits.
