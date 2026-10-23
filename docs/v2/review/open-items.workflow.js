export const meta = {
  name: 'v2-open-items',
  description: 'Founder-mandated fix of the 7 open items in parallel: macOS/Windows hook timing gate, kiro SessionStart output, Gemini resume hint, ADR-0006 live probe, v2 fixed cost on short tasks (+ bench re-run), tenant-id history decision, npm owner step prep; then OPEN-ITEMS update, gate, CI',
  phases: [
    { title: 'Fix', detail: '5 fixes in parallel' },
    { title: 'Bench', detail: 'cost re-run if the short-task fix helps' },
    { title: 'Final', detail: 'decisions doc, OPEN-ITEMS, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const GW = '/Users/mksglu/Server/Mert/context-mode-sandbox'
const WT = '/private/tmp/cm-gwb-wt'
const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Another workflow pushes to the same branch right now (search, docs, README): pull --rebase often, keep commits small, resolve conflicts by keeping both sides' intent. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Gateway repo ${GW}: READ ONLY (push = production deploy). Harness work only in ${WT} (local branch, never pushed).
Own temp space only: /private/tmp/cm-v2-oi-${id} (clone, temp HOME). Never edit the real ~/.claude, ~/.kiro, ~/.gemini etc. Delete your temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion; never raise a budget to make a check pass. DEVIATIONS.md row per behaviour change. Write no personal names, no tenant ids, no secrets.
Live claude -p runs: real binary, explicit --model, </dev/null, fresh CLAUDE_CONFIG_DIR with the login credential copied, --strict-mcp-config, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd per session as stated. Transcript is the evidence, never model prose.
Pace: commit + push within your first 15 tool calls; push after each step; done within 90 minutes.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const FIX = {
  timing: `Item 1: hook timing is gated only on ubuntu (e2e/checks/setup-hook-overhead.mjs, D3 overhead p95 <= 15 ms). In the setup e2e info lines macOS showed claude-code 110 ms and codex 57 ms, Windows 15-19 ms. Find out with evidence whether this is first-run cold start (first spawn of a new binary: Gatekeeper/XProtect on macOS, Defender scan on Windows, disk cache) or real per-call cost: on macOS locally measure first call vs warm calls on a fresh copy of release-out; on Windows and macOS CI add a diagnostic step that prints first-call and warm batches. Then gate both OSes the same way as ubuntu (warm-up calls, lowest of 5 batch p95, 15 ms budget, unchanged), and report cold first-call separately as info. If warm macOS/Windows overhead is over 15 ms, cut the cost (same approach as D-CI-PERF-3/4), do not raise the budget. Watch CI (gh run watch) until the new steps pass on all three OSes.`,
  kiro: `Item 2: the kiro SessionStart hook exits 0 with empty stdout (install verifier, release 05e97724) while docs say it prints context. Use Kiro CLI's documented hook input and output contract (kiro.dev docs; cite URL and date) and the adapter src/adapters/kiro.ts. Feed the documented SessionStart payload (cwd in a fresh git repo) through release-out/hook.mjs --agent kiro. Find the root cause (decode, project resolution, output channel kiro reads, or by design nothing to print on a first session). Fix at the root or fix the docs if empty is correct; add a golden e2e fixture for kiro SessionStart (e2e/fixtures/kiro/...). If kiro-cli can be installed in the temp prefix, prove one hook run by kiro itself; else say not run and why.`,
  gemini: `Item 3: Gemini lost the "call ctx_resume" hint at session start when SessionStart was removed from hooks/hooks.json (D-FU-GCH-1, Claude Code loads that file). GP6/no-resume-hint-mid-session forbids the hint on BeforeAgent mid-session. Design an algorithmic fix: deliver the hint exactly once per Gemini session, on the first BeforeAgent of that session (first-turn detection keyed by the session id in the payload, stored in the v2 DB, so a later BeforeAgent never gets it); only when there is something to resume (same rule as the Claude SessionStart path). Keep GP6 as is (mid-session still forbidden) and add GP6/gemini-resume-hint-first-turn-only that proves first turn yes, second turn no, new session yes, nothing to resume no. Update docs/install/gemini.md and the adapter docs.`,
  probe: `Item 4: ADR-0006 (docs/v2/adr/0006-claude-code-tool-loading.md) waits for a live probe with Opus and Sonnet in the keyless harness (ADR-0012). Read ADR-0006 for the exact probe question and pass criteria, run it with release-out as --plugin-dir on claude-opus-5-5 and claude-sonnet-5-5 (n as the ADR says, else 5 per model), --max-budget-usd 0.5 per session, and record per run: tools in init, deferred or loaded, whether the model used the ctx tools when the routing needs them, tokens. Write docs/v2/spikes/adr-0006-probe.md with raw counts, set ADR-0006 status from the result (Accepted, or Amended with the measured behaviour), commit, push.`,
  cost: `Item 5: v2 costs more than direct on short tasks (v1-v2-gateway: +2.2% pooled; try-it: +16%). Cause to test: a fixed per-session cost (server instructions + 9 tool schemas sent every turn, any hook context added on small outputs, ToolSearch round trips). Do: (a) measure the fixed cost: tokens of v2 init (instructions + tool schemas) from a transcript, per-turn cache read/write deltas vs direct on the same task; (b) cut it algorithmically without losing routing: shortest tool descriptions that still pass the prompt lint and the routing e2e cases, server instructions only what routing needs, no hook output on outputs below the replace threshold, tool set that loads lazily where the client supports deferred loading (follow ADR-0006 result if available), no duplicate text between instructions and descriptions; (c) quick A/B in ${WT} with the start-cost-ab harness (--arms plain,v2 with v2 before = current release-out and v2 after = your build as a second plugin arm if the harness allows, else run before/after in two runs on the same 6 short workloads), claude-opus-5-5, 3 cycles, --max-budget-usd 1.5. Pass: v2-after mean cost per task <= v2-before on 6 of 6 tasks and the pooled change vs plain lower than before, with all routing e2e cases green. Write docs/v2/spikes/fixed-cost.md (before/after tokens and cost), commit, push. Return numbers including pooled % vs plain before and after.`,
}

phase('Fix')
const ids = Object.keys(FIX)
const res = await parallel(ids.map((id) => () => run(`${base(id)}\n\n${FIX[id]}\nReturn done, commits, numbers, summary.`, `oi-${id}`, 'Fix', RESULT, id === 'kiro' || id === 'probe' ? SNH : OPH)))
const fixes = Object.fromEntries(ids.map((id, i) => [id, res[i]]))

phase('Bench')
let bench = null
if (fixes.cost && fixes.cost.done) {
  bench = await run(`${base('bench')}\n\nShort-task fix: ${JSON.stringify(fixes.cost).slice(0, 2500)}.
Role: benchmark runner. Re-measure the published v1-v2-gateway page for the v2 arm after the fix. Write docs/benchmarks/v1-v2-gateway/prereg-amendment-1.md first (what changed in v2, v2 sha, same workloads, same harness, 1 warm-up + 8 cycles of direct and v2, order rotated, claude-opus-5-5, same analysis, $25 stop) and push it BEFORE any run. Run in ${WT}, append lines with "amendment": 1 to runs/*.jsonl (old lines stay), push after every cycle. Update analyze.mjs, ab.json and README.md: v2 row from amendment 1, the old v2 row kept as superseded with reason. Have the numbers recomputed by a separate script of your own from the run lines (t at df = n-1). Commit, push. Return numbers per task and pooled vs direct.`, 'oi-bench', 'Bench', RESULT, SNH)
}

phase('Final')
const dec = await run(`${base('dec')}\n\nRole: decision record. Results: ${JSON.stringify(fixes).slice(0, 6000)}; bench: ${JSON.stringify(bench).slice(0, 1500)}.
Write docs/v2/FOUNDER-DECISIONS-2026-10-23.md (decided on the founder's mandate, the founder reviews it) with:
- Item 6, owner tenant id in git history (commits from 7f320e16 on, rule text in workflow files, removed from the tree in 0e4c1af9/39593282): decision NOT to rewrite v2-design history. Reasons: the id is an identifier, not a credential (every gateway admin action needs the admin key, check this in ${GW} read-only and cite the file); GitHub keeps old commits reachable by SHA and in forks, so a force-push does not remove it; a force-push while other workflows push risks losing work. Action: the tree is clean, a CI check (add it: build/check-secrets.mjs or the existing removed-check) fails if a tenant id pattern t_[0-9a-f]{8} appears in tracked files outside a private path; if the founder wants the id gone, rotate the tenant (gateway side, founder step) rather than rewrite history.
- Item 7, npm trusted publisher: founder-only step (needs the npmjs.com login and 2FA). Everything else is ready: point to docs/v2/NPM-OWNER-STEPS.md, release.yml publish-npm job, check-npm-tarball.mjs; list the exact 5 clicks and the first command after it.
- Items 1-5: one line each, result and evidence link.
Then update docs/v2/OPEN-ITEMS.md (pull first; another agent may have written it): set each of the 7 rows to its new status with evidence. Commit, push.`, 'oi-dec', 'Final', RESULT, SNH)
const g = await agent(`${base('gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, build/check-removed.mjs, build/check-install-docs.mjs, build/check-readme.mjs, node bench/fixtures/run.mjs --check, and the new tenant-id check. Do not fix. Return green, failing, summary.`,
  { label: 'oi-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'oi-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node, the hook timing steps on all three OSes, and the final run id.`,
  { label: 'oi-ci', phase: 'Final', ...SNM })
return { fixes, bench, dec, gate: g, ci }
