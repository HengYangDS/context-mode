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

## Round 4: interleaved measure and merge rule (2026-10-24)

Builds: HEAD = v2-design 60f2991d; FINAL = exp/r4-final bf9c810a (exp/r4-m2-json rebased on the finished
exp/r3-combined 0899441b). Claude Code 2.1.303, claude-sonnet-5-5, effort low, `--budget 1`, `--jobs 9`, n = 3,
v2 arm. Order: H, F, H, F (M2 runs between them), then FINAL heldout.

| Run | correct | valid | tokens after (median) | hook bytes after (median) | retrieval rate | ctx rate | cost USD |
|---|---|---|---|---|---|---|---|
| HEAD main 1 | 14/36 = 38.9% (14/35 valid = 40.0%) | 35 | 45,499 | 353 | 1 | 0.778 | 3.16 |
| FINAL main 1 | 36/36 = 100% | 36 | 11,606 | 1,338 | 0.417 | 0.194 | 2.27 |
| HEAD main 2 | 16/36 = 44.4% | 36 | 66,721 | 353 | 1 | 0.917 | 3.70 |
| FINAL main 2 | 36/36 = 100% | 36 | 11,731 | 1,338 | 0.472 | 0.194 | 2.22 |
| FINAL heldout | 18/18 = 100% | 18 | 21,981 | 2,260 | 0.556 | 0.056 | 1.16 |

Mean (min-max): HEAD 41.65% (38.9-44.4), FINAL 100% (100-100). Rule: mean(FINAL) >= mean(HEAD) + 30 and FINAL
heldout >= 80% valid-correct. 100 >= 71.65 and heldout 100%: met. With M2 and guards also met
(`../m2/RESULT.md` round 4), exp/r4-final is merged into v2-design (2c40245e).

A manual watchdog (`find /` older than 420 s, SIGKILL) killed 25 model-run `find` processes; no run hung.
Live spend for round 4: 19.20 USD (cap 40). Raw stream-json: private raw dir `compact-m2/r4-meas`.

## Round 4 review item 1: process-group kill in live runners (D-CR3-WATCHDOG-1)

Non-frozen runners that spawn `claude -p` now use `e2e/live/lib/proc-group.mjs`: `e2e/live/run.mjs`,
`e2e/live/routing/run.mjs`, `e2e/live/compact/session.mjs`, `bench/live/run.mjs`, `bench/live/ab-quick.mjs`,
`bench/saving-score.mjs`. A timeout sends SIGKILL to the whole process group, so a grandchild cannot keep the
stdout pipe open. Test: `tests/v2/e2e/live-runner-group.test.mjs` (red commit 368acb65 first).

Frozen runners are NOT changed: `e2e/live/compact-hard/*` and `bench/m2/*`. They run without the group helper.
Guard for a frozen run is a manual watchdog. Start it in a second shell while the run is live. It kills
`find /` processes that run past 420 s (the round 4 limit). Exact command (not run in this batch):

    ps -axo pid=,etime=,command= | awk '/find \/( |$)/ {print $1}' | xargs -r kill -9

Check the list it prints before you kill. The etime column is `[[dd-]hh:]mm:ss`, so filter on age in the shell
if the run can keep such processes for a long time.

## D3 on the merged head

Builds: HEAD = v2-design edabbb38 (includes the item 1 change). PRE = 5a79496d (pre round 3). Host: darwin, Node v26.8.1.
Each measurement interleaves HEAD and PRE on the same host and run.

hook-gs6 (`bench/hook-gs6.mjs`, 40 runs per event, 6 rounds each, ABABAB). `p95Ms` is the combined wall
(spawn plus hook body; budget 60 ms). `cpuOverNodeMs` is the hook CPU p95 minus bare Node CPU p95 (budget 20 ms).

| Round | HEAD p95Ms | PRE p95Ms | HEAD cpuOverNodeMs | PRE cpuOverNodeMs |
|---|---|---|---|---|
| 1 | 40.7 | 40.0 | 6.4 | 5.3 |
| 2 | 39.7 | 39.1 | 6.9 | 6.3 |
| 3 | 39.6 | 39.4 | 6.3 | 5.9 |
| 4 | 39.3 | 40.2 | 4.5 | 6.6 |
| 5 | 40.7 | 41.0 | 7.3 | 5.4 |
| 6 | 41.3 | 40.2 | 7.1 | 6.4 |
| Median | 40.2 | 40.1 | 6.65 | 6.1 |

Paired median difference, p95Ms (HEAD minus PRE): +0.4 ms.

setup-hook-overhead (`e2e/checks/setup-hook-overhead.mjs`, budget 15 ms, 5 batches of 40 pairs, gate = lowest batch p95):

| Agent | HEAD overheadMs | PRE overheadMs | HEAD batches | PRE batches |
|---|---|---|---|---|
| claude-code | 6 | 6 | 6, 8, 6, 7, 8 | 7, 7, 7, 7, 6 |
| codex | 6 | 6 | 8, 6, 8, 7, 7 | 8, 6, 7, 7, 7 |

Both builds pass the 15 ms gate. Cold first call: HEAD claude-code 9 ms, PRE 7 ms (info only).

PostToolUse on the 222 KB compact-hard serverLog fixture (`serverLog(101).text`, 222,418 bytes, n = 20 each, interleaved).
Wall is the full spawn of the hook. Bare Node wall was about 29 ms in the gate run above.

| Build | Median wall ms | p95 wall ms |
|---|---|---|
| HEAD | 147.2 | 177.6 |
| PRE | 59.4 | 68.0 |

