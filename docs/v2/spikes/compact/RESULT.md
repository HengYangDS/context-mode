# Compaction recall: result (round 1 and round 2)

Eval: `e2e/live/compact-hard` (frozen at 32f57beb). Claude Code 2.1.303, `--budget 1` per session, n = 3 unless
stated. Score = correct answers after a real `/compact`, of valid runs.

| Candidate | Model | main | heldout |
|---|---|---|---|
| direct (no context-mode) | sonnet-5-5 | 72.2% | - |
| v2 before round 1 | sonnet-5-5 | 2/36 = 5.6% | - |
| r1 a-ledger (BM25 line ledger) | sonnet-5-5 | 9/33 = 27.3% | 6/18 = 33.3% |
| r1 a-push (MMR push block) | sonnet-5-5 | 6/36 = 16.7% | 3/18 = 16.7% |
| r1 a-pull | - | plan only | - |
| r2 base (v2-design 26cdd6df) | sonnet-5-5 | 5/36 = 13.9% | - |
| r2 step 1, session id (D-CR2-SID-1) | sonnet-5-5 | 6/36 = 16.7% | - |
| r2 step 3, handle line (D-CR2-HANDLE-1) | sonnet-5-5 | 16/36 = 44.4% | 3/18 = 16.7% |
| r2 step 3 | opus-5-5, n = 2 | 15/24 = 62.5% | - |

Step 2 found the cause of the empty post-compact hook output: the host cuts `tool_response.stdout` to
30,000 chars and keeps the rest in `persistedOutputPath`; and after that fix (other track, D-M2-SHAPE-2) a row
larger than RECALL_BUDGET_BYTES is skipped whole by pickRecall. Step 4 (precomputed ledger lines) was not done.

Losses and gap:
- main 44.4% is 27.8 points under direct (72.2%).
- heldout 16.7% is under a-ledger's 33.3%: the handle helps where the model's search terms hit the line
  (config, tests); it does not help dist-* manifests (0/3 sonnet, 0/2 opus) or most heldout questions.
- tokens after compaction rose (median 42,259 -> 55,229) from the model's own ctx_search calls.
- 11 to 17 sessions per run hung on a model-run `find /`; the runner kill does not reach the grandchild.
- Manual watchdog for the frozen runners (`e2e/live/compact-hard/run.mjs`, `bench/m2/eval.mjs` import no shared
  harness, so they keep `child.kill()`): while a run is going, kill any model-run `find` older than the turn
  timeout from a second shell, for example `while sleep 30; do pkill -9 -o -f '^find /' ; done`, then stop the loop
  when the run ends. The run then reads the closed pipe and goes on. New runs use `e2e/live/lib/proc-group.mjs`
  (`spawnGroup` + `watchdog`: SIGKILL to the whole process group, D-CR3-WATCHDOG-1).

Details: `r2.md`, `a-ledger.md`, `a-push.md`. Guards: `r2.md` "Guards".

## r4 finish smoke (exp/r3-combined after D-CR3-HANDLE-2, D-CR3-RESUME-1, D-CR3-WATCHDOG-1)

compact-hard main, v2 arm, n=1, claude-sonnet-5-5, Claude Code 2.1.303: 12/12 valid, 12/12 correct (100%),
retrieval call rate 0.5, ctx call rate 0.167, tokens after compaction median 22,185, hook bytes after median
1,350 B, cost $1.00. No hang. node --test tests/v2/: 1437 pass, 0 fail, 2 skip. gate --all --quick: exit 0.
