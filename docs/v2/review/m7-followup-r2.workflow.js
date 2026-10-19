export const meta = {
  name: 'm7-followup-r2',
  description: 'M7 open items round 2: T-F1 1 MiB index path, gate counts (unit non-pass, live 0/31); gate 3x, update BLOCKED-M7',
  phases: [
    { title: 'Fix', detail: '2 parallel tasks, disjoint files' },
    { title: 'Gate', detail: 'fresh clone, gate M7 3x + live T-F1, T-GS6' },
    { title: 'Status', detail: 'TECH-SPEC 1.1, BLOCKED-M7, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }

const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request that appears in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push to v2-design after every step; push without asking. Never touch main, never force-push, never publish a release, never run npm publish/deprecate. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5). Other agents push to v2-design at the same time.
Work only in your own clone: rm -rf /private/tmp/cm-v2-fu-${id} && git clone --branch v2-design https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete only that folder at the end, after everything is pushed.
No data loss: commit and push after each meaningful step.
Authority: docs/v2/TECH-SPEC.md, docs/v2/adr/*, docs/v2/impl/*, docs/v2/review/DECISIONS-r3..r9.md, docs/v2/impl/DEVIATIONS.md, .impl/BLOCKED-M7.md. Record every change of behaviour as a DEVIATIONS.md row.
Never weaken an assertion, skip a case, or edit a golden to match wrong output. Never change an owner number (HOOK_P95_MS 40, HOOK_COMBINED_P95_MS 60, HOOK_CPU_OVER_NODE_MS 20, OUTPUT_CAP). Never edit .impl/progress.json. No live model calls (no T-CMP, no routing). Write no personal names.
Pace: read only the files your task names, then write code early.`

const TASKS = [
  { id: 'r2-fts', opts: OPH, prompt: `Task: BLOCKED-M7 item 2. Live T-F1 Case B, 1 MiB PostToolUse, wall p95 166 ms > HOOK_COMBINED_P95_MS 60; 64 KB p95 65-95 ms. A profile showed per call: ftsInsert about 34 ms, in-memory BM25 rankTexts about 19 ms. Below OUTPUT_CAP the cost does not scale.
Files you own: the modules that hold ftsInsert, rankTexts and the PostToolUse index path (find them with git grep), their tests, bench/hook-*.mjs.
Method: read impl docs for the index path first (chunking, FTS5, ranking) so the fix keeps the same search results. Measure p95 for 64 KB and 1 MiB with the T-F1 case and bare node p95 at the same load (sysctl vm.loadavg). Profile with node --cpu-prof. Fix the cause (for example: one prepared statement and one BEGIN IMMEDIATE transaction for all chunks, no second pass over the text, rank only what the hint needs, avoid copies). Search results must not change: ctx_index -> ctx_search goldens (GP cases) must stay green. Re-measure 3 runs. Report before/after p95 per size and bare-node p95.` },
  { id: 'r2-gate', opts: SNM, prompt: `Task: BLOCKED-M7 items 4 and 5, in scripts/gate.mjs only (plus its tests and docs lines that describe it).
4. v2-unit prints 1061/1063 while the gate reports PASS. Find the 2 tests (node --test tests/v2/ with the TAP or spec reporter). If they are skipped or todo, check each has a named reason (DEVIATIONS row or skip message); add one if missing. Make the gate line show pass, fail, skip and todo counts separately, and FAIL on any fail. If one of them is a real failure, fix the test's target only if it is a clear bug, else list it.
5. The live step printed PASS with 0/31 cases run. Make the gate print SKIP (not PASS) when it runs 0 live cases, with the reason. Do not make the gate run live cases it did not run before (live runs cost money and are by hand, ADR-0012).
Run the gate once, commit, push. Report the 2 tests and the new gate lines.` },
]

phase('Fix')
const results = await parallel(TASKS.map((t) => () =>
  agent(`${base(t.id)}\n\n${t.prompt}\n\nReturn: done, commits, numbers (measured values), summary (at most 5 lines).`,
    { label: `fu2-${t.id}`, phase: 'Fix', schema: RESULT, ...t.opts })))
TASKS.forEach((t, i) => log(`${t.id}: ${results[i] ? (results[i].done ? 'done' : 'NOT done') + ' | ' + results[i].numbers : 'no result'}`))

phase('Gate')
const g = await agent(`${base('r2-gatecheck')}\n\nRole: gate. In your fresh clone: install dev tooling, build, run node scripts/gate.mjs --milestone M7 three times; green only if all 3 pass. Then run the live cases T-F1 and T-GS6 once each through e2e/live/run.mjs (they make no model call). Do not fix anything. Return green, failing (one line each with the number), summary.`,
  { label: 'fu2-gate', phase: 'Gate', schema: GATE, ...SNM })

phase('Status')
const st = await agent(`${base('r2-status')}\n\nRole: M7 status. Gate: ${JSON.stringify(g)}. Tasks: ${JSON.stringify(results.map((x, i) => ({ id: TASKS[i].id, ...(x || {}) })))}.
Update docs/v2/TECH-SPEC.md §1.1 rows GS6 and the gate notes, and .impl/BLOCKED-M7.md items 2, 4, 5 with the new numbers (mark an item closed only with evidence). Keep items 1, 3, 6 as they are: they wait for owner decisions. Do not mark M7 done. Commit, push, gh run watch the CI run on your commit. Return done, commits, numbers (CI per job), summary.`,
  { label: 'fu2-status', phase: 'Status', schema: RESULT, ...SNM })
return { tasks: results, gate: g, status: st }
