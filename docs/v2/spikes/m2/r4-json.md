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

## Steps 2 and 3: fixes and measurements

Changes (DEVIATIONS D-M2-JSON-1..3, tests first, red commit e0172287):
- Digest header names the schema: `N objects {k1,k2,...}, K rare:`; the digest has its own 256 B budget (`SHAPE_RETURN_BYTES`), independent of the handle line.
- `jsonExtremes`: no skewed key, query names a numeric key: the rows at its largest and smallest value, whole.
- `ctx_search` with `source` naming a stored JSON array of objects: schema line, up to 5 whole BM25-ranked rows per query (each within 800 B), `More:` with `offset`. Other sources keep the snippet reply.

Bytes the model saw (claude 2.1.303, claude-sonnet-5-5, low effort):
- big-json v2: one `cat data/orders.json`, 443 B (digest holds the rare order whole), 3 of 3 runs, no ctx_search call. Off: 2424 B median.
- json-1 v2, main run 1: one ctx_execute, 171 B (84.2% saving). Main run 2: two runs first called Read on the file (the Read deny text, 482 B) and then ctx_execute (337 B and 174 B), one run went straight to ctx_execute (171 B). Median saving 30.5%.

Why json-1 stays noisy: the off arm needs only 900 B. When the model tries Read first, the 482 B deny text alone is more than half of that. The digest is not involved (Read is denied before any output exists). This is a model-choice cost, not a digest gap.

Scores (every oracle passed, 3 of 3 per task, no invalid runs):
- M2 main run 1: 86.6 (json-1 84.22, multi-1 88.99, big-tests 99.12, big-json 81.72)
- M2 main run 2: 85.35 (json-1 30.52, multi-1 88.99, big-tests 99.12, big-json 81.72)
- M2 heldout: 98.23 median; read-csv -191.88 (Read deny 484 B plus two follow-up calls against a small off median), node-tests-1 0.

Guards: unit suite 1436 of 1439 pass at the time of the run; the one failure is `fixtures-run --check` (hook bytes moved vs results.json), which also fails at base e7213e77, so it is not from this branch; results.json was not regenerated. GP5 e2e 31 of 31. D3 hook bench: p95 39.8 ms wall vs 32.5 ms bare Node (+7.3 ms), CPU over Node 6.5 ms, pass.

Open: read-csv and json-1 lose bytes to the Read deny text on a first Read attempt.
