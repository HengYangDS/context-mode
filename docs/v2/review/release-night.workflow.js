export const meta = {
  name: 'v2-release-night',
  description: 'Fix the Windows smoke failure (codex ENOENT), release 2.0.0-next.N by tag push until npm next is published (max 4 tries), then test the published package on all 10 agents (Claude Code + Codex live), fix and re-release if red, write the morning summary',
  phases: [
    { title: 'Release', detail: 'fix -> CI green -> tag -> watch, loop' },
    { title: 'Verify', detail: '10 agents on the npm package' },
    { title: 'Morning', detail: 'fix red hosts, re-release, summary' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const REL = { type: 'object', properties: {
  published: { type: 'boolean' }, version: { type: 'string' }, failingStep: { type: 'string' }, logLines: { type: 'string' }, summary: { type: 'string' } },
  required: ['published', 'version', 'failingStep', 'logLines', 'summary'] }
const LIVE = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, live: { type: 'boolean' }, bytesOff: { type: 'number' }, bytesV2: { type: 'number' },
  answerOk: { type: 'boolean' }, skillOk: { type: 'boolean' }, evidence: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['agent', 'pass', 'live', 'bytesOff', 'bytesV2', 'answerOk', 'skillOk', 'evidence', 'problems'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never force-push v2-design, never delete or move a pushed tag, never run npm publish / npm dist-tag / npm deprecate yourself, never use an npm token. npm latest must stay 1.0.169.
Pace: commit + push about every minute of work; pull --rebase before every push. On start, fetch and continue from what is pushed.
Own temp space only: /private/tmp/cm-v2-rx-${id} (temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.gemini, etc. Delete the temp space before you return.
Rules: every agent gets hooks; never write instruction files; no regex as a mechanism; tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change.`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error. Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

const release = (n, why) => retry(`${base('rel' + n)}\n\nRole: release 2.0.0-next.${n} (the owner approved npm next releases). ${why}
1. Fix first, if a failure is given: find the root cause, red test, fix, push. For a Windows spawn failure, audit EVERY spawn/spawnSync/execFile in scripts/release/*.mjs and src/setup for Windows npm shims (.cmd/.ps1): resolve the binary the same way setup does (PATHEXT lookup) and run .cmd through the documented Windows way; add a unit test that runs on win32 in CI. Also fix any other smoke step that would fail on Windows the same way (gemini, qwen, copilot, opencode, pi...).
2. Wait for the ci.yml run on the v2-design head to be green (gh run watch, up to 60 min). If red: fix, push, wait; max 2 rounds; if still red return published=false.
3. Check npm view context-mode dist-tags (latest 1.0.169) and that tag v2.0.0-next.${n} does not exist on origin. release-staging may hold an older staged commit; publish.mjs moves it with --force-with-lease, which is fine.
4. git tag -a v2.0.0-next.${n} -m v2.0.0-next.${n} <green head sha>; git push origin refs/tags/v2.0.0-next.${n}. Watch the release.yml run for that tag to the end (up to 90 min).
5. If it fails: return published=false with the failing job, step and log lines (gh run view --log-failed). Do not re-tag.
6. If it passes: npm view context-mode dist-tags must show next 2.0.0-next.${n} and latest 1.0.169; npm view context-mode@2.0.0-next.${n} dist.attestations exists; gh release view v2.0.0-next.${n} is a prerelease and v1.0.169 is still Latest. Return published, version, failingStep, logLines, summary.`, { label: `rx-rel-${n}`, phase: 'Release', schema: REL, ...OPH })

phase('Release')
let n = 2
let rel = await release(n, 'Previous attempt: tag v2.0.0-next.1 (run 40416787147) failed in "smoke (windows-latest)", step "smoke.mjs --ref release-staging --agent codex": "codex: FAIL: codex mcp list --json: spawnSync codex ENOENT". Nothing was published; the tag v2.0.0-next.1 stays as is (do not touch it).')
while (rel && !rel.published && n < 5) {
  n++
  rel = await release(n, `Previous attempt v2.0.0-next.${n - 1} failed at ${rel.failingStep}: ${rel.logLines.slice(0, 2500)}`)
}
log(rel && rel.published ? `published ${rel.version}` : `not published after next.${n}`)

phase('Verify')
const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'copilot-cli', 'opencode', 'pi', 'vscode', 'kiro', 'zcode']
const LIVE_HOW = {
  'claude-code': 'LIVE: real claude binary, fresh CLAUDE_CONFIG_DIR with only the login credential (keychain on macOS: use the documented way the gateway sandbox CLAUDE.md describes), --model claude-sonnet-5-5 --effort low, --max-budget-usd 1, stream-json; off arm (no plugin) and v2 arm (setup from the npm package). Bytes from the transcript tool_result.',
  codex: 'LIVE: you are the ONLY agent allowed to use the Codex login. Copy ~/.codex/auth.json once into a temp CODEX_HOME, run codex exec --json with the cheapest model, off and v2 arms, one session each. Never run two codex processes at once (refresh token reuse breaks the login). Bytes from the rollout tool output.',
}
const verify = (a, tag) => retry(`${base('v-' + a + tag)}\n\nRole: test the PUBLISHED npm package on ${a}. Install it: npm i -g context-mode@next --prefix <temp prefix>; record the version. Temp HOME. context-mode setup --yes --agents ${a}; context-mode doctor --agents ${a}.
Task: a 200 KB log with one FATAL line; "read logs/app.log with a shell cat and tell me the value on the FATAL line".
${LIVE_HOW[a] || 'Doc-verified (no login): build the exact documented hook payload (web search the host hook docs, quote URL + version), pipe it into the hook command setup registered, check the output schema and the bytes the model would see. If the host CLI installs without a login, run its list/loader command to prove it parses our files.'}
Pass = setup and doctor PASS, hook fired, bytesV2 < bytesOff/2, answer correct, skill names the host real tool. Do not commit. Return agent, pass, live, bytesOff, bytesV2, answerOk, skillOk, evidence, problems.`, { label: `rx-v-${a}${tag}`, phase: 'Verify', schema: LIVE, ...(LIVE_HOW[a] ? SNH : SNL) })

let tests = []
if (rel && rel.published) {
  tests = (await parallel(AGENTS.map((a) => () => verify(a, '')))).filter(Boolean)
  log(`npm package: pass ${tests.filter((t) => t.pass).length}/${AGENTS.length}`)
}

phase('Morning')
let fixRel = null
const red = AGENTS.filter((a) => !(tests.find((t) => t.agent.startsWith(a)) || {}).pass)
if (rel && rel.published && red.length) {
  await retry(`${base('fix')}\n\nRole: fixer. Hosts red on the published package ${rel.version}: ${JSON.stringify(tests.filter((t) => !t.pass)).slice(0, 9000)}. Fix each at the root, test-first, node --test tests/v2/ 0 fail, gate --all --quick green, push. Return done, commits, numbers, summary.`, { label: 'rx-fix', phase: 'Morning', schema: RESULT, ...OPH })
  n++
  fixRel = await release(n, 'Re-release with the host fixes above (no failure to fix first).')
  if (fixRel && fixRel.published) {
    const again = (await parallel(red.map((a) => () => verify(a, '-r')))).filter(Boolean)
    tests = tests.filter((t) => !red.some((a) => t.agent.startsWith(a))).concat(again)
  }
}
const sum = await retry(`${base('sum')}\n\nWrite docs/v2/release/NEXT-STATUS.md (plain short sentences): the npm version on next, how to test it (npm i -g context-mode@next; context-mode setup; context-mode doctor), a table per agent (pass, live or doc-verified, bytes off -> v2, problems), what is still open. Inputs: release ${JSON.stringify(rel)}, re-release ${JSON.stringify(fixRel)}, tests ${JSON.stringify(tests.map((t) => ({ a: t.agent, pass: t.pass, live: t.live, off: t.bytesOff, v2: t.bytesV2, p: t.problems.slice(0, 2) }))).slice(0, 8000)}. Check npm view context-mode dist-tags yourself and write what it shows. Commit, push. Return done, commits, numbers, summary.`, { label: 'rx-sum', phase: 'Morning', schema: RESULT, ...SNL })
return { rel, fixRel, tests, sum }
