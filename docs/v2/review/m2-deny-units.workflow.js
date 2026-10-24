export const meta = {
  name: 'v2-m2-deny-units',
  description: 'Two small tracks on exp branches in parallel: (A) shorter Read deny text so M2 mean >= 90 without routing loss; (B) build line units lazily at the first recall, not in PostToolUse, so the 222 KB hook gap closes without losing compaction recall. Numeric merge rule, ship at once, one review, gate, CI',
  phases: [
    { title: 'Build', detail: 'deny text + lazy units, in parallel' },
    { title: 'Merge', detail: 'measure, rule, merge' },
    { title: 'Final', detail: 'review, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, branch: { type: 'string' }, sha: { type: 'string' },
  commits: { type: 'array', items: { type: 'string' } }, numbers: { type: 'string' }, summary: { type: 'string' } },
  required: ['done', 'branch', 'sha', 'commits', 'numbers', 'summary'] }
const MERGE = { type: 'object', properties: {
  done: { type: 'boolean' }, merged: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'merged', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode. Branches as stated. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY; its CLAUDE.md live-run rules apply (transcript is the evidence, explicit --model, </dev/null, fail closed).
Live claude -p: real Claude Code binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential, --plugin-dir <built release-out>, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd 1 per session. No API key. Kill hung grandchildren with e2e/live/lib/proc-group.mjs or the manual watchdog in docs/v2/spikes/compact/RESULT.md.
Own temp space only: /private/tmp/cm-v2-du-${id}; raw transcripts under /private/tmp/cm-v2-impl-private/compact-m2/du-${id}. Delete the temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Rules: no regex and no truncation as a mechanism (an AST test guards the search paths); never write instruction files; subagent contexts must not grow; D3 overhead p95 <= 15 ms; red test commit before green; never weaken an assertion; never raise a budget; frozen evals e2e/live/compact-hard (32f57beb) and bench/m2 (69077b8a) never edited, README included; one DEVIATIONS.md row per behaviour change; no personal names, tenant ids or secrets.
Evals: M2 = node bench/m2/eval.mjs (main|heldout, claude-sonnet-5-5, n=3). Compaction = node e2e/live/compact-hard/run.mjs --bundle <release-out> --set main|heldout --n 3 --model claude-sonnet-5-5 --budget 1 --jobs 9 --raw <dir>. Routing = GP-LIVE-ROUTING (e2e/live/routing).
Facts: v2-design db421365, CI green. M2 main mean 86.5-87.7 (runs 87.63/87.59/84.33/87.74/87.68). json-1 swings 84% -> 30% when the model first calls Read on the 501 KB file: the Read deny text is 482 B, more than half of the 900 B off arm; heldout read-csv loses the same way (484 B deny, then 2 follow-up calls). Compaction main 100% (4 runs), heldout 18/18. 222 KB PostToolUse is +10 ms vs pre-round-3 (paired n=20): the second FTS5 tokenization in insertUnits.
Pace: commit + push within your first 12 tool calls; push after each step; finish within 120 minutes.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r && r.done !== false) return r
  log(`${label}: not done, continue on sonnet high`)
  return agent(`${prompt}\n\nA previous attempt reported: ${JSON.stringify(r).slice(0, 1500)}. Continue from the pushed state; do not redo pushed commits.`, { label: label + '-retry', phase, schema, ...SNH })
}

const DENY = `${base('deny')}\n\nTrack A on branch exp/du-deny from v2-design head (live cap $10).
1. Find where the Read deny text is built (PreToolUse Read path, src/core/hooks, src/prompt). Quote it and its byte size from a json-1 transcript.
2. Make it as short as it can be while the model still makes the right next call: one line with the exact ctx tool call to run for THIS file (path filled in, e.g. ctx_execute_file or ctx_index + ctx_search as the routing rules say), no prose repeated from the tool descriptions. Build it from a template in src/prompt so the prompt lint covers it. Golden test of the exact text and a byte cap test (red first).
3. Measure: M2 main three times (n=3) and heldout once; GP-LIVE-ROUTING on claude-sonnet-5-5 and claude-opus-5-5 (under 0, over 0 must hold). Report json-1 and read-csv per run, and how often the model makes the right call after the deny.
Write docs/v2/spikes/m2/du-deny.md. Return done, branch, sha (branch head), commits, numbers (M2 main runs + mean, heldout, routing), summary.`

const UNITS = `${base('units')}\n\nTrack B on branch exp/du-units from v2-design head (live cap $10).
Design change: PostToolUse stores chunks only; line units for a source are built the first time a recall or ctx_resume needs them (first UserPromptSubmit after compaction, ctx_resume), from the stored chunks, inside the same process, once per source (mark built in the sources row). Keep the same unit algorithm (indent-stack, whole units) and the same ranked query + MMR. Also build them in the MCP server process when idle if that is simple and safe; else only on first need.
1. Red tests first: PostToolUse writes no line_units; first recall after compaction builds units and returns the same block as today on the compact-hard fixtures (golden from current head); second recall does not rebuild; purge/delete still remove units; schema migration (add the built flag) with a test.
2. Measure hook time interleaved n=20 vs pre-round-3 (5a79496d) and vs current head: 222 KB PostToolUse (target: within 3 ms of pre-round-3) and the first UserPromptSubmit after compaction on the 222 KB source (report it; it must stay under the D3 overhead budget measured the same way as e2e/checks/setup-hook-overhead.mjs, or say plainly by how much it misses). bench/hook-gs6 and the D3 check.
3. Compaction main twice (n=3) and heldout once; M2 main once (no drop).
Write docs/v2/spikes/compact/du-units.md. Return done, branch, sha, commits, numbers, summary.`

phase('Build')
const [deny, units] = await parallel([
  () => run(DENY, 'du-deny', 'Build', RESULT, OPH),
  () => run(UNITS, 'du-units', 'Build', RESULT, OPH),
])

phase('Merge')
const m = await run(`${base('merge')}\n\nResults: deny ${JSON.stringify(deny).slice(0, 2500)}; units ${JSON.stringify(units).slice(0, 2500)}.
Merge rule (no judgement), each branch on its own:
- exp/du-deny merges if: M2 main mean over its 3 runs >= 87.0 (current mean) + 1 AND heldout not lower than 97.4 - 1 AND routing under 0 / over 0 on both models AND every oracle passes AND unit + gate --all --quick green.
- exp/du-units merges if: compaction main mean >= 97% AND heldout >= 17/18 AND 222 KB PostToolUse within 3 ms of pre-round-3 AND D3 check passes AND M2 main not lower than 85 AND unit + gate --all --quick green.
Merge each passing branch into v2-design at once (no force-push); if both pass, merge deny first, then units, rebuild and run unit + gate --all --quick + one M2 main run (n=3) + one compaction main run (n=3) on the merged head (cap $8). Report whether M2 >= 90 holds on the merged head.
Update docs/v2/spikes/m2/RESULT.md, docs/v2/spikes/compact/RESULT.md, ADR-0009 if units changed, docs/v2/OPEN-ITEMS.md, and the M2/compaction rows in docs/benchmarks/v2-vs-v1/README.md with the merged numbers (every run, mean). Return done, merged (branch names), numbers, summary.`, 'du-merge', 'Merge', MERGE, OPH)

phase('Final')
const rv = await run(`${base('review')}\n\nRole: one review. Merge report: ${JSON.stringify(m).slice(0, 2500)}. Fresh clone of v2-design; diff since db421365. Check: frozen evals unchanged; the deny text is from a template and lint-covered; no regex/truncation; units are built once on first need and PostToolUse writes none; red before green; DEVIATIONS rows; numbers in the docs match the run files. Re-run M2 main once (n=3, cap $3). Fix small defects (tests first); list big ones. Return pass, problems, summary.`, 'du-review', 'Final', CHECK, SNH)
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'du-gate', phase: 'Final', schema: GATE, ...HKM })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, branch "v2-design", sha, commits, numbers, summary.`, 'du-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node with the D3 numbers and the final run id.`,
  { label: 'du-ci', phase: 'Final', ...SNH })
return { deny, units, m, rv, gate: g, ci }
