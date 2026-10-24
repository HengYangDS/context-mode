export const meta = {
  name: 'v2-r4-fixes-haiku',
  description: 'Code-review fixes on v2-design after the round 4 merge, on Haiku 5.5: regex-free word split, budget floor, reserveSource rollback, unit bytes in retention, shared query/delete helpers, MMR constants, handle line without label; tests/DEVIATIONS/docs; watchdog wiring + D3 interleaved; one review; gate, CI',
  phases: [
    { title: 'Fix', detail: 'code, docs/tests, harness in parallel (Haiku)' },
    { title: 'Review', detail: 'one review of the Haiku work, fix what it finds' },
    { title: 'Final', detail: 'gate, CI' },
  ],
}

const HKH = { model: 'claude-haiku-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (round 4 merged exp/r4-final at 2c40245e). Other agents push to v2-design now: git pull --rebase before each commit, small commits, keep both sides on conflict. Commit + push allowed (pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-r4f-${id} (fresh clone). Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Rules: no regex and no truncation as a mechanism (TECH-SPEC "No regex" rule for runtime code); never write instruction files; tests first = a red test commit pushed before the green code commit; never weaken an assertion; frozen evals e2e/live/compact-hard and bench/m2 are never edited (README included); one DEVIATIONS.md row per behaviour change; no personal names, tenant ids or secrets.
Pace: commit + push within your first 12 tool calls; push after each step; finish within 60 minutes.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry once`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...opts })
}

const CODE = `${base('code')}\n\nCode fixes from the code review of the round 3/4 compaction work (files: src/core/compaction/recall.ts, render.ts, src/core/hooks/dispatch.ts, src/core/tools/resume.ts, purge.ts, src/core/store/fts.ts, src/core/contracts/constants.ts). Each item: red test commit, then green code commit, then a DEVIATIONS row if behaviour changes.
1. recall.ts wordsOf uses s.toLowerCase().split(/[^\\p{L}\\p{N}_]+/u). Replace it with a char-by-char splitter (same token rule as the store tokenizer; reuse a helper from fts.ts if one exists, else one shared helper). Test: same tokens as before on ASCII, Turkish, Cyrillic, snake_case, punctuation.
2. Handle budget floor: budget = 96 + bytes("\\n"+moreLine) - bytes(handleLine) can go below 0. Clamp at 0; then the replace is only the handle line. Test with a long intent.
3. reserveSource writes the source row before the detached chunk write. If the write fails or throws, delete the reserved row (and its line units) so no 0-chunk orphan stays. Test with a forced write failure.
4. Retention: RETENTION_SIZE_CAP_BYTES sums only sources.bytes_total. Count line_units bytes too. Test.
5. One helper for the recall query text (prompt, or prompt + " " + goal) used by dispatch.ts and resume.ts. One helper that deletes a source's chunks and line units, used by cleanup, deleteSourceChunks and both purge scopes.
6. Move the MMR weights 0.7/0.3 and the base36 digit offset into constants.ts with names. Merge UnitCandidate and UnitHit into one type. sourceRowOf must not report bytes: 0 / chunkCount: 0 as real values (return only the fields reserveSource uses). Comments cite the DEVIATIONS id, not a commit hash. Move the misplaced recall doc comment back above recall().
7. Owner decision: the handle line is only id, size and the ctx_search call (spec), no full label text. Remove the label from the line. Change the 6 tests that read "#<tool_use_id>" from the output to read the short id, one DEVIATIONS row per changed test (or one row listing all 6 with each test name). Regenerate bench/fixtures/results.json and the Part 3 rows in docs/benchmarks/fixtures/README.md with node bench/fixtures/run.mjs (do not loosen the 5% rule).
Then node --test tests/v2/ (0 fail) and node scripts/gate.mjs --all --quick. Return done, commits, numbers (tests, fixture bytes before/after), summary.`

const DOCS = `${base('docs')}\n\nDocs and test fixes from the code review (do not touch src/):
1. tests/v2/contracts/contracts.test.mjs asserts found: 5 vs want 5, so the stale case is not tested. Use found = want + 1 (derive from the constant, not a literal). Fix test titles that name old values (cost-dedup "is 3", schema.test.mjs v5 note).
2. docs/v2/impl/DEVIATIONS.md: the r3-ledger row must list purge.ts and deleteSourceChunks deleting line_units; the "D-CR3-HANDLE-3" test name needs a row or a rename to the right id; the D-CR3-HANDLE-1 row says part1 3010, results.json says 3012: use the number from bench/fixtures/results.json at the time you commit (another agent regenerates it; pull first and re-check before the last commit).
3. docs/v2/spikes/compact/r3-handle.md and r3-ledger.md "Not done" notes are stale (ctx_resume reads units, detached path uses the short id): update them; add one line on schema v5: sources stored before v5 have no line units (no backfill), and say what that means for users upgrading.
Return done, commits, numbers, summary.`

const HARN = `${base('harn')}\n\nHarness items from the code review:
1. e2e/live/lib/proc-group.mjs exists but no runner imports it. Wire it into every NON-frozen live runner that spawns claude -p (e2e/live/run.mjs and others under e2e/live and bench/ except e2e/live/compact-hard/* and bench/m2/*), so a timeout kills the whole process group. Red test first (a runner test that a grandchild dies on timeout). Write in docs/v2/spikes/compact/RESULT.md how frozen runs are guarded (manual watchdog, exact command).
2. D3 on the merged head: build v2-design head and 5a79496d (pre round 3). Run bench/hook-gs6.mjs interleaved ABABAB (6 rounds each) and e2e/checks/setup-hook-overhead.mjs on both. Report p95, cpuOverNode and paired median difference. Also time PostToolUse on the 222 KB compact-hard serverLog fixture (n=20 each, interleaved). Write the table into docs/v2/spikes/compact/RESULT.md under "D3 on the merged head". If the merged head is over the 15 ms overhead budget, say so plainly (do not change code here).
Return done, commits, numbers, summary.`

phase('Fix')
const [code, docs, harn] = await parallel([
  () => run(CODE, 'f-code', 'Fix', RESULT, HKH),
  () => run(DOCS, 'f-docs', 'Fix', RESULT, HKM),
  () => run(HARN, 'f-harn', 'Fix', RESULT, HKH),
])

phase('Review')
const rv = await run(`${base('review')}\n\nRole: one review of work done by Haiku agents on v2-design. Their reports: code ${JSON.stringify(code).slice(0, 2500)}; docs ${JSON.stringify(docs).slice(0, 1500)}; harness ${JSON.stringify(harn).slice(0, 1500)}.
Fresh clone. Read the diff since 2c40245e. Check each of the 7 code items, 3 docs items and 2 harness items is done and right: no regex left in recall/fts/units runtime paths (grep for regex literals and new RegExp in src/core), red commit before green, no weakened assertion, budget floor and rollback really tested, retention counts unit bytes, handle line has no label, DEVIATIONS rows exist and numbers match results.json, frozen paths unchanged, D3 table present. Fix small defects yourself (tests first), list anything big. Run node --test tests/v2/ and gate --all --quick. Return pass, problems, summary.`, 'f-review', 'Review', CHECK, OPH)

phase('Final')
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'f-gate', phase: 'Final', schema: GATE, ...HKM })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'f-gatefix', 'Final', RESULT, HKH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'f-ci', phase: 'Final', ...HKM })
return { code, docs, harn, rv, gate: g, ci }
