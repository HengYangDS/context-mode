# DECISIONS-r10: run, then replace; no hints; shorter server instructions

- Status: Accepted (2026-10-20), owner decision.
- Inputs: offline replay of 820 real sessions (23,175 tool calls) and a quick live A/B.
- Scope: docs only. Code and the numbers `OUTPUT_CAP` and `HOOK_*` do not change.

## D1. Main agent: run, then replace

When a tool result is larger than `OUTPUT_CAP`, `PostToolUse` indexes the full output. It returns the BM25-selected chunks plus the "more" line through `updatedToolOutput`. This is the same path as subagent case C (`src/core/hooks/dispatch.ts`, step 5; ADR-0016). It is selection, not truncation, and not regex.

- Removed on agents whose adapter row supports replace: every Bash deny or rewrite that guesses the output size (curl/wget body to stdout, inline HTTP, build tools). The post-run replace takes over.
- Kept: user `permissions.deny`; the Read deny (the file size is known by `stat`; offline it saves 21%); subagent rules (ADR-0016); any rule that is a safety rule and not a size guess.
- Agents whose row has no replace keep their current single path. ADR-0001: one path per agent, no runtime fallback.

## D2. Hints removed

All `PreToolUse` and `PostToolUse` hint texts and their throttle keys are removed. Kept: the `SessionStart` resume line and compaction delivery (ADR-0009, D-M7-CL-1).

## D3. Server instructions about half the size

`src/prompt/instructions.md` (1,239 chars) shrinks to about half. The fixed cost per session, measured against no plugin, is +1,619 tokens (reply "ok") and +2,486 tokens (one Bash call).

## Evidence

| Rule tested offline | Calls | Effect |
|---|---|---|
| Deny on outputs <= 1 KB | 501 | -465 KB (-637 KB with re-run) |
| Deny on outputs 16-64 KB | 28 | +913 KB |
| Hints | 861 | -192 KB; no size bucket saves |
| Read deny | n/a | +21% saved |

Reading: a deny on a small output costs more than it saves, because the command is run again. A deny on a large output also costs more than it saves. Hints do not pay for themselves. Replace after the run sees the real size, so it does not guess.

## Effects on other docs

ADR-0008 (amended), ADR-0016 (main agent uses the same replace), TECH-SPEC (enforcement and hint lines), `docs/algorithms.md`, `docs/how-it-works.md`. Tests that encode the old behaviour are rewritten to the new one, with a `DEVIATIONS.md` row each.
