# Ticket: re-measure T-CMP on Sonnet 5.5 (after M7)

- Status: owner accepted 2026-10-19. Keep D-M7-CL-1 (claude-code `compactSummary` "none": full block injected once after compaction) for now.
- Why: T-CMP live (Sonnet 5, effort low, 50 sessions, 10 per arm) -> 0/50 sessions called `ctx_resume` or `ctx_search`; correct-continue 5/10 to 7/10 (gate 0.80); pointer reached the model 50/50. This contradicts the pointer-only choice in DECISIONS-r6 D6.
- Next: after M7, re-run `e2e/live/compact/run.mjs` with `claude-sonnet-5-5` (and Opus 5.5 low for one arm). If the pointer arm passes the gate (correct >= 0.80, call rate >= 0.70), revert to D6; else keep D-M7-CL-1 and update ADR-0009 and DECISIONS-r6 D6 to match.

## Result (2026-10-19)

- Runner fixed: `e2e/live/compact/run.mjs` writes a full JSON result file per run (`--out`), plus `--model`, `--effort`, `--arms`; raw files in `e2e/live/compact/results/`.
- Sonnet 5.5 low, 10 sessions per arm: (a) correct 7/10, call 0/10; (b) 7/10, 0/10; (c) 7/10, 0/10; (d) 7/10, 0/10; (e) 7/10, 0/10. Cost 6.0232 USD.
- Opus 5.5 low, arm (a) only: correct 4/10, call 0/10; 3 of 10 sessions hit the 0.25 USD cap (empty reply). Cost 2.1133 USD.
- Rule applied: arm (a) fails (correct < 0.80, call rate < 0.70) on both models. `claude-code` `compactSummary` stays `"none"`. ADR-0009 §6 and DECISIONS-r6 D6 updated. `table.ts` and its tests unchanged.


## Clean re-measure (2026-10-21)

- Clean re-measure 2026-10-21 (isolation from D-M7-CL-3: no host auto-memory, no CLAUDE.md, no claude.ai MCP; 0 of 50 sessions touched memory), Sonnet 5.5 low, 10 sessions per arm, all arms, 0.25 USD cap: correct (a) 7/10, (b) 7/10, (c) 7/10, (d) 7/10, (e) 7/10; ctx_resume/ctx_search call rate 0/10 in every arm; bytes returned by those tools 0 in all 50 sessions; cost (a) 0.8682, (b) 0.9114, (c) 0.9014, (d) 0.8898, (e) 0.9514, total 4.5222 USD. Every miss is fixture session-03 (case-sensitive exactMatch, open for the owner). Result: arm (a) still fails both gates, so claude-code stays "none" (D-M7-CL-1). Result file: e2e/live/compact/results/2026-10-21-sonnet-5-5-clean-all-arms.json.
- Rule (decided in this ticket): arm (a) fails, so `claude-code` `compactSummary` stays `"none"`. No code change; `table.ts` untouched. Opus arm not re-run (task scope).
- Open for owner: case-sensitive `exactMatch` (session-03 is all 15 misses); a pointer-only call rate of 0 means the model does not use the pointer at low effort.
