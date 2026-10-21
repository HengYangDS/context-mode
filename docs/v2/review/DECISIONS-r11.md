# DECISIONS-r11: compaction "push, not pull"

- Status: Accepted (2026-10-21), owner decision.
- Input: T-CMP clean re-measure and re-score (D-FU-CMP-RESCORE-1). After compaction the model called `ctx_resume`/`ctx_search` in 0 of 50 clean sessions (all arms, pointer line included).
- Rule: a model does not call a tool for state it does not know it lost. No design may depend on that call.
- Scope: `OUTPUT_CAP` and `HOOK_*` do not change. Whole rows only, never cut.

## A. Anchored block at SessionStart(compact)

`renderState` (ADR-0009 §4-§5) stays the base. It is deterministic and byte-budgeted (`STATE_BUDGET` = 2048). The sections are in fixed order:

1. current goal: `now: <last user request>` (pinned, taken first)
2. open errors: `error #...`
3. last state of edited files: `edited <path> xN`
4. decisions: `decided #<seq>: <first line of the decision row>` (new)
5. earlier requests and indexed sources, then the `more:` line (the next step queries)

Decision rows (ADR-0009 §8.2) were never candidates (DECISIONS-r6 D3, DECISIONS-r9 F2/F8). This rule replaces that. A decision row now has `WEIGHT.decision` = 700 (under `toolerr` 900, over `prompt` 500). One candidate per decision key: the latest row wins, `repeatCount` = rows of that key.

## B. Turn-boundary recall

On every `UserPromptSubmit` after a compaction in that session:

1. `SessionStart(compact)` or `PreCompact` sets the meta key `compacted:<session>` (only on rows where recall applies).
2. The hook reads the newest `RECALL_MAX_ROWS` (340) non-cost rows of this session and of the same worktree's prior sessions (ADR-0009 §8 rule 2).
3. It ranks them by BM25 (`rankTexts`, the store tokenizer, "any" match) against the prompt text. The prompt's own row is not a candidate.
4. It injects rows with score >= `RECALL_MIN_SCORE` (5) as additionalContext, inside `<context_mode_recall>`, best first, within `RECALL_BUDGET_BYTES` (2048, wrapper included). A row that does not fit is skipped, never cut; output is seq ascending.
5. The injected seqs go to meta `recall_seen:<session>`; a row is never injected twice in a session.

No compaction in the session: the path returns allow with zero added bytes. Small-task cost does not change.

Threshold basis (probe on the T-CMP fixtures plus filler rows): the asked-for row scores 6.49 to 10.58; unrelated prompts top out at 4.08. 5 sits between them.

Per-agent rows (ADR-0001, one path per agent): recall runs on rows whose `encode` carries a `UserPromptSubmit` hint as additionalContext: claude-code, codex, gemini, qwen, copilot-cli, vscode, zcode (`hasRecall` in `src/adapters/table.ts`). kiro, pi and opencode keep their single compact path. On `pending-flag` rows the first prompt after compaction still gets the state block; recall starts on the next prompt.

## C. GS11

The GS11 call-rate gate measured the pull design. It is retired. GS11 = correctness (>= 0.80 in the arm with the shipped policy) plus the injected-bytes median, reported.
