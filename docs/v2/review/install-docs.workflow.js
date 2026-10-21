export const meta = {
  name: 'v2-install-docs',
  description: 'Install docs with copy-paste commands only (no user paths): per-agent research + real install in a temp HOME, one writer, adversarial copy-paste verify, CI rule, gate, CI',
  phases: [
    { title: 'Research', detail: 'one agent per coding agent: method + real verify' },
    { title: 'Write', detail: 'one writer for all docs/install files' },
    { title: 'Verify', detail: 'copy-paste each doc in a clean HOME, fix rounds' },
    { title: 'Final', detail: 'CI rule, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const AGENTS = ['codex', 'opencode', 'gemini', 'qwen', 'kiro', 'vscode', 'zcode', 'copilot-cli', 'pi', 'claude-code']

const METHOD = { type: 'object', properties: {
  agent: { type: 'string' }, method: { type: 'string' },
  commands: { type: 'array', items: { type: 'object', properties: { os: { type: 'string' }, text: { type: 'string' } }, required: ['os', 'text'] } },
  configSnippet: { type: 'string' }, update: { type: 'string' }, uninstall: { type: 'string' },
  sources: { type: 'array', items: { type: 'string' } }, verified: { type: 'boolean' }, evidence: { type: 'string' } },
  required: ['agent', 'method', 'commands', 'configSnippet', 'update', 'uninstall', 'sources', 'verified', 'evidence'] }
const CHECK = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, evidence: { type: 'string' } },
  required: ['agent', 'pass', 'problems', 'evidence'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const RULE = `Owner rule (2026-10-21): every command and config block in docs/install/*.md must run as copied, with no edit. No user-specific path (no /Users/you, C:\\Users\\you, <...>, "change this part"). Order of preference per agent:
1. the agent's own plugin / extension / marketplace install from github.com/mksglu/context-mode (ref release);
2. the agent's own CLI add command (e.g. "codex mcp add ... -- node \\"$HOME/.context-mode-app/server.mjs\\" ..."), where the user's shell expands $HOME / %USERPROFILE%;
3. a config file value that uses a variable the agent itself documents and expands (e.g. an env or home variable in that agent's config syntax) — only if found in the agent's official docs or source AND proven by a real run;
4. if none works: a one-line shell command that writes the config entry with the real path (macOS/Linux sh and Windows PowerShell), proven by a real run. Never a hand-edit step.
Files come from: git clone --depth 1 --branch release https://github.com/mksglu/context-mode.git ~/.context-mode-app (Windows %USERPROFILE%\\.context-mode-app); update: git -C <that path> pull. The release branch exists on GitHub now (rehearsal build); use it.`

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Never touch main, never push a tag, never create a GitHub Release, never npm publish, never force-push. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Own temp space only: /private/tmp/cm-v2-fu-${id} (clone, temp HOME, temp npm prefix). Never install anything globally and never edit the real ~/.config, ~/.codex, ~/.gemini etc.: always run agents with HOME (and USERPROFILE, XDG_CONFIG_HOME, npm_config_prefix) pointing inside your temp space. You may install an agent CLI into that temp prefix to test it (npm i --prefix, or its documented installer with a custom dir). Delete your temp space before you return. Write no personal names.
Pace: be done within 45 minutes.`

phase('Research')
const research = await parallel(AGENTS.map((a) => () => agent(`${base('id-r-' + a)}\n\n${RULE}\n\nAgent: ${a}. Read docs/install/${a}.md and docs/v2/impl/10-adapters.md (row ${a}) on origin/v2-design for the entry files (server.mjs, hook.mjs, per-agent manifests/hooks in the release branch). Find the agent's official install docs (web search/fetch; cite URLs) for MCP servers, hooks and plugins/extensions, and its config variable expansion rules. Pick the highest method in the rule's order that works. PROVE it: install the agent CLI in your temp prefix if possible, clone the release branch into the temp HOME, run the exact commands as a user would, then show the agent lists context-mode (its own mcp list/status command) and that node <path>/server.mjs --agent ${a} answers MCP initialize + tools/list (9 tools). If the agent's hooks need registration, prove the hook command is found. If the agent CLI cannot run here (GUI only, no Linux/macOS build), say so in evidence and set verified false. Return method, commands per OS (macos-linux, windows), configSnippet (only if the method needs one; it must contain no user path), update, uninstall, sources, verified, evidence (versions, outputs).`,
  { label: `id-r-${a}`, phase: 'Research', schema: METHOD, ...SNH })))
