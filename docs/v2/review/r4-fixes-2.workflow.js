export const meta = {
  name: 'v2-r4-fixes-2',
  description: 'Finish the review fixes the Haiku round left open, as small one-item Haiku tasks (regex-free splits + constants, handle line without label + budget-0 newline, shared helpers), plus an Opus perf fix for the 222 KB PostToolUse slowdown and the red Windows D3 CI; one review; gate, CI',
  phases: [
    { title: 'Fix', detail: 'small Haiku items + Opus perf, in parallel' },
    { title: 'Helpers', detail: 'shared helpers after the others land' },
    { title: 'Review', detail: 'one review, fix small defects' },
    { title: 'Final', detail: 'gate, CI' },
  ],
}

const HKH = { model: 'claude-haiku-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
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
Repo github.com/mksglu/context-mode, branch v2-design. Other agents push to v2-design now: git pull --rebase before each commit, small commits, keep both sides on conflict. Commit + push allowed (pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-r4g-${id} (fresh clone). Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Rules: no regex and no truncation as a mechanism in runtime code; never write instruction files; a red test commit pushed before the green code commit; never weaken an assertion; never raise a budget; frozen evals e2e/live/compact-hard and bench/m2 never edited; one DEVIATIONS.md row per behaviour change; no personal names, tenant ids or secrets.
Scope is ONLY the item below; do not start other work. Before you return: run the test files you touched AND node --test tests/v2/ once; report the counts.
Pace: commit + push within your first 10 tool calls; push after each step; finish within 45 minutes.`

async function run(prompt, label, phase, schema, opts, fallback) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r && (r.done !== false)) return r
  log(`${label}: not done, retry on ${fallback ? 'sonnet' : 'same model'}`)
  return agent(`${prompt}\n\nA previous attempt reported: ${JSON.stringify(r).slice(0, 1500)}. Continue from the pushed state; do not redo pushed commits.`, { label: label + '-retry', phase, schema, ...(fallback || opts) })
}

const SPLIT = `${base('split')}\n\nItem: regex-free word splits and named constants.
1. src/core/compaction/recall.ts wordsOf uses s.toLowerCase().split(/[^\\p{L}\\p{N}_]+/u); src/core/store/fts.ts (~line 211) splits on /[\\s\\u0000]+/. Write ONE char-by-char tokenizer helper (letters and digits by Unicode category via a code-point loop, plus "_"; NUL and whitespace are separators) and use it in both places. Red test first: same tokens as before on ASCII, Turkish (ışİğ), Cyrillic, snake_case, punctuation, NUL. Then grep src/ for any other regex literal or new RegExp in runtime search/recall/units paths and list them in the summary (do not change ones outside those paths).
2. Move the MMR weights 0.7/0.3 and the base36 digit offset (+10 in parseSourceHandle) into src/core/contracts/constants.ts with names. Merge UnitCandidate (recall.ts) and UnitHit (fts.ts) into one exported type.
DEVIATIONS row if output changes (it should not). Return done, commits, numbers, summary.`

const HANDLE = `${base('handle')}\n\nItem: handle line per spec.
1. REPLACE_HANDLE_LINE in src/core/contracts/constants.ts still ends with "searches the whole output of " + label. The spec says the handle line is only the short id, the size and the ctx_search call. Remove the label text. Find the tests that read "#<tool_use_id>" or the label from the replace output (about 6) and make them read the short id instead; never drop an assertion. One DEVIATIONS row (D-R4-HANDLE-LABEL-1) listing each changed test by name.
2. D-R4-BUDGET-1: at selection budget 0 the replace still starts with "\\n" (the handle line keeps its newline prefix). Red test: budget 0 gives the handle line alone with no leading newline (end-to-end through dispatch, as bc9281a8 first tried). Then fix.
3. Regenerate bench/fixtures/results.json and the Part 3 rows of docs/benchmarks/fixtures/README.md with node bench/fixtures/run.mjs; update the D-CR3-HANDLE-1 numbers to match. Do not loosen the 5% rule.
Return done, commits, numbers (fixture part1/part2 hook bytes before/after), summary.`

const PERF = `${base('perf')}\n\nItem: performance. Two facts:
(a) PostToolUse on the 222,418 B compact-hard serverLog: head median 147.2 ms / p95 177.6 ms vs pre-round-3 (5a79496d) 59.4 / 68.0 ms, paired +79.9 ms (docs/v2/spikes/compact/RESULT.md "D3 on the merged head"). The likely cost is building and inserting line units (src/core/index/units.ts, fts.ts unit insert) on the hook path.
(b) CI run 40103915339 (head 5315f2d3) is red on both Windows jobs: D3 gate codex overhead p95 16 ms, claude-code 13 ms, budget 15 ms. Earlier (run 40014617348) Windows was 8-12 ms.
Do: profile (a) with --cpu-prof on Node 24 and 26; find where the 80 ms goes. Fix at the root without dropping line units: e.g. move unit building to the detached/background index write the large-output path already uses, batch inserts in one transaction with a cached prepared statement, avoid repeated ancestor string building (store ancestor offsets, build text once), skip units for outputs under the replace threshold. Target: within 10 ms of pre-round-3 on the 222 KB event, interleaved n=20 each. For (b): read the failed logs (gh run view --log-failed), check whether the common hook path got slower (hook bundle size grew 101 KB -> 106 KB; any new top-level import or work at module load), cut it (lazy import of units/recall code that small events never use). Never raise the budget. Re-run CI (gh run watch) until Windows passes or 2 rounds. Write the before/after table into RESULT.md. Return done, commits, numbers, summary.`

phase('Fix')
const [split, handle, perf] = await parallel([
  () => run(SPLIT, 'g-split', 'Fix', RESULT, HKH, SNH),
  () => run(HANDLE, 'g-handle', 'Fix', RESULT, HKH, SNH),
  () => run(PERF, 'g-perf', 'Fix', RESULT, OPH, SNH),
])

phase('Helpers')
const helpers = await run(`${base('helpers')}\n\nItem: shared helpers (after the split, handle and perf agents pushed; pull first).
1. One helper builds the recall query text (prompt, or prompt + " " + goal when they differ); dispatch.ts and resume.ts both call it.
2. One helper deletes a source's chunks, trigram rows and line units; cleanup, deleteSourceChunks, finishReserved and both purge scopes call it (no repeated DELETE SQL).
3. sourceRowOf must not return bytes: 0 / chunkCount: 0 as if real; return only the fields reserveSource uses. Code comments cite the DEVIATIONS id, not a commit hash. Move the recall doc comment in dispatch.ts back above recall().
Refactor only: behaviour must not change; existing tests are the proof (add one test per helper). Return done, commits, numbers, summary.`, 'g-helpers', 'Helpers', RESULT, HKH, SNH)

phase('Review')
const rv = await run(`${base('review')}\n\nRole: one review of this round. Reports: split ${JSON.stringify(split).slice(0, 1200)}; handle ${JSON.stringify(handle).slice(0, 1200)}; perf ${JSON.stringify(perf).slice(0, 1500)}; helpers ${JSON.stringify(helpers).slice(0, 1200)}.
Fresh clone; diff since 5315f2d3. Check: no regex literal or new RegExp left in recall/fts/units runtime paths; handle line has no label and budget 0 has no leading newline; red before green for each fix; no weakened assertion; DEVIATIONS rows exist and numbers match results.json; frozen paths unchanged; perf table in RESULT.md and the 222 KB PostToolUse number; helpers really shared (grep for repeated DELETE FROM line_units / sources). Fix small defects (tests first); list big ones. node --test tests/v2/ and gate --all --quick. Return pass, problems, summary.`, 'g-review', 'Review', CHECK, OPH, SNH)

phase('Final')
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'g-gate', phase: 'Final', schema: GATE, ...HKM })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'g-gatefix', 'Final', RESULT, OPH, SNH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node with the D3 numbers and the final run id.`,
  { label: 'g-ci', phase: 'Final', ...SNH })
return { split, handle, perf, helpers, rv, gate: g, ci }
