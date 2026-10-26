export const meta = {
  name: 'v2-hooks-fast',
  description: 'Parallel finish of hooks-fix: 4 item fixers + 10 per-host test->fix->retest pipelines at once on v2-design, then docs, gate, CI',
  phases: [
    { title: 'Parallel', detail: 'item fixers and per-host pipelines run at the same time' },
    { title: 'Ship', detail: 'docs, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const LIVE = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, hookRegistered: { type: 'boolean' }, hookFired: { type: 'boolean' },
  bytesOff: { type: 'number' }, bytesV2: { type: 'number' }, answerOk: { type: 'boolean' }, skillOk: { type: 'boolean' },
  evidence: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['agent', 'pass', 'hookRegistered', 'hookFired', 'bytesOff', 'bytesV2', 'answerOk', 'skillOk', 'evidence', 'problems'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Up to 14 other agents push to v2-design at the same time: keep commits small, git pull --rebase before every push, on conflict keep both sides (DEVIATIONS.md / OPEN-ITEMS.md: keep every row). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Pace (owner): commit + push about every minute of work ("wip:" commits are fine). On start, fetch and continue from what is pushed; never redo pushed commits.
Own temp space only: /private/tmp/cm-v2-hq-${id} (temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.copilot, ~/.config, ~/.pi, ~/.vscode, ~/.kiro, ~/.zcode, ~/.gemini, ~/.qwen. Delete the temp space before you return.
Owner rule: every agent gets hooks, no exception. Never write instruction files. One defined channel per agent, no fallback paths. No regex/truncation as a mechanism. Tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change; frozen evals e2e/live/compact-hard and bench/m2 never edited. Read ADR-0020, ADR-0021, docs/v2/OPEN-ITEMS.md; use git archaeology before changing code.
Already done and pushed (do not redo): H1 vscode, H2 zcode, kiro shell matcher + stderr deny, H5 doctor saving check, H6 in-process journal rows.
Only run the tests that touch your files while you work (node --test <files>); before your last push run node --test tests/v2/ once (0 fail).`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error. Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

const ITEMS = [
  ['skills', `Skills: gemini and pi load skills from the package dir unrendered (bare ctx_stats). Render them per host with the host's real tool name (gemini per its docs: mcp_context-mode_ctx_stats; pi: its in-process tool names) at build time into the per-host package dir, from the single skills/ source, split/join only. Red test first.`],
  ['shim', `H8 claude-code: setup fails when a shim is first on PATH. Resolve the real claude binary the documented way; doctor prints which binary it used. Red test first.`],
  ['cache', `C5 cache guard: tests/v2/cache/prefix-determinism.test.mjs (byte-identical initialize + tools/list across 5 starts per agent with different cwd, TZ, store, env; no list_changed emitted), a lint that tool descriptions and instructions hold no dynamic tokens, and pi/opencode system-prompt bytes identical across turns. Wire into scripts/gate.mjs.`],
  ['perf', `P1 profiling (owner rule: never forget profiling): D3 hook overhead 17 ms vs 15 ms (windows, node 24) and GP-SEARCH heldout p95 67 ms vs 50 ms (ubuntu, node 24) sit at their limits. Profile both (node --cpu-prof on the hook entry cold start and on the search path), write top self-time frames before and after to docs/v2/spikes/perf/PROFILE.md, and make them faster at the root (less work at module load, lazy imports, prepared statements, fewer allocations) until each has at least 30% headroom on a local 10-run p95. Never raise a budget.`],
]
const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'copilot-cli', 'opencode', 'pi', 'vscode', 'kiro', 'zcode']

const testHost = (a, tag) => retry(`${base('t-' + a + tag)}\n\nRole: saving test for ${a} on the current v2-design head (fresh clone, full build, npm pack inside release-out, install into a temp prefix, temp HOME). Do not commit.
1. context-mode setup --yes --agents ${a}; context-mode doctor --agents ${a}; quote the host's own view of the hook registration (host list command or config file) and check it against the host's official hook docs (web search, current version, quote URL).
2. Make a 200 KB log with one FATAL line. Build the exact documented hook payload the host sends for a shell cat of it, pipe it into the registered hook command exactly as the host runs it (same argv, cwd = temp project), check the output matches the documented output schema and that the effect saves bytes: bytesOff = raw tool output, bytesV2 = what the model would see (replaced output, or deny text + the redirected ctx tool result from the installed MCP server). answerOk = FATAL value present.
3. skillOk = rendered skill in the host's documented skill dir names the host's real tool name.
If the host CLI installs without a login, also run its loader/list command to prove it parses our files. Pass = hookRegistered and hookFired and bytesV2 < bytesOff/2 and answerOk and skillOk. Write "doc-verified" + URLs in evidence. Return agent, pass, hookRegistered, hookFired, bytesOff, bytesV2, answerOk, skillOk, evidence, problems.`,
  { label: `t-${a}${tag}`, phase: 'Parallel', schema: LIVE, ...SNL })

async function hostLoop(a) {
  let t = await testHost(a, '')
  for (let round = 1; round <= 3 && t && !t.pass; round++) {
    await retry(`${base('f-' + a + round)}\n\nRole: fixer for ${a} only, round ${round}. The owner wants every host green. Failed test: ${JSON.stringify(t).slice(0, 6000)}. Fix at the root in the ${a} adapter/setup/hook code (touch shared code only if the root cause is there), red test first, then green. If the failure is in skills rendering, another agent owns that: wait 5 minutes, fetch, and re-check before touching it. Return done, commits, numbers, summary.`,
      { label: `f-${a}-${round}`, phase: 'Parallel', schema: RESULT, ...OPH })
    t = await testHost(a, `-r${round}`)
  }
  return t
}

phase('Parallel')
const [items, tests] = await Promise.all([
  parallel(ITEMS.map(([id, task]) => () => retry(`${base(id)}\n\nRole: fixer for one item.\n${task}\nReturn done, commits, numbers, summary.`, { label: `i-${id}`, phase: 'Parallel', schema: RESULT, ...OPH }))),
  parallel(AGENTS.map((a) => () => hostLoop(a))),
])
// skills change can land after a host passed: re-test the hosts whose skill check could move
const skillHosts = ['gemini', 'pi']
const final = tests.filter(Boolean).filter((t) => !skillHosts.some((h) => t.agent.startsWith(h)))
  .concat((await parallel(skillHosts.map((a) => () => hostLoop(a)))).filter(Boolean))
log(`pass ${final.filter((t) => t.pass).length}/${AGENTS.length}`)

phase('Ship')
await retry(`${base('doc')}\n\nUpdate docs/install/README.md hooks table (agent, hook channel, saving effect, skills, bytes off -> v2, date, host version, "doc-verified") and docs/v2/spikes/hooks-all/RESULT.md with: ${JSON.stringify(final.map((t) => ({ a: t.agent, pass: t.pass, off: t.bytesOff, v2: t.bytesV2, p: t.problems.slice(0, 2) }))).slice(0, 7000)}. Item fixers: ${JSON.stringify(items.map((i) => i && i.summary.slice(0, 400)))}. Update OPEN-ITEMS (close what passed). check-install-docs green. Commit, push. Return done, commits, numbers, summary.`, { label: 'hq-doc', phase: 'Ship', schema: RESULT, ...SNM })
const g = await retry(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, npm install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`, { label: 'hq-gate', phase: 'Ship', schema: GATE, ...HKM })
if (g && !g.green) await retry(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, commits, numbers, summary.`, { label: 'hq-gatefix', phase: 'Ship', schema: RESULT, ...OPH })
const ci = await retry(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`, { label: 'hq-ci', phase: 'Ship', ...SNM })
return { items, final, gate: g, ci }
