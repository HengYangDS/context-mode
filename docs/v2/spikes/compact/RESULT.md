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

## Round 3: three builds, pick rule (2026-10-24)

Claude Code 2.1.303, claude-sonnet-5-5, effort low, `--budget 1`, `--jobs 9`, n = 3, v2 arm only, all runs
complete and valid (0 invalid). Builds: head = v2-design 5a79496d; handle = exp/r3-handle cccb08ca;
combined = exp/r3-combined bd4842fc (v2-design + exp/r3-handle + exp/r3-ledger).

| Build | main run 1 | main run 2 | main mean | spread | heldout | tokens after (main median) |
|---|---|---|---|---|---|---|
| head | 6/36 = 16.7% | 8/36 = 22.2% | 19.4% | 5.5 pt | 5/18 = 27.8% | 43,507 / 44,023 |
| handle | 7/36 = 19.4% | 8/36 = 22.2% | 20.8% | 2.8 pt | 8/18 = 44.4% | 43,456 / 43,616 |
| combined | 36/36 = 100% | 36/36 = 100% | 100% | 0 pt | 18/18 = 100% | 11,644 / 11,519 |

M2 main for the same builds: head 78.97, handle 85.02, combined 86.56 (`../m2/RESULT.md`, round 3).

Pick rule: a candidate needs M2 main >= 90, all oracles pass and guards pass; then the highest mean
compaction main wins. No build has M2 main >= 90, so no build is picked and nothing is merged into
v2-design. The compaction win of combined (the r3-ledger line units) is real on both runs and on heldout,
but it does not clear the M2 gate.

Notes:
- Head main 19.4% is under the r2 claim 44.4% and near the checker re-run 29.2%.
- Model-run `find /` calls hung sessions again. A watchdog killed 44 such `find` processes after 430 s
  (the runner turn timeout is 420 s and its kill does not reach the grandchild).
- Spend 23.51 USD of the 30 USD cap. Raw stream-json is in the private raw dir `compact-m2/r3-merge`.

### Round 3 checker re-run (2026-10-24, fresh clone, Claude Code 2.1.303, sonnet-5-5 low, `--budget 1`, `--jobs 9`, v2 arm)

| Build | main (n = 2) | heldout (n = 3) | tokens after (main median) |
|---|---|---|---|
| head (v2-design 5a79496d) | 7/24 = 29.2% | not re-run | 54,873 |
| combined (exp/r3-combined bd4842fc) | 24/24 = 100% | 17/17 valid = 100% (1 of 18 invalid, runner shows 94.4%) | 11,471 |

M2 main, same day, n = 3: head 86.18, combined 60.08. Combined big-json went from 2420 B to 3062 B
(-26.53%): in two of three runs the model called `ctx_search`, which returned 2194 B. All oracles 3/3.
One M2 run per build swings 7 to 26 points (round 3: head 78.97, combined 86.56), so a single M2 run cannot
decide the M2 >= 90 gate.

The combined win holds: the transcripts show the `<context_mode_recall>` block puts the asked log line
(`@Bash:cat -n logs/server.log#... line 1057: ... FATAL ...`) into the next prompt after compaction. The
watchdog killed 4 hung model-run `find /` processes. Live spend for the checker: about 9.1 USD.
Raw stream-json: private raw dir `compact-m2/r3-check/n2`.

## r4 finish smoke (exp/r3-combined after D-CR3-HANDLE-2, D-CR3-RESUME-1, D-CR3-WATCHDOG-1)

compact-hard main, v2 arm, n=1, claude-sonnet-5-5, Claude Code 2.1.303: 12/12 valid, 12/12 correct (100%),
retrieval call rate 0.5, ctx call rate 0.167, tokens after compaction median 22,185, hook bytes after median
1,350 B, cost $1.00. No hang. node --test tests/v2/: 1437 pass, 0 fail, 2 skip. gate --all --quick: exit 0.
