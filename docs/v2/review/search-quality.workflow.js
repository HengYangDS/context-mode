export const meta = {
  name: 'v2-search-quality',
  description: 'Fix v2 search: diagnose the 3 no-hit fixture queries and split code blocks, add proven retrieval layers on top of BM25 (porter, trigram, fuzzy, OR fallback, RRF), code-block-aware chunking, held-out labelled query set, measure vs v1, gate, CI',
  phases: [
    { title: 'Diagnose', detail: 'root cause + v1 archaeology + held-out query set' },
    { title: 'Build', detail: 'tests first, layers, chunking' },
    { title: 'Check', detail: 'adversarial measure, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-sq-${id}. Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. No regex on evidence, no truncation as a fix. DEVIATIONS.md row per behaviour change. Write no personal names.
Pace: commit + push within your first 15 tool calls; push after each step; done within 60 minutes (build step: 120 minutes).`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

phase('Diagnose')
const diag = await run(`${base('diag')}\n\nOwner (2026-10-23): "BM25'e algoritmalar ekle, o zaman bulur sonucu".
Fixture benchmark (docs/benchmarks/fixtures, bench/fixtures/run.mjs, results.json): Part 2 (ctx_index + ctx_search) gets "No hits" on 3 of 7 scenarios (Skill main prompt, Skill refs, MCP tools/list) and returns 0 code blocks whole; v1 returned whole code chunks.
1. Root cause, with evidence: for each of the 3 queries print the exact FTS5 MATCH string v2 builds, the tokenizer config, the indexed chunks (count, sizes, where code fences fall), and why nothing matches (AND of all terms, stopwords, tokenizer splitting identifiers like ctx_search / tools/list, no stemming, phrase quoting, chunk boundaries). Same for why code blocks come back split.
2. Git archaeology on origin/main (v1): src/store.ts (or the search module) and its history: which layers v1 used (porter, trigram table, fuzzy/levenshtein correction, RRF fusion, OR fallback, proximity, heading-aware chunking), the commits and the issues that drove each (git log -S, gh issue view). Note what v2 dropped and why (docs/v2 ADRs, DEVIATIONS).
3. Build a HELD-OUT labelled query set so the fix is not tuned to 7 queries: e2e/fixtures/search/heldout.json, at least 40 queries over the bench fixtures plus the repo's own docs/v2 markdown, each with the id(s) of the relevant chunk(s) or an exact substring that must appear in a top-5 result, mixed kinds: exact identifiers (snake_case, paths, flags), natural-language questions, typos, plural/verb forms, code-symbol queries, multi-word phrases. Write the labels from the source text, not from either engine's output. Freeze it (commit) before any engine change.
4. Write docs/v2/spikes/search/DIAGNOSIS.md: causes, v1 layers, the plan (which layers, in which order, why each fits a cause), metrics (no-hit count on the 7, recall@5 and MRR@10 on held-out for v1 and current v2, code blocks whole, search p95 ms on 1 MB indexed).
Measure current v2 and v1 (build origin/main in temp space; v1 ctx_index/ctx_search over MCP) on the held-out set first. Commit, push. Return done, commits, numbers (baseline v1 vs v2), summary.`, 'sq-diag', 'Diagnose', RESULT, OPH)
if (!diag || !diag.done) return { stopped: 'diagnosis not done', diag }

phase('Build')
const build = await run(`${base('build')}\n\nDiagnosis: ${JSON.stringify(diag).slice(0, 5000)} (docs/v2/spikes/search/DIAGNOSIS.md). Held-out set e2e/fixtures/search/heldout.json is frozen: do not edit it.
Implement in the v2 store (node:sqlite FTS5, no new runtime dependency), each layer test-first and measured on its own (keep a layer only if held-out recall@5 or MRR rises and nothing else falls):
1. Chunking: never split a fenced code block; split on headings, keep the heading path as a chunk title column; long code blocks stay whole up to a hard cap, then split on blank lines with the fence repeated.
2. Tokenizers: a porter (unicode61 remove_diacritics 2, tokenchars for _ and -) table for words, plus a trigram table for identifiers, paths and partial words.
3. Query building: safe quoting of every term (no FTS5 syntax injection), identifier-aware terms (ctx_search also as ctx search), AND first; if fewer than k hits, OR with BM25; if still none, trigram; typo correction from the index vocabulary (Levenshtein <= 2 on terms of length >= 5, vocabulary from fts5vocab) before the trigram pass.
4. Fusion: Reciprocal Rank Fusion (k=60) over the porter and trigram lists; BM25 column weights favour title over body; optional proximity boost only if it helps the held-out set.
5. Results return whole chunks with the title; code blocks intact.
Run bench/fixtures/run.mjs and update results.json and docs/benchmarks/fixtures/README.md (Part 2 table, honest notes). Add e2e case GP-SEARCH-heldout that fails if recall@5 or MRR falls below the new measured value minus 0.02, or any of the 7 fixture queries returns no hits, or a code block is split, or search p95 on 1 MB indexed exceeds 50 ms. Write the final numbers (per layer added, v1, v2 before, v2 after) into DIAGNOSIS.md and a DEVIATIONS row. node --test tests/v2/ and node scripts/gate.mjs --all. Commit + push after each layer. Return done, commits, numbers, summary.`, 'sq-build', 'Build', RESULT, OPH)

phase('Check')
const check = await run(`${base('check')}\n\nRole: adversarial checker. Fresh clone of v2-design. (1) git log shows heldout.json was committed before the first engine change and never edited after. (2) Recompute recall@5, MRR@10, no-hit count, code-blocks-whole and search p95 with your own script over MCP tools/call against release-out/server.mjs (not the build agent's script). (3) Write 10 new queries of your own over the same corpus (labels from source text) and report recall@5 for v1 and v2 on them, to catch overfitting. (4) Check for FTS5 syntax injection with queries containing quotes, *, NEAR, AND, OR, NOT, ^, :, parentheses. Fix wrong numbers or real bugs in place (tests first), commit, push. Return pass, problems, summary.`, 'sq-check', 'Check', CHECK, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'sq-ci', phase: 'Check', ...SNM })
return { diag, build, check, ci }
