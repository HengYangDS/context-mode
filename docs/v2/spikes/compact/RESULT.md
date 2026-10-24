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
