# Search quality diagnosis (v2 `ctx_index` + `ctx_search`)

Status: in progress. Sections fill in as each step lands.

Trigger: fixture benchmark Part 2 (`bench/fixtures/results.json`) has "No hits" on 3 of 7
scenarios and 0 fenced code blocks returned whole. Owner request (2026-10-23): add search
layers to BM25 so the queries find their results.

## Plan of this spike

1. Root cause, with evidence (MATCH string, tokenizer, chunks, why no row matches).
2. Git archaeology of v1 search layers on origin/main.
3. Held-out labelled query set, frozen before any engine change.
4. Baseline numbers for v1 and current v2 on that set.
5. Fix plan: which layers, in which order, and which cause each one fixes.
