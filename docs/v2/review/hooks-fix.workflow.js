export const meta = {
  name: 'v2-hooks-fix',
  description: 'Close the hosts that failed hooks-all (vscode, zcode, kiro; re-test pi, copilot-cli), make doctor fail on a hook that saves nothing, render gemini/pi skills, claude-code PATH shim, opencode stats, cache guard test; re-test, gate, CI',
  phases: [
    { title: 'Fix', detail: 'one fixer on v2-design, test-first' },
    { title: 'Test', detail: 'doc-verified saving test per host' },
    { title: 'Ship', detail: 'second fix round, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
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
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Pace (owner): commit + push about every minute of work (after every file change and every test run; "wip:" commits are fine; pull --rebase on reject). On start, fetch and continue from what is pushed; never redo pushed commits.
Own temp space only: /private/tmp/cm-v2-hf-${id} (temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.copilot, ~/.config, ~/.pi, ~/.vscode, ~/.kiro, ~/.zcode, ~/.gemini, ~/.qwen. Delete the temp space before you return.
Owner rule: every agent gets hooks, no exception, or saving does not work. Never write instruction files. One defined channel per agent, no fallback paths. No regex/truncation as a mechanism. Tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change; frozen evals e2e/live/compact-hard and bench/m2 never edited. Read ADR-0020, ADR-0021, docs/v2/OPEN-ITEMS.md (H1-H8, C1-C5) and use git archaeology before changing code.`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error. Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

const FIX = `${base('fix')}\n\nRole: fixer. Close each item at the root, one red test then the fix, using each host's official docs (web search, current version; cite URL + version in the DEVIATIONS row):
H1 vscode: hook command and MCP args lack --workspace-folder, so every hook gets NO_PROJECT. Register the project the documented way for VS Code (MCP args \${workspaceFolder}; for the hook, the payload cwd or the documented variable), so a hook run from a project resolves it.
H2 zcode: hook file must use matcher groups {matcher, hooks:[...]} per the host's strict schema; MCP under mcp.servers.<name> {type:"stdio", enabled:true, timeoutMs} plus features.mcp true. Doctor hook-registered must validate the documented shape.
Kiro: PreToolUse/PostToolUse matcher is @mcp only, so a native shell cat never reaches the hook. Register the shell tool too. Kiro PostToolUse cannot replace output, so saving is PreToolUse deny + redirect to ctx_execute; per Kiro docs exit 2 returns STDERR to the model, so the deny text must go to stderr (extend HookOutput with a stderr channel used by the kiro encode only).
H5 doctor: hook-runs must send the golden payload for a large shell read and FAIL unless the decision is the host's saving effect (deny/replace) and the project resolved; NO_PROJECT or an empty decision is FAIL with a fix line. This must turn the old false PASS (pi before D-HA-PI-PROJECT-1, vscode now) red in a test.
Skills: gemini and pi load skills from the package dir unrendered (bare ctx_stats). Render them per host with the host tool name (gemini: mcp_context-mode_ctx_stats per its docs; pi: its in-process tool names) at build time into the per-host package dir, from the single skills/ source, split/join only.
H8 claude-code: setup fails when a shim is first on PATH; resolve the real claude binary the documented way and say which one doctor used.
H6 opencode: saving done by the in-process plugin is not recorded in ctx_stats; journal it like the other hosts.
C5 cache: add tests/v2/cache/prefix-determinism.test.mjs (byte-identical initialize + tools/list across 5 starts per agent with different cwd, TZ, store, env; no list_changed emitted) and a lint that tool descriptions and instructions hold no dynamic tokens; wire both into scripts/gate.mjs. Also pin pi and opencode system-prompt bytes identical across turns.
Then node --test tests/v2/ 0 fail, gate --all --quick green, check-install-docs green, a clean-temp-HOME setup + doctor for all 10 agents with the release-out tarball. Update docs/install pages for the changed hosts and OPEN-ITEMS. Return done, commits, numbers, summary.`

const testHost = (a, tag) => retry(`${base('t-' + a + tag)}\n\nRole: saving test for ${a} on the v2-design head (fresh clone, full build, npm pack inside release-out, install into a temp prefix, temp HOME).
1. context-mode setup --yes --agents ${a}; context-mode doctor --agents ${a}; quote the host's own view of the hook registration (host list command or config file) and check it against the host's official hook docs (web search, current version, quote URL).
2. Make a 200 KB log with one FATAL line. Build the exact documented hook payload the host sends for a shell cat of it (and for Read where the host has one), pipe it into the registered hook command exactly as the host runs it (same argv, cwd = temp project), and check the output matches the documented output schema and that the effect saves bytes: bytesOff = raw tool output, bytesV2 = what the model would see (replaced output, or deny text + the redirected ctx tool result from the installed MCP server). answerOk = FATAL value present.
3. skillOk = rendered skill in the host's documented skill dir names the host's real tool name.
If the host CLI installs without a login, also run its loader/list command to prove it parses our files. Pass = hookRegistered and hookFired and bytesV2 < bytesOff/2 and answerOk and skillOk. Write "doc-verified" + URLs in evidence. Do not commit. Return agent, pass, hookRegistered, hookFired, bytesOff, bytesV2, answerOk, skillOk, evidence, problems.`,
  { label: `t-${a}${tag}`, phase: tag ? 'Ship' : 'Test', schema: LIVE, ...SNM })

const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'copilot-cli', 'opencode', 'pi', 'vscode', 'kiro', 'zcode']

phase('Fix')
const fix = await retry(FIX, { label: 'hf-fix', phase: 'Fix', schema: RESULT, ...OPH })

phase('Test')
let tests = (await parallel(AGENTS.map((a) => () => testHost(a, '')))).filter(Boolean)
log(`saving test pass ${tests.filter((t) => t.pass).length}/${AGENTS.length}`)

phase('Ship')
let fix2 = null
const failed = AGENTS.filter((a) => !(tests.find((t) => t.agent.startsWith(a)) || {}).pass)
if (failed.length) {
  fix2 = await retry(`${base('fix2')}\n\nRole: fixer, round 2. Failed hosts: ${JSON.stringify(tests.filter((t) => !t.pass)).slice(0, 10000)}. Fix each at the root, test-first, then node --test tests/v2/ and gate --all --quick green. Return done, commits, numbers, summary.`, { label: 'hf-fix2', phase: 'Ship', schema: RESULT, ...OPH })
  const again = (await parallel(failed.map((a) => () => testHost(a, '-r2')))).filter(Boolean)
  tests = tests.filter((t) => !failed.some((a) => t.agent.startsWith(a))).concat(again)
  log(`after round 2: pass ${tests.filter((t) => t.pass).length}/${AGENTS.length}`)
}
await retry(`${base('doc')}\n\nUpdate docs/install/README.md hooks table (agent, hook channel, saving effect, skills, test result bytes off -> v2, date, host version, "doc-verified") and docs/v2/spikes/hooks-all/RESULT.md with these runs: ${JSON.stringify(tests.map((t) => ({ a: t.agent, pass: t.pass, off: t.bytesOff, v2: t.bytesV2, p: t.problems.slice(0, 2) }))).slice(0, 7000)}. Update OPEN-ITEMS (close what passed). check-install-docs green. Commit, push. Return done, commits, numbers, summary.`, { label: 'hf-doc', phase: 'Ship', schema: RESULT, ...SNM })
const g = await retry(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, npm install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`, { label: 'hf-gate', phase: 'Ship', schema: GATE, ...HKM })
if (g && !g.green) await retry(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, commits, numbers, summary.`, { label: 'hf-gatefix', phase: 'Ship', schema: RESULT, ...OPH })
const ci = await retry(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`, { label: 'hf-ci', phase: 'Ship', ...SNM })
return { fix, tests, fix2, gate: g, ci }
