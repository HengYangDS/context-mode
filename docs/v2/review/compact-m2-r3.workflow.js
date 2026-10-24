export const meta = {
  name: 'v2-compact-m2-r3',
  description: 'Round 3: handle line inside the replace budget + short stable source id (M2 back >= 90, compaction search works), precomputed line ledger for recall of large rows; merge by numbers with two measurement runs; checker, gate, CI',
  phases: [
    { title: 'Build', detail: 'handle fix and ledger on exp branches, in parallel' },
    { title: 'Merge', detail: 'combine, measure twice, numeric pick' },
    { title: 'Final', detail: 'checker, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
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
Repo github.com/mksglu/context-mode. Branches as stated (exp/* or v2-design). Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY; its CLAUDE.md live-run rules apply (transcript is the evidence, explicit --model, </dev/null, fail closed).
Live claude -p: real Claude Code binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential, --plugin-dir <built release-out>, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd per session as stated. No API key.
Own temp space only: /private/tmp/cm-v2-r3-${id}; raw transcripts under /private/tmp/cm-v2-impl-private/compact-m2/r3-${id}. Never edit the real ~/.claude. Delete the temp space before you return.
Owner rules: no truncation and no regex as the fix; algorithms only. Never write instruction files. Subagent contexts must not grow (ADR-0016). Hook overhead D3 p95 <= 15 ms holds. Frozen evals are never edited (not even README): e2e/live/compact-hard (32f57beb) and bench/m2 (69077b8a). Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. No personal names, tenant ids or secrets.
Evals: M2 = node bench/m2/eval.mjs (main|heldout, claude-sonnet-5-5, n=3). Compaction = node e2e/live/compact-hard/run.mjs --bundle <release-out> --set main|heldout --n 3 --model claude-sonnet-5-5 --budget 1 --jobs 9 --raw <private-dir>.
Known numbers: M2 main 92.5 at 18e4a6cd, 84.03 at fbd4f781 (handle line adds ~250 B outside the replace budget). Compaction main: direct 72.2%; v2 head claimed 44.4% (n=3) but checker re-run 29.2% (n=2); heldout 25.0%; a-ledger (exp/compact-a-ledger) 27.3% / 33.3%.
Pace: commit + push within your first 15 tool calls; push after each step.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const HANDLE = `${base('handle')}\n\nBranch exp/r3-handle from v2-design head (150 minutes, live cap $12).
Defects: (1) the D-CR2-HANDLE-1 line sits outside the replace budget, so M2 fell 92.5 -> 84.03; (2) the line names the source as "Bash:cat config/deploy.json#toolu_...", the model shortens it, and ctx_search filters with exact label = :source (src/core/tools/search.ts ~35), so it gets "No hits ... across 0 source(s)".
Fix:
1. Every stored source gets a short stable id (e.g. s<rowid> in base36) stored in the DB; the handle line is one short line: the id, the size and ctx_search({queries:[...], source:"<id>"}). ctx_search source accepts the id, the full label, or a label without the #tool-use suffix (resolve in this order, deterministic; no regex: split on the separator). Same for ctx_resume output.
2. The handle line counts inside REPLACE_RETURN_BYTES: the selection budget = budget - handle bytes, so total bytes per replace do not grow vs 18e4a6cd. Golden tests for both.
3. Measure M2 main (target >= 92 back) and compaction main + heldout. Guards: every oracle passes, GP5/GP6/GP7, D3, unit, prompt lint.
Write docs/v2/spikes/compact/r3-handle.md. Return done, commits, numbers, summary.`

const LEDGER = `${base('ledger')}\n\nBranch exp/r3-ledger from v2-design head (150 minutes, live cap $12).
Defect: a 222 KB row is larger than RECALL_BUDGET_BYTES, so pickRecall skips the whole row and recall after compaction is empty. exp/compact-a-ledger (572eaa46) added pickLines (BM25 over lines with their indent-ancestor context) but ran it at prompt time (4-50 ms per prompt on a 222 KB row: D3 risk).
Fix: precompute at PostToolUse when an output is stored: one stack pass builds line units (line + indent ancestors, whole TAP/JSON/log units) and indexes them as their own FTS rows linked to the source id; after compaction the first UserPromptSubmit (and ctx_resume) runs ONE ranked query over this session's line units (prompt + session goal), MMR for diversity, whole units only, inside RECALL_BUDGET_BYTES. Measure hook time on a 222 KB row before/after (must stay inside D3). Measure compaction main + heldout and M2 main (no drop). Guards as usual. Write docs/v2/spikes/compact/r3-ledger.md. Return done, commits, numbers, summary.`

phase('Build')
const [h, l] = await parallel([
  () => run(HANDLE, 'r3-handle', 'Build', RESULT, OPH),
  () => run(LEDGER, 'r3-ledger', 'Build', RESULT, OPH),
])

phase('Merge')
const m = await run(`${base('merge')}\n\nResults: handle ${JSON.stringify(h).slice(0, 2500)}; ledger ${JSON.stringify(l).slice(0, 2500)}.
Build exp/r3-combined = v2-design + exp/r3-handle + exp/r3-ledger (resolve conflicts). Measure THREE builds (head, handle-only, combined) with TWO independent compaction runs each on main (n=3) plus one heldout run, and M2 main once each (live cap $30). Pick rule (no judgement): candidates must have M2 main >= 90, all oracles pass, guards pass; among them pick the highest mean compaction main over the two runs; tie -> higher heldout. Merge the pick into v2-design (no force-push). If no candidate meets M2 >= 90, merge nothing and say why.
Update ADR-0009, docs/v2/spikes/compact/RESULT.md and docs/v2/spikes/m2/RESULT.md (every run, mean and spread, the pick), docs/v2/OPEN-ITEMS.md. Return done, commits, numbers (per build: M2 main, compaction main run1/run2/mean, heldout), summary.`, 'r3-merge', 'Merge', RESULT, OPH)

phase('Final')
const ck = await run(`${base('check')}\n\nRole: adversarial checker. Claimed: ${JSON.stringify(m).slice(0, 3000)}. Fresh clone of v2-design. (1) Frozen evals unchanged (git diff since 32f57beb and 69077b8a, README included). (2) Re-run M2 main and compaction main (n=2) and heldout yourself (cap $10), compare. (3) Code: no truncation/regex as the mechanism, handle inside the budget, source id resolution deterministic, D3 holds. (4) unit + gate --all. Fix wrong doc numbers in place, revert any frozen-eval edit, report real defects. Return pass, problems, summary.`, 'r3-check', 'Final', CHECK, OPH)
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all three times, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'r3-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer on v2-design. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'r3-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'r3-ci', phase: 'Final', ...SNM })
return { h, l, m, ck, gate: g, ci }
