# M2 spike r4-json: JSON outputs answer the task

Status: in progress on exp/r4-m2-json (base exp/r3-combined bd4842fc). Frozen evals untouched.

## 1. What the model sees (combined, bench/m2 main, Claude Code 2.1.303, claude-sonnet-5-5)

json-1 (data/records.json, 501233 B, 3000 rows; task: the id with the highest score):

| run | calls (bytes the model saw) | total |
|---|---|---|
| off-1 | Read error from Claude Code (373 B: file > 256 KB) + Bash head + python (528 B) | 901 |
| v2-1 | Read deny from the PreToolUse hook (488 B) + ctx_execute python (142 B) | 630 |
| v2-2 | Read deny (488 B) + ctx_execute (144 B) | 632 |
| v2-3 | ctx_execute only (142 B) | 142 |

The Read deny text (488 B) is the largest part. It names three ways out (Read with offset, ctx_execute with
`file`, grep/tail) and holds the path twice. It says nothing about the file content, so the model must spend a
second call to learn the answer. The json-1 saving is ~30% when the model calls Read first.

big-json (data/orders.json, 204852 B, one row with "priority": true):

| run | calls (bytes) | total |
|---|---|---|
| v2-1 | Bash `cat` replaced by the more line only (211 B) + ctx_search (2194 B) + grep -B8 -A3 (285 B) | 2690 |
| v2-2 | Bash (211 B) + ctx_execute walk (189 B) | 400 |
| v2-3 | Bash (211 B) + ctx_execute walk (189 B) | 400 |

The Bash reply holds no digest, only the `ctx_search(...)` more line: the shape digest did not reach the
model. When the model then calls ctx_search with the query `"priority": true`, BM25 ranks the 48 B line chunks;
every chunk holds the words `priority` and `true`/`false` and the reply lists 20 near-equal line snippets
(`"priority": false,\n "items": [`), 2194 B with no amount. The model then needs a third call (grep).
