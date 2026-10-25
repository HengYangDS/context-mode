export const meta = {
  name: 'v2-install-simple',
  description: 'Make install docs simple: setup --print <agent> prints the exact manual command/config with absolute paths; every install page = one command + one manual line; CI rule bans node -e, npm root -g and long commands in docs; fresh-eyes new-user test per agent; gate, CI',
  phases: [
    { title: 'Build', detail: 'setup --print, docs rewrite, docs rule' },
    { title: 'Try', detail: 'new-user agents install from the docs only' },
    { title: 'Final', detail: 'fix findings, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const TRY = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, commandsRun: { type: 'array', items: { type: 'string' } },
  problems: { type: 'array', items: { type: 'string' } } }, required: ['agent', 'pass', 'commandsRun', 'problems'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-is-${id} (clone, temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.vscode, ~/.config etc. Delete the temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Rules: tests first (red commit before green); never weaken an assertion; follow ADR-0019 section 8 (clig.dev); setup never writes instruction files; DEVIATIONS.md row per behaviour change; docs in plain short sentences; no personal names or secrets.
Pace: commit + push within your first 12 tool calls; push after each step.`

const BUILD = `${base('build')}\n\nOwner (2026-10-25): install commands are too long. Examples in today's docs: claude mcp add -s user context-mode -- node "$(npm root -g)/context-mode/server.mjs" --agent claude-code, and for VS Code a one-line node -e script that edits ~/.vscode/mcp.json. Users must never type paths, JSON or scripts.
Do (180 minutes):
1. CLI: context-mode setup --print <agent> prints, for that agent, the exact manual step with absolute paths already filled in (the agent's own CLI command if it has one, e.g. the full claude mcp add line; else the config file path and the JSON block to paste), and writes nothing. --json gives a machine form. Built from the same registry row setup uses (one source of truth, no second copy). Golden test per agent (red first), --help example, docs/v2 CLI-REPORT row.
2. Rewrite every install page (docs/install/README.md and every docs/install/<agent>.md, README.md install section, any other doc with install commands): the user path is exactly
   npm i -g context-mode@next
   context-mode setup
   Per-agent page: "context-mode setup --agents <id>" as the one command; then one line "Prefer to do it by hand? Run context-mode setup --print <id> and follow what it prints."; then what setup changes (one short list), verify (context-mode doctor), remove (context-mode setup --remove --agents <id>), known limits. Delete every node -e script, every $(npm root -g), every hand-built JSON with paths. Keep git-based install steps only where the agent itself installs from git (Claude Code marketplace, Gemini/Qwen extension), as one command each.
3. build/check-install-docs.mjs gets new rules with tests (red first): a docs code block must not contain node -e, npm root -g, $(...) or a path under a home dir; every shell command line <= 100 chars; every page has the two-command path or setup --agents. Run it on all docs.
4. Verify in a clean temp HOME with the npm-packed build: for each agent whose CLI installs in the temp prefix, run exactly the page's command, then doctor; for every agent run setup --print and check its output works when applied by hand (apply it, then doctor).
Return done, commits, numbers (pages changed, longest command before/after, agents verified), summary.`

phase('Build')
let b = await agent(BUILD, { label: 'is-build', phase: 'Build', schema: RESULT, ...OPH })
if (!b || b.done === false) b = await agent(`${BUILD}\n\nA previous attempt reported: ${JSON.stringify(b).slice(0, 1500)}. Continue from the pushed state.`, { label: 'is-build-retry', phase: 'Build', schema: RESULT, ...SNH })

phase('Try')
const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'opencode', 'pi', 'copilot-cli', 'vscode', 'kiro', 'zcode']
const tries = (await parallel(AGENTS.map((a) => () => agent(`${base('try-' + a)}\n\nRole: a new user who has never seen context-mode. Fresh clone of v2-design, build, npm pack, install the tarball globally into a temp npm prefix with a temp HOME (this stands in for npm i -g context-mode@next; say so). Install the ${a} agent CLI into the temp prefix if it can be installed without a login; else create the config dir it uses.
Read ONLY docs/install/README.md and docs/install/${a}.md (no source code). Do exactly what they say, copy-pasting the commands. Then follow the "by hand" line on a second clean HOME. Then context-mode doctor. Report pass only if both paths end with doctor green for ${a} and you never had to guess, type a path, or edit JSON yourself. List every confusing sentence, every command that failed or was longer than 100 chars, and anything missing. Do not commit. Return agent, pass, commandsRun, problems.`,
  { label: `try-${a}`, phase: 'Try', schema: TRY, ...HKM })))).filter(Boolean)
const bad = tries.filter((t) => !t.pass || t.problems.length)
log(`new-user tries: ${tries.length - bad.length}/${tries.length} clean`)

phase('Final')
let fix = null
if (bad.length) {
  fix = await agent(`${base('fix')}\n\nNew-user test findings: ${JSON.stringify(bad).slice(0, 8000)}. Fix each at the root (docs or CLI; tests first for code), re-run check-install-docs, and re-verify the failed agents in a clean temp HOME the same way. Commit, push. Return done, commits, numbers, summary.`, { label: 'is-fix', phase: 'Final', schema: RESULT, ...SNH })
}
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-readme.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'is-gate', phase: 'Final', schema: GATE, ...HKM })
if (g && !g.green) await agent(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, { label: 'is-gatefix', phase: 'Final', ...OPH })
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'is-ci', phase: 'Final', ...SNH })
return { build: b, tries, fix, gate: g, ci }
