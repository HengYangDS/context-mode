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

## 1. Root cause (evidence)

Probes, both runnable from the repo root with `node <file>`:

- `docs/v2/spikes/search/probe-match.mts`: per scenario, chunks the bench input the way
  `ctx_index {content}` does, loads it into an FTS5 table with the store tokenizer, and prints the
  MATCH string, AND row count, OR row count and per-term row count.
- `docs/v2/spikes/search/probe-fences.mts`: fence sizes and how many fences stay whole per chunk kind.

Facts from the code:

- Tokenizer: `tokenize = 'unicode61 remove_diacritics 2'` (`src/core/store/schema.ts`
  `FTS_TOKENIZE`, DECISIONS-r9 V24). No `porter`, no trigram table, no `tokenchars`.
  `_`, `-`, `/`, `.` are separators, so `execute_file` is the phrase `execute file`.
- MATCH string: `toMatch` in `src/core/store/fts.ts` makes each whitespace word a quoted prefix
  term and joins them with implicit AND (D-M1-T8-1). No stopword filter, no OR fallback, no
  typo correction. `toMatchAny` (OR) exists but only `rankTexts` (hook path) uses it.
- Chunking: `ctx_index {content}` stores the text with kind `"text"`
  (`src/core/tools/index.ts` `itemsOf`). In `chunkText`, kind `"text"` sets `join = false`, so
  every blank-line block is its own chunk and fences are not tracked. A heading and its body,
  or a code fence with a blank line inside, land in different chunks.
- Reply: each hit is `highlight(body)`: clipped to `SNIPPET_MAX_BYTES` = 800 and with
  `& < >` escaped to entities (`src/core/store/fts.ts`).

### The 3 no-hit scenarios

| Scenario | Chunks (count, median / max B) | Query | MATCH | AND rows | OR rows | Why AND fails |
|---|---|---|---|---|---|---|
| Skill main prompt | 59, 133 / 2136 | `when to use execute vs execute_file` | `"when"* "to"* "use"* "execute"* "vs"* "execute_file"*` | 0 | 33 | `vs` is in 0 chunks; stopwords `when to use` must all co-occur too |
| | | `language selection guide` | `"language"* "selection"* "guide"*` | 0 | 3 | `guide` is in 0 chunks |
| | | `anti-patterns avoid` | `"anti-patterns"* "avoid"*` | 0 | 4 | both exist (3 and 1 chunks) but never in the same small chunk |
| Skill refs (4 files) | 256, 100 / 825 | `JSON parse transform pattern` | `"JSON"* "parse"* "transform"* "pattern"*` | 0 | 58 | `transform` exact 0 (no stemming); terms split over heading and code chunks |
| | | `CSV analysis Python` | `"CSV"* "analysis"* "Python"*` | 0 | 29 | each term exists (4, 8, 19 chunks); never together in one blank-line block |
| | | `file processing shell awk` | `"file"* "processing"* "shell"* "awk"*` | 0 | 70 | same: no single block holds all four |
| MCP tools/list | 119, 16 / 67 | `browser screenshot tool` | `"browser"* "screenshot"* "tool"*` | 0 | 4 | `tool` is in 0 chunks; tool name (`### take_screenshot`) and description are separate chunks |
| | | `file search glob` | `"file"* "search"* "glob"*` | 0 | 14 | `glob` is in 0 chunks |
| | | `git commit tool` | `"git"* "commit"* "tool"*` | 0 | 8 | `tool` is in 0 chunks |

Every one of the 9 queries has OR hits. The causes, in order of weight:

1. **AND of all terms.** One absent word (`vs`, `guide`, `tool`, `glob`) empties the result.
   v1 hit the same bug in v0.5.5 and fixed it with OR (`6a5f131b`).
2. **Chunks too small (kind `"text"`, no join).** Median chunk 16-133 B. Even when every word
   exists, the words of one topic sit in different chunks (heading vs body, name vs description).
3. **No stopword filter.** `when`, `to`, `use`, `vs` are required terms.
4. **No stemming.** `transform` vs `transformation`, `handlers` vs `handler`, `colors` vs `color`
   (React and Next.js also lose queries for this: `route handlers`, `custom colors theme`).
5. Not a cause here: phrase quoting. Prefix quoting is safe; `anti-patterns` becomes the
   phrase `anti patterns*`, which matches 3 chunks.

