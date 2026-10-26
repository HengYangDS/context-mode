export const meta = {
  name: 'v2-hooks-last',
  description: 'Close the last defects after hooks-fast: claude-code skills name the wrong tool, deny/hint texts use bare ctx_* names on prefixed hosts, H9 handle-line hint returns no hits, D3 hook cold start headroom; gate, CI',
  phases: [
    { title: 'Fix', detail: '3 fixers in parallel, test-first' },
    { title: 'Ship', detail: 'gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). 2 other agents push to v2-design at the same time: small commits, git pull --rebase before every push, on conflict keep both sides. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Pace (owner): commit + push about every minute of work ("wip:" commits are fine). On start, fetch and continue from what is pushed.
Own temp space only: /private/tmp/cm-v2-hl-${id}. Never edit the real ~/.claude, ~/.codex etc. Delete the temp space before you return.
Rules: every agent gets hooks; never write instruction files; one channel per agent, no fallback paths; no regex/truncation as a mechanism; tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change; frozen evals e2e/live/compact-hard and bench/m2 never edited. Run only your files' tests while working; node --test tests/v2/ once before the last push (0 fail).`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error. Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

const ITEMS = [
  ['ccskills', `Claude Code skills name the wrong tool. After D-HQ-SKILLS-1 (46a58920) root skills/ holds Gemini's render (mcp_context-mode_ctx_stats), and the Claude plugin also reads root skills/. Claude Code's real name is mcp__plugin_context-mode_context-mode__ctx_stats. Give each host its own rendered skills dir (claude-code via the plugin.json "skills" key per the Claude Code plugins reference; gemini where Gemini reads extension skills), from the single skills/ source. Add a test that, for every host, the shipped skill text names exactly that host's real tool name and no other host's.`],
  ['names', `Hook texts name bare tools on prefixed hosts. Gemini's AfterTool deny reason says ctx_search(...), but Gemini names it mcp_context-mode_ctx_search; check every deny/replace/hint text for all 10 hosts. Render tool names in every hook output with the host's toolNamePrefix (split/join). Also H9 (OPEN-ITEMS): the handle-line hint ctx_search({queries:["cat big.log"], source:"s1"}) returns no hits when the output holds none of the intent words. Make the hint always return rows for its source: a source-only query must list that source's chunks (top by position) when the query words do not match. Test both.`],
  ['perf', `Profiling (owner rule): D3 hook overhead. codex hook cold start measured 11 ms vs 10.5 ms target (30% headroom under the 15 ms budget); CI windows/node 24 saw 17 ms. The profile (docs/v2/spikes/perf/PROFILE.md) shows ~3 ms ESM compile of the bundle; compile cache was rejected (D-CI-PERF-4). Make the hook bundle smaller at the root: split per event or lazy-load the code paths each event does not need, so a PreToolUse run compiles only what it uses. Measure 10-run p95 per host before/after with --cpu-prof, update PROFILE.md. Never raise the budget.`],
]

phase('Fix')
const items = await parallel(ITEMS.map(([id, task]) => () => retry(`${base(id)}\n\nRole: fixer for one item.\n${task}\nReturn done, commits, numbers, summary.`, { label: `hl-${id}`, phase: 'Fix', schema: RESULT, ...(id === 'ccskills' ? SNH : OPH) })))

phase('Ship')
const g = await retry(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, npm install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs, build/check-prompt-static.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`, { label: 'hl-gate', phase: 'Ship', schema: GATE, ...HKM })
if (g && !g.green) await retry(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, commits, numbers, summary.`, { label: 'hl-gatefix', phase: 'Ship', schema: RESULT, ...OPH })
const ci = await retry(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`, { label: 'hl-ci', phase: 'Ship', ...SNM })
return { items, gate: g, ci }
