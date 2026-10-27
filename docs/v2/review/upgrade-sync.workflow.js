export const meta = {
  name: 'v2-upgrade-sync',
  description: 'Does an npm update reach every host without re-running setup? Measure per host (two packed builds, setup once, update, check which build runs); if a host keeps a stale copy, fix on exp/upgrade-sync test-first and merge after npm next is published',
  phases: [
    { title: 'Measure', detail: 'per host, no commits' },
    { title: 'Fix', detail: 'exp/upgrade-sync, merge after next is published' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const M = { type: 'object', properties: {
  agent: { type: 'string' }, staleAfterUpdate: { type: 'boolean' }, copyPath: { type: 'string' },
  evidence: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['agent', 'staleAfterUpdate', 'copyPath', 'evidence', 'problems'] }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode (fresh clone). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never force-push, never tag, never npm publish / dist-tag, never use an npm token.
Own temp space only: /private/tmp/cm-v2-us-${id} (temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.pi etc. Delete the temp space before you return.
Rules: never write instruction files; no regex as a mechanism; tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change.`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error (network). Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'copilot-cli', 'opencode', 'pi', 'vscode', 'kiro', 'zcode']

phase('Measure')
const ms = (await parallel(AGENTS.map((a) => () => retry(`${base('m-' + a)}\n\nRole: measure ${a}, no commits. Branch v2-design. Build twice into two tarballs with different versions (node build/build.mjs --out <dir> --version 2.0.0-next.900 and 2.0.0-next.901; npm pack inside each). In a temp HOME + temp prefix: npm i -g <tarball 900>; context-mode setup --yes --agents ${a}. Then npm i -g <tarball 901> (simulates npm update) and do NOT run setup. Now find which build the host would run: read the host's registered hook command / plugin / extension path (host config file, host list command if the CLI installs without login, the host's documented plugin cache or install dir: web search its docs, quote URL + version) and run the exact registered hook and MCP command; check the version it reports (context-mode --version, the bundle's version constant, or the file's sha vs each tarball). staleAfterUpdate = the host still runs 900. copyPath = where the stale copy lives (empty if none). Return agent, staleAfterUpdate, copyPath, evidence, problems.`,
  { label: `us-m-${a}`, phase: 'Measure', schema: M, ...SNL })))).filter(Boolean)
const stale = ms.filter((m) => m.staleAfterUpdate)
log(`stale after npm update: ${stale.map((m) => m.agent).join(', ') || 'none'}`)

phase('Fix')
let fix = null
if (stale.length) {
  fix = await retry(`${base('fix')}\n\nRole: fixer on branch exp/upgrade-sync (create it from v2-design; push there often). Hosts that keep a stale copy after npm update without setup: ${JSON.stringify(stale).slice(0, 7000)}. All results: ${JSON.stringify(ms.map((m) => ({ a: m.agent, s: m.staleAfterUpdate, p: m.copyPath }))).slice(0, 2000)}.
Goal (owner): setup once, then updates need no manual step. Fix at the root per host, preferring in order: (a) register the host so it runs the npm-installed files directly (no copy), if the host's docs allow it; (b) make the copy refresh itself: the hook/MCP entry checks its own version against the npm-installed package and the host's documented update/reinstall command is run by context-mode, never a hand copy; (c) context-mode upgrade = npm i -g context-mode@<same dist-tag> + refresh every stale host copy, and doctor FAILs with a one-line fix when a host copy's version differs from the installed package. Red tests first. node --test tests/v2/ 0 fail, gate --all --quick green.
Then merge: poll npm view context-mode dist-tags every 5 minutes for up to 5 hours until "next" exists (another job is publishing it; do not publish). When it exists (or after 5 hours), merge exp/upgrade-sync into v2-design with a normal merge (pull --rebase on reject, keep both sides on conflict), run node --test tests/v2/ once, push. Update docs/install/README.md "Updating" section with the plain steps per host. Return done, commits, numbers, summary.`, { label: 'us-fix', phase: 'Fix', schema: RESULT, ...OPH })
}
const doc = await retry(`${base('doc')}\n\nOn v2-design (after the fix, if any, is merged: wait up to 30 min for exp/upgrade-sync to be merged if it exists and is ahead): write docs/v2/release/UPGRADE-CHECK.md (plain short sentences): per host, does npm update reach it without setup, where any copy lives, what the user does to update, sources. Inputs: ${JSON.stringify(ms).slice(0, 8000)}; fix ${JSON.stringify(fix).slice(0, 1500)}. Commit, push (pull --rebase). Return done, commits, numbers, summary.`, { label: 'us-doc', phase: 'Fix', schema: RESULT, ...SNM })
return { ms, fix, doc }