Paired median difference (HEAD minus PRE): +79.9 ms.

Verdict: the merged head passes the 15 ms overhead budget on the common path (gate overhead 6 ms, combined p95 40 ms,
CPU over Node 6.65 ms). On the 222 KB PostToolUse event the merged head is over the 15 ms budget. Its overhead over
bare Node is about 118 ms (147 ms minus about 29 ms), against about 30 ms for PRE. This was measured, not fixed here.

## Round 4 checker

Round 4 checker (fresh clone of v2-design 24a42ab4, Claude Code 2.1.303, claude-sonnet-5-5 low, `--budget 1`,
`--jobs 9`, v2 arm): main n=2 24/24 valid, 24/24 correct (100%), tokens after median 32,396, hook bytes after
median 1,338, $1.45; heldout n=3 18/18 valid, 18/18 correct (100%), tokens after median 32,994, $1.35.
Tokens after compaction are two groups per question (about 10.5-11.5k, or 21-62k when the model re-reads after
the recall block), so the median of one run moves between them; the round 4 figure 11,606 is one side of that
split, not a stable value. In 6 transcripts read (4 main, 2 heldout) the answer reached the model only in the
UserPromptSubmit recall block; no tool result after compaction held it. Two model-run `find /` grandchildren
hung the frozen runner (heldout, `h-cfg-audit-mem`); a manual SIGKILL after 11 min freed it, both runs scored.

## D3 on the merged head, re-measured (r4g-perf)

The +79.9 ms above is mostly a measurement error. HEAD and PRE shared one HOME, so one store. The first HEAD
call moved the store to schema 5. Every PRE call after that failed `SCHEMA_STALE` ("context.db schema is version 5,
expected 4") and skipped its journal and index writes. PRE did less work, so it looked faster.
`bench/hook-large-post.mjs` now gives each bundle its own HOME and repo, and fails on any stderr line.

Event: PostToolUse, Bash `cat -n logs/server.log`, `serverLog(101)` (222,418 B). Host darwin, interleaved
PRE/HEAD, n=20 each, one HOME per bundle. PRE = 5a79496d, HEAD = v2-design a9f30767.

| Node | PRE median / p95 ms | HEAD median / p95 ms | paired median HEAD-PRE ms |
|---|---|---|---|
| v26.8.1 | 118.2 / 149.3 | 126.4 / 158.7 | +11.1 |
| v24.15.0 | 105.3 / 120.3 | 117.4 / 137.7 | +11.0 |

Where the +11 ms goes (`--cpu-prof`, both Node versions): the chunk write (porter + trigram, 6000 rows) is the same
in both builds. The new cost is `insertUnits`: 2000 `line_units` rows, about 18 ms CPU in the cold hook process
and 6.3 ms (v26) / 5.7 ms (v24) in a warm micro run. `buildUnits` is 0.4-0.5 ms. Changes tried in the micro run
that did not help: one transaction for chunks and units (40.1 vs 40.1 ms), one `json_each` insert statement
(39.3 vs 39.3 ms), `detail=none` or `columnsize=0` (under 0.5 ms). A HEAD build with the unit write switched off
was 6.4 ms faster than PRE in the same interleaved run (load average 6.9, so noisy). The cost is the FTS5
tokenization of the 222 KB a second time, not statement setup. The detached write does not help the wall:
the hook process stays up until the event loop is empty (D-M3-H2-8).

Open: the target (within 10 ms of PRE) is missed by about 1 ms. A real cut needs units out of the hook process
(for example, build them from the stored chunks the first time recall asks). That is a design change, not done here.

D3 gate (PreToolUse `true`, codex, overhead = median wall minus bare `node -e ""`, n=40, one HOME per bundle):

| Node | PRE ms | HEAD ms |
|---|---|---|
| v26.8.1 | 8.8 | 9.2 |
| v24.15.0 | 8.0 | 7.5 |

The common hook path did not get slower on darwin. The bundle grew 101,141 B -> 106,363 B; the build uses
`splitting: false`, so a lazy `import()` would stay in the same file and save no parse time. Windows CI runs
40103915339 and 40104728664 failed the 15 ms gate with batches of 13-25 ms; in 40104728664 the Node 26 Windows job
passed on the same head. The budget stays 15 ms.

### Round 4g re-check (darwin, Node v26.8.1, PRE = 5a79496d, HEAD = 312dee8f)

| Measure | PRE | HEAD |
|---|---|---|
| 222 KB PostToolUse, interleaved n=20, median / p95 ms | 120.7 / 132.0 | 129.4 / 152.8 (paired +10.0) |
| Hook with no agent (module load only), n=140, median / p95 ms | 36.06 / 38.40 | 35.72 / 37.85 |
| PreToolUse `true`, codex, n=140, median / p95 ms | 36.38 / 39.01 | 35.06 / 37.22 |
| Hook write, 222 KB, units insert only (6 runs) | n/a | 8.0-12.4 ms (chunks 36-69 ms) |

The small-event path is not slower than PRE: module load and the codex PreToolUse run match PRE within noise,
and a compile cache does not change them. So the Windows D3 failures (13-16 ms against 15) are not a code
regression we can find on darwin; runs 40103915339 and 40104728664 differ on the same head, which points to
runner noise. The budget stays 15 ms. The 222 KB gap is +10 ms, all from the second FTS5 tokenization in
`insertUnits`. Moving it out of the hook process needs a design change (build units from stored chunks on the
first recall), not done in this round.
