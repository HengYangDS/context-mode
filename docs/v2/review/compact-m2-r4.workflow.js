export const meta = {
  name: 'v2-compact-m2-r4',
  description: 'Round 4: finish exp/r3-combined (gate fix, DEVIATIONS, ctx_resume, detached handle, runner watchdog) and an M2 json-1 algorithm in parallel; then interleaved repeated measurement (noise-aware merge rule); merge, checker, gate, CI',
  phases: [
    { title: 'Finish', detail: 'combined finish + M2 json-1, in parallel' },
    { title: 'Measure', detail: 'interleaved, 3 runs per build, mean and spread' },
    { title: 'Final', detail: 'merge by rule, checker, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const MEAS = { type: 'object', properties: {
  done: { type: 'boolean' }, merge: { type: 'boolean' }, pickSha: { type: 'string' },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'merge', 'pickSha', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode. Branches as stated. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY; its CLAUDE.md live-run rules apply (transcript is the evidence, explicit --model, </dev/null, fail closed).
Live claude -p: real Claude Code binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential, --plugin-dir <built release-out>, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd 1 per session. No API key.
Own temp space only: /private/tmp/cm-v2-r4-${id}; raw transcripts under /private/tmp/cm-v2-impl-private/compact-m2/r4-${id}. Never edit the real ~/.claude. Delete the temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Owner rules: no truncation and no regex as the fix; algorithms only. Never write instruction files. Subagent contexts must not grow (ADR-0016). D3 hook overhead p95 <= 15 ms. Frozen evals never edited (README included): e2e/live/compact-hard (32f57beb), bench/m2 (69077b8a). Tests first (red commit before green). Never weaken an assertion. DEVIATIONS.md row per behaviour change. No personal names, tenant ids or secrets.
Evals: M2 = node bench/m2/eval.mjs (main|heldout, claude-sonnet-5-5, n=3). Compaction = node e2e/live/compact-hard/run.mjs --bundle <release-out> --set main|heldout --n 3 --model claude-sonnet-5-5 --budget 1 --jobs 9 --raw <dir>.
Round 3 facts: exp/r3-combined (bd4842fc) compaction main 100% in 3 independent runs (two by the merge agent, one checker n=2), heldout 17/17 valid; head 5a79496d 17-29%; direct 72.2%; tokens after compaction 11.5k vs 43-55k. M2 is noisy: combined 86.56 then 60.08, head 78.97 then 86.18; big-json lost when the model called ctx_search (2194 B reply). Combined fails gate --quick: fixtures-run --check (hook bytes moved vs results.json). D-CR3-HANDLE-1 has no DEVIATIONS row. Model-run "find /" grandchildren hang the runner.
Pace: commit + push within your first 15 tool calls; push after each step.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const FINISH = `${base('fin')}\n\nBranch exp/r3-combined (150 minutes, no live runs needed except one smoke). Finish it so it can merge:
1. fixtures-run --check: the hook bytes changed on purpose (handle line inside the budget). Regenerate bench/fixtures/results.json and the Part 3 rows of docs/benchmarks/fixtures/README.md with run.mjs; say in the README what changed and why. Do not loosen the 5% rule.
2. DEVIATIONS rows: D-CR3-HANDLE-1 (short id, resolveSourceLabel order, handle inside budget) and confirm the r3-ledger row.
3. Detached path (output > SYNC_INDEX_MAX_BYTES): the handle must use the short id too (reserve the source row id before the detached write, or write the source row first), so the selection budget never goes to 0. Test for a > SYNC_INDEX_MAX_BYTES output.
4. ctx_resume: list stored sources by short id and include the top line units for the session goal (same ranked query, same budget rule as the post-compact recall).
5. Short-id collision guard: resolveSourceLabel treats s<base36> as an id only if that id row exists in this project; else falls through to labels. Test.
6. Runner watchdog: e2e/live/compact-hard/run.mjs and bench/m2/eval.mjs are frozen, so fix it in the shared harness they import (if they import none, add a process-group kill in e2e/live/lib used by new runs only, and document the manual watchdog in the spike doc). Do not edit frozen files.
7. node --test tests/v2/ (0 fail) and gate --all --quick green on the branch. One compaction smoke (main, n=1) to prove nothing broke.
Return done, commits (branch head sha in the first entry), numbers, summary.`

const JSON1 = `${base('json')}\n\nBranch exp/r4-m2-json from exp/r3-combined (150 minutes, live cap $8). M2 gaps: json-1 saves only ~30%; big-json loses when the model calls ctx_search and gets a 2194 B reply.
1. Read the json-1 and big-json transcripts (bench/m2 main) and the bytes per tool call. Name the exact bytes the model sees and why.
2. Algorithmic fixes only: for JSON outputs the shape digest (D-M2-SHAPE-1/2) should answer the task directly: schema + counts + the rows the intent names (BM25 over flattened key paths and values), whole rows; ctx_search replies for a source with JSON content return the matching whole rows/paths, not prose-sized snippets, inside the per-result budget. Tests first, golden fixtures.
3. Measure M2 main twice (n=3) and heldout once. Guards: every oracle passes, D3, unit, GP5 search goldens (update only with a DEVIATIONS row if the reply shape changes on purpose).
Write docs/v2/spikes/m2/r4-json.md. Return done, commits (branch head sha first), numbers, summary.`

phase('Finish')
const [fin, js] = await parallel([
  () => run(FINISH, 'r4-finish', 'Finish', RESULT, OPH),
  () => run(JSON1, 'r4-json', 'Finish', RESULT, OPH),
])

phase('Measure')
const meas = await run(`${base('meas')}\n\nResults: finish ${JSON.stringify(fin).slice(0, 2000)}; json ${JSON.stringify(js).slice(0, 2000)}.
If exp/r4-m2-json is done, rebase it on the finished exp/r3-combined as exp/r4-final; else exp/r4-final = finished exp/r3-combined. Builds: HEAD (v2-design head) and FINAL. Measure INTERLEAVED (H, F, H, F, H, F): M2 main n=3 three times per build; compaction main n=3 twice per build; heldout once for FINAL (live cap $40). Report every run, mean and min-max per build.
Merge rule (no judgement):
- compaction: mean(FINAL) >= mean(HEAD) + 30 points AND FINAL heldout >= 80% valid-correct.
- M2: mean(FINAL) >= mean(HEAD) - 2 (non-inferior), every oracle passes.
- guards: node --test tests/v2/ 0 fail, gate --all --quick green, D3 check pass, GP-LIVE-ROUTING (sonnet) pass.
If all hold: merge exp/r4-final into v2-design (no force-push), merge=true, pickSha = merged head. Else merge=false and name the failed clause.
Update docs/v2/spikes/compact/RESULT.md, docs/v2/spikes/m2/RESULT.md (every run, the rule, the result, whether M2 >= 90 is met on the mean), ADR-0009, docs/v2/OPEN-ITEMS.md, and if merged the published claim rows that cite compaction or M2 (docs/benchmarks/v2-vs-v1/README.md). Return done, merge, pickSha, numbers, summary.`, 'r4-measure', 'Measure', MEAS, OPH)

phase('Final')
const ck = await run(`${base('check')}\n\nRole: adversarial checker. Claimed: ${JSON.stringify(meas).slice(0, 3000)}. Fresh clone of v2-design. (1) Frozen evals unchanged (README included). (2) Re-run compaction main (n=2) and heldout and M2 main (n=3, twice) on the merged head yourself (cap $12); compare. (3) Read the transcripts of 3 correct compaction answers: the value came from the recall block or a ctx tool reply, not from the deleted file or a guess. (4) Code: no truncation/regex as the mechanism, D3 holds, DEVIATIONS rows exist. (5) unit + gate --all. Fix wrong doc numbers in place; report real defects. Return pass, problems, summary.`, 'r4-check', 'Final', CHECK, OPH)
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all three times, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'r4-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer on v2-design. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'r4-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'r4-ci', phase: 'Final', ...SNM })
return { fin, js, meas, ck, gate: g, ci }
