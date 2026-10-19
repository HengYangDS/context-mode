# M7 blocked (2026-10-19)

M7 is not marked done. Open items and the decision each one needs:

1. GS6 T-GS6: Claude Code hook p95 41 ms > HOOK_P95_MS 40 (n=200). Command hooks pass (wall p95 48 ms, CPU over Node 20 ms). Bare node p95 alone is 34 to 50 ms under load on this machine. Decision: owner re-measures on an idle machine, or approves a next hook step (lazy policy/index import, crypto-free projectKey; about 3 to 10 ms CPU each). No budget was changed.
2. GS6 T-F1: Case B 1 MiB PostToolUse wall p95 166 ms > HOOK_COMBINED_P95_MS 60. The cost scales above OUTPUT_CAP: ftsInsert 34 ms and rankTexts 19 ms per call. 64 KB p95 is 65 to 95 ms. Decision: make the FTS index path async or deferred, or the owner states the budget does not apply to 1 MiB payloads.
3. GS11 T-CMP: arm a correct 7/10 (Sonnet 5.5 low) and 4/10 (Opus 5.5 low) < 0.80; call rate 0/10 < 0.70 on both; 0 returned bytes in 60 sessions. The model never calls ctx_resume or ctx_search from the pointer line. Decision: owner picks a new compaction pointer design, or accepts compactSummary "none" for claude-code and rewrites the GS11 criterion (numbers in D-M7-CL-2).
4. v2-unit: 1061/1063, 2 tests do not pass in all 3 gate runs, and the gate reports PASS. Not investigated. Decision: find the 2 tests; fix the gate so a non-passing test fails it.
5. Gate live step ran 0/31 cases (no changed file matched). Decision: make `--milestone M7` run all live cases.
6. GS10 R1, R2: PENDING owner (D-M7-arch-5). GS2, GS3: PENDING release.
