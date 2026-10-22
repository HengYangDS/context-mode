# Try-it pre-registration, amendment 1

Written and pushed before any new measured run. `prereg.md` does not change; this file adds to it. Earlier run
lines in `runs/*.jsonl` stay as they are. The analysis marks the lines this amendment replaces as **superseded**,
with the reason given below.

## What the first run showed

1. **web-scrape and docs-search, gateway arm: "no tool call" was a harness blind spot, not a skipped task.**
   In all 10 gateway sessions (warm-up + 4 cycles, both prompts) the client transcript has one turn and no
   `tool_use` block, so the completion oracle said `no-tool-call`. The gateway per-call record of the same session
   shows `edge_calls` = 1 (one session: 2) and tokens the client never saw (about 550 to 940 output tokens and
   about 14,000 cache-read tokens per session, `coverage.unseen_by_client`). The gateway ran the fetch as a tool call
   at its edge, inside the same request, and sent the client only the final text. The answers hold live data:
   the web-scrape answer starts "I fetched the Hacker News front page. It has **30 posts from 30 different
   domains**", and its titles and scores match the plain arm's own fetch in the same cycle (for example "Claude Duet",
   406). The docs-search answer starts "I fetched the page from react.dev/reference/react/useEffect (43 KB of text).
   I indexed it as `react-useEffect-docs`". So it was not a refusal, not a skill, and not an answer from training
   data. The run record cannot show the forwarded request body, so a memory block from an earlier session on the same
   tenant is not proved and not ruled out. The first run used one tenant per prompt with memory and skills on (flags
   read back), so a later cycle could see what an earlier cycle wrote. Fix 1 removes that risk.
2. **large-json, all arms: the oracle looked in the wrong place.** The first oracle read the served data back from
   disk. Every session built the 20,000 records in memory (a server script, then a fetch), so every arm failed
   with `no-served-data-on-disk`. The record at index 13000 is in the transcript: the tool_result of the fetch shows it.

## What changes

1. **Gateway tenant per session.** Each gateway session gets a new disposable tenant (id from stamp, prompt, role,
   cycle, attempt), proved by a dry-run preflight before the session. Flags stay at the default and are read back
   before and after each session, as before. Owner tenants are refused. The record carries `tenant_scope: "session"`.
2. **Edge calls count as tool calls** for the completion check (repo-research, web-scrape, docs-search,
   session-continuity): client `tool_use` blocks plus `edge_calls` from the gateway per-call record. A session with
   neither still fails `no-tool-call`.
3. **large-json oracle from the transcript.** The reference is the record object JSON-parsed from the last
   tool_result that served or generated index 13000 (an object whose `id` or `index` is 13000). Pass = every scalar
   leaf of that record appears whole in the final answer. No such tool_result: fail `no-record-in-tool-result`
   (fail closed). Text match only, no regex.

Harness: `bench/gateway-ab/tryit.patch` (diff of the harness from the first-run commit), SHA-256
`b59f8bb91928519d0c4367a0a10c9bf637cd631b4954079b4a04b3c54d7cc4b9`. Unit tests: `scripts/e2e/oss-arms-lib.test.mjs`, 14 pass.

## Re-score of the first run (note, not a result)

The old large-json transcripts, scored with the new oracle (private ledger only): measured cycles plain 3/4, v1 2/4,
v2 2/4, gateway 0/4. Every fail misses exactly one leaf, the long filler string (240 to 300 "x" characters) that the
answer shows in short form. These lines stay superseded; the new run gives the numbers.

## What re-runs

web-scrape, docs-search and large-json: all four arms, 1 warm-up + 4 measured cycles each, same model, client,
prompts, flags and stop rule as `prereg.md`. The first-run lines of these three prompts are marked superseded
(reasons 1 and 2 above). repo-research, git-history and session-continuity are not re-run; their gateway lines stay
and are flagged "tenant shared per prompt".