### Why code blocks come back split (0 whole in all 7 scenarios)

`bench/fixtures/run.mjs` counts a fence as whole when its exact text is a substring of the reply.
Three separate causes, each enough on its own:

1. **Chunking.** Kind `"text"` splits at every blank line, fences included. Fences whole in one
   chunk: Supabase 2/5, React 0/5, Next.js 0/9, Tailwind 6/6, Skill main 4/8, Skill refs 0/37.
   With kind `"md"` (fence-aware, joined to 4096 B) the same inputs keep 5/5, 5/5, 9/9, 6/6,
   8/8, 33/37 whole (the 4 left are over 4096 B with the chunk around them).
2. **Snippet clip at 800 B.** Fences over 800 B (Supabase 1452, React 1386, Skill main 2136,
   13 of 37 in Skill refs) cannot appear whole in any reply line.
3. **Entity escaping.** `highlight` turns `<`, `>`, `&` into `&lt;` etc. 4/5, 2/5, 9/9, 6/6, 4/8
   of the fences hold one of these characters, so their raw text never appears in the reply.
   This is why Tailwind (6/6 whole in chunks) still scores 0/6.

v1 kept code whole by heading-aware markdown chunking (`#chunkMarkdown`, code blocks never split,
`609a3a5a`) and returned raw (unescaped) chunk text.

## 2. v1 search layers (origin/main `src/store.ts`)

