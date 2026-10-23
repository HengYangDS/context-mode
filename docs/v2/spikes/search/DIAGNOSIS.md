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