const methods = research.filter(Boolean)
log(`research: ${methods.map((m) => `${m.agent}=${m.method.slice(0, 30)}${m.verified ? ' ✓' : ' ✗'}`).join(', ')}`)

phase('Write')
const write = async (round, problems) => agent(`${base('id-w-' + round)}\n\n${RULE}\n\nRole: docs writer, round ${round}. Clone v2-design. Rewrite docs/install/README.md (shared "Get the files" + update + a table: agent, method, verified yes/no with date and version) and every docs/install/<agent>.md from these proven methods: ${JSON.stringify(methods).slice(0, 24000)}.
${problems ? 'Fix these verifier findings: ' + JSON.stringify(problems).slice(0, 6000) : ''}
Each doc: Install (copy-paste blocks, macOS/Linux and Windows), Verify (/ctx-doctor or the agent's list command), Update, Uninstall, Verified table (command, agent version, date, result). Where verified is false, say plainly what was not run and why; still no user path. Keep docs short and plain. Do not edit README.md at the repo root except its install table links if they break.
Extend build/check-install-docs.mjs: fail on any fenced block line holding /Users/you, /home/you, C:\\Users\\you, Users\\\\you, <...> placeholders, "npx context-mode", or a path to .context-mode-app that is not written with $HOME, ~ in a shell command, %USERPROFILE%, $env:USERPROFILE, or a documented agent variable. Test it (a bad sample fails, the real docs pass). Run node scripts/gate.mjs --milestone M7 --quick. Commit, push. Return 5 lines.`,
  { label: `id-w-${round}`, phase: 'Write', ...OPH })
await write(1, null)

phase('Verify')
const verify = (round) => parallel(AGENTS.map((a) => () => agent(`${base('id-v-' + round + '-' + a)}\n\n${RULE}\n\nRole: adversarial verifier, round ${round}. Take docs/install/${a}.md from origin/v2-design as a new user would. In a clean temp HOME (agent CLI installed in a temp prefix if it can run here), copy and run every Install block exactly as written, character for character, with no edit. Then run the doc's Verify step. Pass only if: no block needed an edit; the agent lists context-mode; server answers tools/list with 9 tools; Update and Uninstall blocks also run as written; no user-specific path appears anywhere. If the agent cannot run here, run the shell parts and check the config file the commands wrote is valid for that agent per its official docs (cite). Return pass, problems (each: block, what failed, exact error), evidence.`,
  { label: `id-v${round}-${a}`, phase: 'Verify', schema: CHECK, ...SNM })))
let checks = (await verify(1)).filter(Boolean)
for (let r = 2; r <= 3 && checks.some((c) => !c.pass); r++) {
  const bad = checks.filter((c) => !c.pass)
  log(`verify round ${r - 1}: ${bad.length} failing (${bad.map((c) => c.agent).join(', ')})`)
  await write(r, bad)
  checks = (await verify(r)).filter(Boolean)
}
log(`verify final: ${checks.filter((c) => c.pass).length}/${checks.length} pass`)

phase('Final')
const g = await agent(`${base('id-gate')}\n\nRole: gate. Fresh clone of v2-design, npm install --no-package-lock, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs, node build/check-install-docs.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'id-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await agent(`${base('id-gatefix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'id-gatefix', phase: 'Final', ...OPH })
const ci = await agent(`${base('id-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 45 min). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'id-ci', phase: 'Final', ...SNM })
return { methods: methods.map((m) => ({ agent: m.agent, method: m.method, verified: m.verified })), checks: checks.map((c) => ({ agent: c.agent, pass: c.pass, problems: c.problems })), gate: g, ci }
