# Fixture benchmark: v1 vs v2 (tool output bytes)

> Same 21 scenarios and the same fixtures as v1 [BENCHMARK.md](https://github.com/mksglu/context-mode/blob/main/BENCHMARK.md).
> No model calls, no network. One run takes about 2 s.

Generated from `bench/fixtures/results.json` (date 2026-10-22, node v26.8.1).
v1 = origin/main `90af14e3` (package 1.0.169), measured on that date with v1's own scripts.
v2 = branch v2-design `de9184b0`, built bundle (`release-out/server.mjs`, `release-out/hook.mjs`).

## Overview

| Metric | v1 | v2 tool | v2 hook |
|--------|----|---------|---------|
| Scenarios | 21 | 21 | 21 |
| Raw data | 389.2 KB | 389.2 KB | 389.2 KB |
| Context (bytes the model sees) | 16.2 KB | 9.9 KB | 10.3 KB |
| Savings | 96% | 97% | 97% |

Columns:

- **v1**: v1 `ctx_execute_file` (Part 1) or v1 `ContentStore.index` + `search(q, 1)` per query (Part 2).
- **v2 tool**: the real v2 MCP `tools/call` over stdio. Part 1: `ctx_execute` with `file` (v2 has no `ctx_execute_file`; `ctx_execute` with `file` does the same job). Part 2: `ctx_index {content, source}` then one `ctx_search {queries, source}`.
- **v2 hook**: the fixture fed as the stdout of a Claude Code `PostToolUse` Bash call into `hook.mjs --agent claude-code` (golden payload shape `e2e/fixtures/claude-code/2.1.303/PostToolUse-Bash-large.json`). Bytes = `updatedToolOutput` after replace, or the raw stdout when the hook allows (outputs of 4096 B or less pass through).

Raw size = fixture bytes. Context = bytes the tool returns to the model. Savings = 1 - context / raw. Time = v2 tool call time (client side, includes MCP round trip).

## Part 1: `ctx_execute_file` (v1) vs `ctx_execute` + `file` (v2)

The v1 code strings are byte-exact (`bench/fixtures/scenarios.json`). v2 adds one prelude line that reads `CTX_FILE` into `FILE_CONTENT`.

| Scenario | Source | Raw Size | v1 Context | v2 Tool | v2 Hook | v1 Savings | v2 Tool Savings | v2 Hook Savings | v2 Time |
|----------|--------|----------|-----------|---------|---------|-----------|----------------|----------------|---------|
| React useEffect docs | Context7 | 5.9 KB | 261 B | 277 B | 216 B | 96% | 95% | 96% | 57ms |
| Next.js App Router docs | Context7 | 6.5 KB | 249 B | 265 B | 218 B | 96% | 96% | 97% | 50ms |
| Tailwind CSS docs | Context7 | 4.0 KB | 186 B | 202 B | 221 B | 95% | 95% | 95% | 49ms |
| Page snapshot (HN) | Playwright | 56.2 KB | 299 B | 315 B | 215 B | 99% | 99% | 100% | 78ms |
| Network requests | Playwright | 0.4 KB | 349 B | 365 B | 400 B | 13% | 9% | 0% | 46ms |
| PR list (Next.js) | GitHub | 6.4 KB | 719 B | 735 B | 188 B | 89% | 89% | 97% | 47ms |
| Issues (React) | GitHub | 58.9 KB | 1,139 B | 1,156 B | 183 B | 98% | 98% | 100% | 47ms |
| Test output (30 suites) | vitest | 6.0 KB | 337 B | 353 B | 197 B | 95% | 94% | 97% | 52ms |
| TypeScript errors (50) | tsc | 4.9 KB | 347 B | 363 B | 200 B | 93% | 93% | 96% | 47ms |
| Build output (100+ lines) | next build | 6.4 KB | 405 B | 421 B | 204 B | 94% | 94% | 97% | 50ms |
| MCP tools (40 tools) | MCP tools/list | 17.0 KB | 742 B | 758 B | 195 B | 96% | 96% | 99% | 49ms |
| Access log (500 req) | nginx | 45.1 KB | 155 B | 171 B | 191 B | 100% | 100% | 100% | 49ms |
| Git log (150+ commits) | git | 11.6 KB | 107 B | 123 B | 193 B | 99% | 99% | 98% | 48ms |
| Analytics CSV (500 rows) | analytics | 85.5 KB | 222 B | 238 B | 198 B | 100% | 100% | 100% | 37ms |

**Subtotal: 314.9 KB raw → v1 5.4 KB (98%), v2 tool 5.6 KB (98%)**

v2 tool is 16 B larger on every row but one (Issues (React): 17 B, because N there has four digits): v2 puts a status line (`exit 0 · N B`) before the output. The summaries are the same text.

## Part 2: `ctx_index` + `ctx_search` (knowledge retrieval)

Queries are byte-exact from v1 `tests/live-benchmark.ts`. "Queries with hits" = queries whose v2 result is not empty.
"Code blocks whole" = fenced code blocks of the source that appear whole in the v2 search reply.

| Scenario | Source | Raw Size | v1 Search Result | v2 Search Result | v1 Savings | v2 Savings | v2 Queries with hits | v1 Code Chunks | v2 Code Blocks whole | v2 Time |
|----------|--------|----------|-----------------|-----------------|-----------|-----------|-------------------|----------------|-------------------|---------|
| Supabase Edge Functions (5 examples) | Context7: Supabase | 3.9 KB | 2,246 B | 651 B | 44% | 84% | 2 / 3 | 4 | 0 / 5 | 11ms |
| React useEffect docs | Context7: React | 5.9 KB | 1,494 B | 2,190 B | 75% | 64% | 1 / 3 | 4 | 0 / 5 | 6ms |
| Next.js App Router docs | Context7: Next.js | 6.5 KB | 3,311 B | 684 B | 50% | 90% | 1 / 3 | 5 | 0 / 9 | 5ms |
| Tailwind CSS docs | Context7: Tailwind | 4.0 KB | 620 B | 750 B | 85% | 82% | 1 / 2 | 5 | 0 / 6 | 4ms |
| Skill: context-mode (main prompt) | Skill: context-mode | 16.3 KB | 0 B | 47 B | 100% | 100% | 0 / 3 | 8 | 0 / 8 | 5ms |
| Skill references (4 files combined) | Skill Refs: context-mode | 35.2 KB | 2,412 B | 47 B | 93% | 100% | 0 / 3 | 33 | 0 / 37 | 7ms |
| MCP tools/list (40 tools) | MCP: tools/list | 2.5 KB | 1,016 B | 47 B | 60% | 98% | 0 / 3 | 0 | 0 / 0 | 6ms |

**Subtotal: 74.3 KB raw → v1 10.8 KB (85%), v2 4.3 KB (94%)**

Read this part with care. v2 returns fewer bytes here mostly because it finds less:

- v2 chunks are small (BM25 snippets of at most 800 B), so no fenced code block comes back whole (0 in every row). v1 returned whole chunks with code.
- Three rows (Skill main prompt, Skill references, MCP tools/list) get **no hits** in v2: the 47 B reply is `No hits in scope "worktree" across 1 source(s).` v1 also got 0 B on the Skill main prompt row.
- Smaller here is not better. Part 2 is a retrieval test; the bytes column alone does not show quality.

## Part 3: v2 hook path (PostToolUse replace)

v1 Part 3 described the >100 KB pointer for `ctx_execute`. v2 has a different path: a native Claude Code Bash output over 4096 B is indexed whole and replaced with at most 96 B of BM25-picked chunks plus a `ctx_search` line. The model never has to call a context-mode tool for this.

| Scenario | Raw Size | Model sees (hook) | Replaced | Savings | Hook time |
|----------|----------|------------------|----------|---------|-----------|
| p1 React useEffect docs | 5.9 KB | 216 B | yes | 96% | 47ms |
| p1 Next.js App Router docs | 6.5 KB | 218 B | yes | 97% | 47ms |
| p1 Tailwind CSS docs | 4.0 KB | 221 B | yes | 95% | 49ms |
| p1 Page snapshot (HN) | 56.2 KB | 215 B | yes | 100% | 56ms |
| p1 Network requests | 0.4 KB | 400 B | no (≤ 4096 B, passes through) | 0% | 42ms |
| p1 PR list (Next.js) | 6.4 KB | 188 B | yes | 97% | 46ms |
| p1 Issues (React) | 58.9 KB | 183 B | yes | 100% | 81ms |
| p1 Test output (30 suites) | 6.0 KB | 197 B | yes | 97% | 49ms |
| p1 TypeScript errors (50) | 4.9 KB | 200 B | yes | 96% | 48ms |
| p1 Build output (100+ lines) | 6.4 KB | 204 B | yes | 97% | 50ms |
| p1 MCP tools (40 tools) | 17.0 KB | 195 B | yes | 99% | 52ms |
| p1 Access log (500 req) | 45.1 KB | 191 B | yes | 100% | 93ms |
| p1 Git log (150+ commits) | 11.6 KB | 193 B | yes | 98% | 47ms |
| p1 Analytics CSV (500 rows) | 85.5 KB | 198 B | yes | 100% | 58ms |
| p2 Supabase Edge Functions (5 examples) | 3.9 KB | 3,988 B | no (≤ 4096 B, passes through) | 0% | 45ms |
| p2 React useEffect docs | 5.9 KB | 216 B | yes | 96% | 47ms |
| p2 Next.js App Router docs | 6.5 KB | 218 B | yes | 97% | 48ms |
| p2 Tailwind CSS docs | 4.0 KB | 221 B | yes | 95% | 49ms |
| p2 Skill: context-mode (main prompt) | 16.3 KB | 202 B | yes | 99% | 48ms |
| p2 Skill references (4 files combined) | 35.2 KB | 212 B | yes | 99% | 51ms |
| p2 MCP tools/list (40 tools) | 2.5 KB | 2,509 B | no (≤ 4096 B, passes through) | 0% | 54ms |

**Total: 389.2 KB raw → 10.3 KB (97%)**. Rows under 4096 B pass through unchanged (0% savings).
Part 2 hook rows feed the same text as Part 2 tool rows, so the 21 hook rows count three docs twice; the Part 2 sources are not a Bash output in real use.

## Totals

| Part | Raw | v1 | v2 tool | v2 hook |
|------|-----|----|---------|---------|
| Part 1 (14) | 314.9 KB | 5,517 B | 5,742 B | 3,019 B |
| Part 2 (7) | 74.3 KB | 11,099 B | 4,416 B | 7,566 B |
| All (21) | 389.2 KB | 16,616 B | 10,158 B | 10,585 B |

## What this measures and what it does not

- It measures **tool output bytes only**: what one call returns to the model. It is not cost, not tokens billed, not answer quality.
- It does not count tool schemas, the system prompt, cache reads, or extra calls a model makes after a no-hit search.
- The hook column assumes the model would have run `cat <fixture>` through Bash. A real session decides that itself.
- For live cost with real models, see [docs/benchmarks/v1-v2-gateway](../v1-v2-gateway/) and [docs/benchmarks/try-it](../try-it/).

## How to reproduce

```bash
node bench/fixtures/run.mjs
```

It builds `release-out/` if it is missing, runs all 21 scenarios in a temp HOME and temp project, and writes `bench/fixtures/results.json`. `--check` does not write; it fails if a scenario errors or a part total moves more than 5% from `results.json` (CI runs this).

The v1 column comes from `bench/fixtures/v1-baseline.json`, made once by running `npx tsx tests/ecosystem-benchmark.ts` and `npx tsx tests/live-benchmark.ts` on a clean checkout of v1 `90af14e3`. Two v1 rows differ from the published BENCHMARK.md because v1's skill files grew after it was written: Skill main prompt (published 4.4 KB / 932 B, today 16.3 KB / 0 B) and Skill references (published 33.2 KB, today 35.2 KB). Fixtures and their source commit: `bench/fixtures/data/SOURCE.md`.
