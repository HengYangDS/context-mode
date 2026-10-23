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

## Harness note (before the baseline counted)

The first v2 baseline ran with `--strict-mcp-config` and `--plugin-dir`. The init event showed
`mcp_servers: []`: the plugin's MCP server did not load, so that run is void (kept in the private raw dir only).
The v2 arm now follows `e2e/live/run.mjs`: `--plugin-dir`, no `--strict-mcp-config`. A v2 run whose init event
has no connected context-mode server is invalid and counts as wrong (fail closed).

## Diagnosis (transcripts, claude-sonnet-5-5, Claude Code 2.1.303)

What the model sees after compaction in the v2 arm (SessionStart source=compact, additionalContext, 353 B):

    <context_mode_state session="<sid>" upto="2">
    now: Run `cat -n logs/server.log` with the Bash tool and read the whole output. ...
    more: ctx_search(queries:[], scope:"session")
    </context_mode_state>

Why the model does not use it:

1. The block lists no tool output. Journal rows `cmd` with `ok = 1` only resolve errors (ADR-0009 §3), so a
   large, successful tool result never becomes a candidate or a pointer line. The block names no value, no
   source label and no `#seq`.
2. The `more:` line has an empty query list. It does not say what is stored, so the model has no reason to call it.
3. Before compaction, PostToolUse replaced the 222 KB output with BM25 chunks picked by the command text
   (`cat -n logs/server.log`), for example `ms GET /v1/orders 200` lines. The model never saw the values, and its
   own compact summary says so: "The output showed four GET requests ... Two lines had a missing latency value".
   After compaction it does not know a value exists to retrieve. It re-runs `cat`, finds the file gone, and
   answers `unknown`.

The direct arm answers from the host's own saved copy of the oversized Bash output (the compact summary keeps
its path: "The full cat output is persisted at .../tool-results/..."), then greps it.
