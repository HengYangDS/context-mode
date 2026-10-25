export const meta = {
  name: 'v2-hooks-all',
  description: 'Hooks (and skills) installed and proven on every agent, no exception: verify each host hook channel from primary sources, setup installs/removes hooks + skills per required channel, doctor checks registered/runs/seen, CI rule, live saving test per agent, fix loop, merge, docs, review, gate, CI',
  phases: [
    { title: 'Verify', detail: 'one agent per host: hook events, register path, effects, skill dir' },
    { title: 'Build', detail: 'hookChannel + skillChannel, setup, doctor, CI rule (exp/hooks-all)' },
    { title: 'Live', detail: 'one live saving test per host' },
    { title: 'Fix', detail: 'fix failed hosts, re-test, max 2 rounds' },
    { title: 'Ship', detail: 'merge, docs, review, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'copilot-cli', 'opencode', 'pi', 'vscode', 'kiro', 'zcode']

const VERIFY = { type: 'object', properties: {
  agent: { type: 'string' }, hostVersion: { type: 'string' },
  hookEvents: { type: 'array', items: { type: 'string' } },
  register: { type: 'string' }, enableFlag: { type: 'string' },
  effects: { type: 'object', properties: {
    deny: { type: 'boolean' }, rewriteInput: { type: 'boolean' }, replaceOutput: { type: 'boolean' }, injectContext: { type: 'boolean' } },
    required: ['deny', 'rewriteInput', 'replaceOutput', 'injectContext'] },
  skillChannel: { type: 'string' }, headless: { type: 'string' }, loginAvailable: { type: 'boolean' },
  sources: { type: 'array', items: { type: 'string' } }, gaps: { type: 'array', items: { type: 'string' } } },
  required: ['agent', 'hostVersion', 'hookEvents', 'register', 'enableFlag', 'effects', 'skillChannel', 'headless', 'loginAvailable', 'sources', 'gaps'] }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, sha: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'sha', 'commits', 'numbers', 'summary'] }
const LIVE = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, hookRegistered: { type: 'boolean' }, hookFired: { type: 'boolean' },
  bytesOff: { type: 'number' }, bytesV2: { type: 'number' }, answerOk: { type: 'boolean' }, skillOk: { type: 'boolean' },
  evidence: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['agent', 'pass', 'hookRegistered', 'hookFired', 'bytesOff', 'bytesV2', 'answerOk', 'skillOk', 'evidence', 'problems'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY.
Own temp space only: /private/tmp/cm-v2-ha-${id} (clone with --depth 1 or full as needed, temp HOME, temp npm prefix). NEVER edit the real ~/.claude, ~/.codex, ~/.gemini, ~/.qwen, ~/.copilot, ~/.config, ~/.pi, ~/.vscode, ~/.kiro, ~/.zcode. To use a login, copy only the credential file into the temp HOME. Delete the temp space before you return.
Owner rule (2026-10-25): every agent gets hooks, no exception, or saving does not work. Never write instruction files (CLAUDE.md, AGENTS.md, GEMINI.md ...). No fallback paths: one defined channel per agent. No regex/truncation as a mechanism. Tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change; frozen evals e2e/live/compact-hard and bench/m2 never edited. No personal names, tenant ids or secrets.`

phase('Verify')
const ver = (await parallel(AGENTS.map((a) => () => agent(`${base('v-' + a)}\n\nRole: host researcher for ${a}. Do not commit.
Find, from PRIMARY sources only (the host's official docs/changelog/source repo, and the CLI you install into a temp prefix and run with --help / a probe), for the CURRENT version:
1. Which hook events exist (names) and exactly how a hook is registered: file path and shape (user level, not project), plugin/extension manifest, or in-process plugin list (e.g. opencode.json "plugin"); any feature flag needed (e.g. a Codex [features] key).
2. Which effects a hook can have: deny a tool call with a message, rewrite tool input, replace tool output, inject context into the prompt/session.
3. Where the host reads skills or slash commands (SKILL.md dirs or command files), user level.
4. How to run it headless for a test (exact command) and whether a login exists on this machine (check for a credential file only; never print it).
5. Compare with this repo: read src/adapters/table.ts row ${a}, build/manifests.ts hook shape for ${a}, src/setup/registry.ts, docs/install/${a}.md. List every gap (setup does not register the hook, wrong path, missing flag, missing events, no skill install).
Use git archaeology (git log -S / blame on the adapter files and ADRs) to learn why the current code is as it is before you call something a gap.
Return agent, hostVersion, hookEvents, register, enableFlag, effects, skillChannel, headless, loginAvailable, sources (URLs + version), gaps.`,
  { label: `v-${a}`, phase: 'Verify', schema: VERIFY, ...SNH })))).filter(Boolean)
const noHooks = ver.filter((v) => !v.hookEvents.length)
log(`verified ${ver.length}/${AGENTS.length}; hosts with no hook channel found: ${noHooks.map((v) => v.agent).join(', ') || 'none'}`)

phase('Build')
const BUILD = `${base('build')}\n\nBranch exp/hooks-all from v2-design head. Commit + push to that branch after each step (pull --rebase on reject).
Host facts (verified): ${JSON.stringify(ver).slice(0, 14000)}
Do:
1. ADR-0020 "Hooks and skills on every agent": per agent the hook channel, events, effects, skill channel, sources, and how saving works there (which of deny/rewrite/replace/inject the dispatch uses for that host). No exception rows.
2. src/adapters/table.ts: required fields hookChannel and skillChannel on every row (type-level required, no optional). A CI test fails if any row lacks either.
3. setup installs the hook for every agent through its channel: write/merge the host hook file or manifest entry, register the in-process plugin (opencode plugin list, pi), set any needed feature flag; and installs the skills (rendered per agent with that agent's tool name prefix, from the single source skills/) into the host skill/command dir. Only allow-listed files; backup + byte-exact rollback as today; idempotent; --remove removes both; --print prints both steps. Golden tests per agent (red first).
4. doctor: three hook checks per agent: registered (host config or host list command shows it), runs (sample event through the hook bundle), seen (a journal row from this agent exists; if none yet, say "not seen yet, run one tool call" as WARN, not PASS). Skill check: file present with the right prefix.
5. dispatch: for every host, use the strongest effect the host allows so large outputs are saved (replace where allowed; else deny + redirect to the ctx tool on the PreToolUse path; else rewrite input). Unit tests per host for the decision.
6. node --test tests/v2/ 0 fail, gate --all --quick green, build/check-install-docs.mjs green. One clean-temp-HOME setup + doctor run for all 10 agents with the release-out tarball.
Return done, sha (branch head), commits, numbers, summary.`
let b = await agent(BUILD, { label: 'ha-build', phase: 'Build', schema: RESULT, ...OPH })
if (!b || !b.done) b = await agent(`${BUILD}\n\nA previous attempt reported: ${JSON.stringify(b).slice(0, 2000)}. Continue from the pushed branch state.`, { label: 'ha-build-2', phase: 'Build', schema: RESULT, ...OPH })

const liveTest = (a, tag) => agent(`${base('l-' + a + tag)}\n\nRole: live saving test for ${a} on branch exp/hooks-all (fresh clone, full build, npm pack inside release-out, install the tarball into a temp prefix, temp HOME with only the host credential copied). Host facts: ${JSON.stringify(ver.find((v) => v.agent === a) || {}).slice(0, 2500)}.
1. context-mode setup --yes --agents ${a}; context-mode doctor --agents ${a}. Record the hook registration as the host sees it (host list command or config file).
2. In a temp project, make a 200 KB log file with one FATAL line holding a value. Run the host headless with its cheapest model (Claude: --model claude-sonnet-5-5 --effort low, --max-budget-usd 1; others: their cheapest model, one session): "Read logs/app.log with a shell cat and tell me the value on the FATAL line." Do it twice: once with context-mode removed (off arm), once installed.
3. Evidence from the transcript/session log: bytes of the tool result the model saw in each arm; the hook fired (context-mode journal row for agent ${a} in the store); answer correct. Then run the ctx-stats skill/command the host way and check it answers.
Pass = hookRegistered and hookFired and bytesV2 < bytesOff/2 and answerOk.
NO LOGIN on this machine (owner 2026-10-25: verify with web search, a login here is not needed): do not stop. Instead prove it without a model session:
(a) hookRegistered: after setup, the host's own CLI or config loader shows the hook (host list/inspect command, or the host's documented loader run on the temp HOME); quote the output.
(b) hookFired: web-search the host's official hook docs (current version) and quote the exact input payload and output fields for the events we use (URL + version in evidence). Build that exact payload for a shell cat of the 200 KB log, pipe it into the installed hook command (the command string setup registered, run as the host would), and check the hook's output matches the documented output schema field by field and replaces/denies as the docs say.
(c) bytesOff = 200 KB tool output, bytesV2 = bytes the host would pass to the model per the documented effect (replaced output, or deny message + the redirected ctx tool result run through the installed MCP server). answerOk = the FATAL value is in what the model would see.
Then pass follows the same rule; write "doc-verified, no live session" plus every URL in evidence. skillOk = the rendered skill file is in the host's documented skill dir with the host's tool prefix. Do not commit. Return agent, pass, hookRegistered, hookFired, bytesOff, bytesV2, answerOk, skillOk, evidence, problems.`,
  { label: `l-${a}${tag}`, phase: tag ? 'Fix' : 'Live', schema: LIVE, ...SNM })

phase('Live')
let live = (await parallel(AGENTS.map((a) => () => liveTest(a, '')))).filter(Boolean)
log(`live pass ${live.filter((l) => l.pass).length}/${AGENTS.length}`)

phase('Fix')
for (let round = 1; round <= 2; round++) {
  const failed = AGENTS.filter((a) => !(live.find((l) => l.agent === a) || {}).pass)
  if (!failed.length) break
  await agent(`${base('fix' + round)}\n\nBranch exp/hooks-all. Commit + push after each step. Live test failures: ${JSON.stringify(live.filter((l) => failed.includes(l.agent))).slice(0, 10000)}. Host facts: ${JSON.stringify(ver.filter((v) => failed.includes(v.agent))).slice(0, 6000)}.
Fix each at the root (tests first). If a failure is only a missing login or a host that cannot run headless, do not fake it: find a headless path from the host's own docs (e.g. its CLI or test harness) and use it; if none exists, record it in ADR-0020 open items. node --test tests/v2/ and gate --all --quick green. Return done, sha, commits, numbers, summary.`,
    { label: `ha-fix-${round}`, phase: 'Fix', schema: RESULT, ...OPH })
  const again = (await parallel(failed.map((a) => () => liveTest(a, `-r${round}`)))).filter(Boolean)
  live = live.filter((l) => !failed.includes(l.agent)).concat(again)
  log(`round ${round}: live pass ${live.filter((l) => l.pass).length}/${AGENTS.length}`)
}

phase('Ship')
const m = await agent(`${base('merge')}\n\nLive results: ${JSON.stringify(live.map((l) => ({ agent: l.agent, pass: l.pass, off: l.bytesOff, v2: l.bytesV2, problems: l.problems.slice(0, 2) }))).slice(0, 6000)}.
Merge rule: merge exp/hooks-all into v2-design (no force-push) if node --test tests/v2/ 0 fail, gate --all --quick green, and no agent that passed setup+doctor on v2-design head fails it on the branch. Merge at once when the rule holds, even if some hosts still fail live (they stay listed as open). Then update every docs/install/<agent>.md "What setup changes" (hooks and skills it installs, effects used) and docs/install/README.md with a table: agent, hook channel, skills, live saving result (bytes off -> v2, date, host version). Write docs/v2/spikes/hooks-all/RESULT.md with every live run. Update OPEN-ITEMS.md. Commit, push. Return done, sha, commits, numbers, summary.`,
  { label: 'ha-merge', phase: 'Ship', schema: RESULT, ...OPH })
const rv = await agent(`${base('review')}\n\nRole: one review of the merged hooks-all work. Merge report: ${JSON.stringify(m).slice(0, 2500)}. Fresh clone of v2-design. Check: every adapter row has hookChannel and skillChannel and the CI test enforces it; setup writes only allow-listed files and no instruction files; --remove restores byte for byte; doctor's registered/runs/seen checks are real (not just running the bundle); skills rendered with each host's tool prefix from one source; no fallback branches; red before green; DEVIATIONS rows; docs table matches RESULT.md. Fix small defects (tests first), list big ones. Return pass, problems, summary.`,
  { label: 'ha-review', phase: 'Ship', schema: CHECK, ...SNH })
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'ha-gate', phase: 'Ship', schema: GATE, ...HKM })
if (g && !g.green) await agent(`${base('gatefix')}\n\nRole: fixer on v2-design. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, sha, commits, numbers, summary.`, { label: 'ha-gatefix', phase: 'Ship', schema: RESULT, ...OPH })
const ci = await agent(`${base('ci')}\n\nCommit + push allowed. Role: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'ha-ci', phase: 'Ship', ...SNH })
return { ver, build: b, live, merge: m, review: rv, gate: g, ci }
