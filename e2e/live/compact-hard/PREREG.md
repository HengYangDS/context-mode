# compact-hard: preregistration

Status: draft, written before any run of this set.

## Question

After a Claude Code compaction, does the model answer questions whose exact answer lives only in a large
tool output from before the compaction (not in a user prompt), and does it read the context-mode store to get it?

The older T-CMP probe (`e2e/live/compact/`) put every fact in a user prompt. The host compact summary keeps
user prompts, so all arms scored the same and no arm needed retrieval. This set puts the facts in tool output.

## Arms

- `direct`: no plugin. Same built-in tools. The facts exist only in the pre-compaction tool results.
- `v2`: the built release-out as `--plugin-dir`, unchanged.

## Model, runs, budget

- Search model: `claude-sonnet-5-5`. Confirm model for the winner: `claude-opus-5-5`.
- n = 3 runs per question per arm. `--max-budget-usd 1` per session.

## Metrics

- Primary: correct answers on the main set after compaction, % over all runs.
- Secondary: retrieval calls after compaction (ctx_search, ctx_resume, ctx_execute, Read, Bash, Grep),
  tokens added after compaction, wall time per session.

## Oracle

Each question asks for one answer line `ANSWER: <value>`. The scorer takes the last line of the final text
that starts with `ANSWER:`, trims it, and compares it to the fixture value with `===`. No regex, no partial match.
