# S-SYN: ADR-0019 spike results, merged

Date: 2026-10-22. Role: ADR editor. Status: draft 1 (ADR and PRD edits follow in the next commit).

## Question

What do the six setup spikes (S-NPM, S-PATH, S-HOOK, S-EXT, S-UI, S-V1) change in ADR-0019 and PRD-setup, and what is left for the owner?

## Method

Read ADR-0019, PRD-setup and the six result files in `docs/v2/spikes/setup/`. Compare each result to the ADR-0019 pass column. Move each "what the ADR must change" item into the ADR or PRD, or into "Owner decisions" when only the owner can act.

## Results (draft)

| Id | Pass | Short result |
|---|---|---|
| S-NPM | FAIL | dry-run OK; OIDC and provenance only provable by a real publish |
| S-PATH | PASS | 6 of 6 layouts; nvm, fnm, Volta not run |
| S-HOOK | FAIL | abs path p95 47.8 ms (Post), 41.1 ms (Pre); bare node start is 31.7 ms p95 |
| S-EXT | PASS | Gemini and Qwen link from the npm dir; hook run by hand, not by a live session |
| S-UI | PASS (macOS only) | clack and readline both work; Linux and Windows pty not run |
| S-V1 | FAIL | list complete (9 of 10 agents); no test per row yet |
