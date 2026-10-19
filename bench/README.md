# bench/ - offline context-saving replay (method)

`bench/replay.mjs` replays real Claude Code transcripts through the v2 policy code and counts bytes.
It is not a model run. It measures what the v2 hooks would change in the bytes the model receives.
It does not measure answer quality, task success, or what the model does next.

## Input

- `~/.claude/projects/*/*.jsonl`, one file per session. Each file is read as a stream, line by line.
- Files larger than 200 MB are skipped. The count is logged (stderr and the aggregate JSON).
- Nothing from the transcripts is committed. Raw per-session rows (they hold session ids and paths) go to
  `/private/tmp/cm-v2-impl-private/bench/` only. Only aggregates go into the repo.

## Pairing

A `tool_use` block (assistant message: id, name, input) is paired with the `tool_result` block that has the
same `tool_use_id` (user message). Duplicate results for one id in one file count once.
Lines with `isSidechain: true` are subagent calls.

## Bytes before (v1 / native reality)

UTF-8 bytes of the `tool_result` text parts (a string, or the `text` blocks of a content array).
Image blocks are not counted; their number is logged. This is what the model received in that session.

## Bytes after (v2)

The v2 code is used as a library: `src/core/policy/decide.ts` (`decide`, `denyMessage`), the adapter row
for `claude-code` (`src/adapters/table.ts`), `src/core/sandbox/cap.ts` (`capBytes`),
`src/core/index/chunk.ts` and `select.ts` (`chunkText`, `selectChunksInMemory`), and the constants in
`src/core/contracts/constants.ts`. The build (`node build/build.mjs`) is run first to prove the tree builds.
The user deny list is empty. For each paired call:

| v2 decision | bytes after |
| --- | --- |
| allow | same as before |
| deny (PreToolUse) | bytes of the deny text. The tool does not run. |
| hint (PreToolUse) | bytes before + bytes of the hint text, when the throttle fires |
| ctx_* tool (own tool, any prefix form) | same as before ("as is") |
| subagent call, result > OUTPUT_CAP (PostToolUse case B/C replace) | bytes of the selected chunks that `selectChunksInMemory` returns, at most OUTPUT_CAP, with intent = tool input `description` |

Hint throttle is modelled in memory with the same rules as `throttle.ts`: bash, read, grep hints once per
session; other-MCP hint on calls 1, 11, 21 ... per session (MCP_HINT_EVERY = 10).
Subagent tool set is unknown in a transcript, so `toolSet = null` and the case is C (impl/08 B4).

## Known approximations (they are stated in the results too)

1. Read deny: `decide` reads the file size from disk. The files in old transcripts are gone or changed.
   The replay uses the bytes of the Read result as the size, with no offset and no limit in the input.
   The result has line-number prefixes, so this size is a little above the file size.
2. A deny removes the tool run. The model then usually calls `ctx_execute`, and that reply is not in the
   transcript. The main number counts the deny text only (the task definition). A second column,
   "re-run bound", adds `min(bytes before, OUTPUT_CAP)` for every deny, as an upper bound on that cost.
3. Many sessions in the corpus ran with v1 hooks or with context-mode tools. Their "before" bytes already
   hold v1 effects. The saving here is v2 on top of what the model received, not v2 against a bare client.
4. No quality check. A smaller byte count can lose information the model needed.

## Statistics

Per tool and corpus total: calls, bytes before, bytes after, saving % = (before - after) / before.
Per-session median and p90 of the saving %, over the sessions that made at least one call of that tool
(p90 = nearest rank). Tool names are grouped: built-in names as they are, own `ctx_*` tools as they are,
every other MCP tool as `mcp:other`, anything else as `other`.

## Run

```
npm install --ignore-scripts --no-package-lock
node build/build.mjs --out /tmp/cm-bench-release-out
node bench/replay.mjs [--out <aggregate.json>]
```

Output: the aggregate JSON (committed values are copied to `docs/v2/benchmarks.md`, section "Offline replay")
and the private per-session rows in `/private/tmp/cm-v2-impl-private/bench/sessions.json`.