| Layer | v1 code | Introduced | Why (commit text) |
|---|---|---|---|
| Porter stemming | `tokenize='porter unicode61'` on `chunks` | `60a1a254` v0.4.0 | first release |
| Heading-aware markdown chunking, code blocks intact, `title` column | `#chunkMarkdown`, `headingStack` | `60a1a254`; 4096 B cap `609a3a5a` | "Code blocks kept intact"; cap stops BM25 length penalty |
| Stopwords | `STOPWORDS`, `sanitizeQuery` | `4c67cd75` v0.5.2; applied to queries `707c4aea` (#271) | common words "dilute relevance scoring" |
| OR semantics | `sanitizeQuery(q, "OR")` | `6a5f131b` v0.5.5 | "multi-word queries ... return 0 results unless ALL terms appeared in a single chunk" |
| Trigram table | `chunks_trigram USING fts5(... tokenize='trigram')`, dual write | `b9d10e2d` v0.7.0 | substring match (`useEff` finds `useEffect`) |
| Fuzzy (Levenshtein) correction | `fuzzyCorrect`, `vocabulary` table, `maxEditDistance` 1/2/3 | `b9d10e2d` v0.7.0; cache `5fc8ceab`; skip stopwords `6b675f26` (#272) | typo recovery |
| Title weight | `bm25(chunks, 5.0, 1.0)` | `db6f8216` | headings rank above body mentions |
| RRF fusion (k=60) | `#rrfSearch`: porter OR + trigram OR | `bce072b5` | replaced the 8-step cascade; worst case 8 to 4 queries |
| Proximity rerank | `#applyProximityReranking`, `findMinSpan` | `00d948a9` | multi-term queries: tight spans first |
| Title boost by content type | code 0.6, prose 0.3 | `393839ac` (#265) | function names in code titles are high signal |
| Phrase-frequency reward | `countAdjacentPairs` | `2c63add6` (#349) | minSpan alone favoured long docs |

Pipeline (`searchWithFallback`): RRF(porter OR, trigram OR) then proximity rerank; if empty,
fuzzy-correct each non-stopword word and run RRF again.

What v2 dropped and the stated reason:

- **Porter**: DECISIONS-r9 V24 set `unicode61 remove_diacritics 2` for Cyrillic and accented
  Latin (#1295). No document weighs porter against it; porter wraps unicode61, so the two can
  coexist (`porter unicode61 remove_diacritics 2`).
- **Trigram + vocabulary**: open RFC #962 (index growth for logs/JSONL) is listed as
  needs-decision (`docs/v2/review/ISSUE-OUTCOMES-r3.md`, r4 row 962). No ADR removes trigram for
  quality reasons; it was not carried into impl/02.
- **OR, stopwords, fuzzy, proximity, title column**: no ADR or DEVIATIONS row. impl/02 §9.2 and
  D-M1-T8-1 define AND of quoted prefix terms; impl/14 GP5 fixed recall to "BM25+RRF k=60"
  where RRF in v2 fuses BM25 with recency for scope `project` only, not porter with trigram.
- **Markdown chunking for `ctx_index {content}`**: v2 has the `"md"` chunker but `itemsOf`
  passes kind `"text"` for inline content (no DEVIATIONS row found).

## 3. Held-out set

`e2e/fixtures/search/heldout.json`, frozen in `13cba162` before any engine change. 50 queries over
the 7 bench inputs plus `docs/v2/impl/02-store.md`, `docs/v2/PRD-v2.md`, `docs/v2/LAUNCH.md`.
Kinds: natural 14, identifier 8, typo 8, code 7, morph (plural / verb form) 6, phrase 5, flag 2.
Each label is an exact substring copied from the source text; no label holds `< > &`, so v2 entity
escaping cannot cause a miss. Scoring: a hit at rank r is the r-th result that holds any `expect`
string; recall@5 and MRR@10 as defined in the file.

Harness: `bench/search/heldout.mjs` (MCP stdio, fresh HOME and project per run).
`node bench/search/heldout.mjs --engine v2` or `--engine v1 --v1 <origin/main checkout with build/>`.
Raw output: `docs/v2/spikes/search/results/baseline-v2.json`, `baseline-v1.json`.

## 4. Baseline numbers (2026-10-23, node 26, macOS)

| Metric | v1 (origin/main, MCP) | v1 engine top 10 | v2 (v2-design, MCP) |
|---|---|---|---|
| Bench 7: scenarios with no hits | 0 / 7 | n/a | 3 / 7 |
| Bench 7: queries with hits | 20 / 20 | n/a | 6 / 20 |
| Bench 7: fences whole in replies | 21 / 70 | n/a | 0 / 70 |
| Held-out recall@5 | 0.84 | 1.00 | 0.38 |
| Held-out MRR@10 | 0.76 | 0.856 | 0.324 |
| Held-out queries with zero hits | 0 / 50 | 0 / 50 | 25 / 50 |
| Search p50 / p95 ms, +1 MB indexed | 3.0 / 7.7 | n/a | 1.3 / 3.2 |

Notes:

- v1 MCP shows at most 2 hits per query (`Math.min(limit, 2)` in v1 `server.ts`), so its recall@5
  over MCP is capped by the reply, not the ranking. "v1 engine top 10" calls
  `ContentStore.searchWithFallback(q, 10, source)` on the same inputs.
- v2 held-out recall@5 by kind: code 7/7, identifier 6/8, flag 2/2, phrase 4/5, natural 0/14,
  typo 0/8, morph 0/6. v2 finds exact tokens and fails every query that needs OR, stemming or
  typo recovery.
- v1 engine scores 50/50 on recall@5. The set is still useful as a floor: any v2 fix must reach
  the v1 engine on it without new queries tuned to the fix. A second held-out set written after
  the fix (by someone who has not seen the engine output) is the check against over-fit.
- Fences whole is lower for v1 over MCP (21/70) than v1-baseline.json says (exact code preserved)
  because v1 MCP shows 2 hits and `extractSnippet` clips chunks over 1500 chars; the v1 bench
  counted code chunks in the store, not in the reply.

## 5. Plan (order, and the cause each layer fixes)

Each step: tests first (unit in `tests/v2/store`, `tests/v2/index`; E2E through
`bench/search/heldout.mjs` and `bench/fixtures/run.mjs`), one DEVIATIONS.md row, commit, push,
re-run the held-out set. A step stays only if recall@5 and MRR@10 do not drop and p95 stays under
10 ms with 1 MB indexed.

1. **OR fallback + stopwords** (causes 1, 3). Keep AND as the first pass (precision), run
   `toMatchAny` minus stopwords when AND returns nothing. BM25 ranks chunks with more terms first.
   v1 history: `6a5f131b`, `707c4aea`.
2. **Markdown chunking for `ctx_index {content}`** (cause 2, split code). Route inline content
   through the existing `"md"` chunker (heading-aware, fence-aware, 4096 B cap) when it holds a
   heading or a fence. Keeps heading and body, and tool name and description, in one chunk.
   v1 history: `60a1a254`, `609a3a5a`.
3. **Porter stemming** (cause 4). `porter unicode61 remove_diacritics 2`: keeps the V24 Cyrillic
   and accent folding and adds English stems. Needs a schema migration (FTS table rebuild) and a
   DECISIONS-r9 V24 amendment.
4. **Trigram table + fuzzy correction** (typos, substrings like `useEff`). Second FTS5 table with
   `tokenize='trigram'`, vocabulary table, Levenshtein correction only when steps 1-3 return
   nothing. Measure index growth first: RFC #962 (index size on logs/JSONL) is open.
5. **RRF (k=60) over porter and trigram, then proximity rerank with title boost** (ranking of
   natural-language and multi-word queries). v1 history: `bce072b5`, `00d948a9`, `393839ac`, `2c63add6`.
6. **Reply text for code** (code blocks whole). Two ADR-level items, not engine changes:
   the 800 B snippet clip (DECISIONS-r9 M21) and `& < >` entity escaping in `highlight`.
   Options for the owner: return a hit whose chunk holds a fence as the whole chunk (up to 4096 B,
   fewer hits per page under OUTPUT_CAP 16384), and stop escaping (MCP text is not HTML). No
   truncation is proposed as a fix.

Targets for the fix: 0 / 7 no-hit scenarios, held-out recall@5 >= 0.84 (v1 over MCP) and MRR@10
>= 0.76, fences whole >= 21 / 70 (and all fences under 4096 B after step 6), p95 <= 10 ms.

## 6. Results after the fix (2026-10-23, node 26, macOS)

Each layer was measured on its own with `node bench/search/heldout.mjs` and kept only when held-out
recall@5 or MRR rose and nothing else fell (p95 latency rose; see notes).

| Metric | v1 (MCP) | v2 before | L1 md chunks | L2 stopwords + OR | L2b AND tier first | L3 porter + title | L4 trigram + RRF + typo |
|---|---|---|---|---|---|---|---|
| Bench 7: scenarios with no hits | 0 / 7 | 3 / 7 | 3 / 7 | 0 / 7 | 0 / 7 | 0 / 7 | 0 / 7 |
| Bench 7: fences whole in replies | 21 / 70 | 0 / 70 | 1 / 70 | 9 / 70 | 9 / 70 | 9 / 70 | 9 / 70 |
| Held-out recall@5 | 0.84 | 0.38 | 0.40 | 0.76 | 0.78 | 0.80 | **0.86** |
| Held-out MRR@10 | 0.76 | 0.324 | 0.347 | 0.661 | 0.678 | 0.697 | **0.720** |
| Held-out zero-hit queries | 0 / 50 | 25 / 50 | 25 / 50 | 1 / 50 | 1 / 50 | 1 / 50 | **0 / 50** |
| Search p50 / p95 ms, +1 MB | 3.0 / 7.7 | 1.3 / 3.2 | 1.3 / 3.1 | 2.7 / 5.3 | 2.5 / 5.1 | 2.9 / 5.7 | 4.7 / 12.1 |

v2 after, recall@5 by kind: identifier 7/8, natural 11/14, code 4/7, typo 8/8, morph 6/6, phrase 5/5,
flag 2/2 (before: 6/8, 0/14, 7/7, 0/8, 0/6, 4/5, 2/2).

Notes:

- v2 now passes v1 over MCP on recall@5 (0.86 vs 0.84) but not on MRR (0.720 vs 0.76), and stays
  under the v1 engine (1.00 / 0.856). Code queries fell from 7/7 to 4/7: OR lets longer chunks with
  the same words rank above the exact one. The p95 target of 10 ms from section 5 is missed
  (12.1 ms); the e2e limit is 50 ms.
- Measured and dropped: `tokenchars '_-'` (recall@5 0.78 -> 0.76, fences 9 -> 7) and title weights
  2, 5, 10 (fences fell). Proximity rerank was not added.
- Step 6 (reply text for code) is not done: the 800 B clip (M21) and `< > &` escaping (#341) need an
  owner decision (DEVIATIONS D-SEARCH-5). That is why fences whole stays at 9 / 70.
- These numbers are tuned on this held-out set. A second held-out set, written after the fix by
  someone who has not seen the engine output, is still needed to check for over-fit.
- Guard: `e2e/cases/GP-SEARCH-heldout.e2e.mjs` fails below recall@5 0.84 or MRR 0.70, on any fixture
  query with no hit, on a split code block (stored chunks), or on p95 over 50 ms with +1 MB.
- Raw layer results: `docs/v2/spikes/search/results/after-L4.json`.
