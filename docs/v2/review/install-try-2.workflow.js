export const meta = {
  name: 'v2-install-try-2',
  description: 'Re-run the new-user install test per agent with the real user package (npm pack of the release tree, not the repo root); fix findings; CI',
  phases: [
    { title: 'Try', detail: 'new-user agents install from the docs only' },
    { title: 'Final', detail: 'fix findings, CI' },
  ],
}

const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const TRY = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, commandsRun: { type: 'array', items: { type: 'string' } },
  problems: { type: 'array', items: { type: 'string' } } }, required: ['agent', 'pass', 'commandsRun', 'problems'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-it-${id} (clone with --depth 1, temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.codex, ~/.vscode, ~/.config etc. Delete the temp space before you return.`

const AGENTS = ['claude-code', 'codex', 'gemini', 'qwen', 'opencode', 'pi', 'copilot-cli', 'vscode', 'kiro', 'zcode']

phase('Try')
const tries = (await parallel(AGENTS.map((a) => () => agent(`${base('try-' + a)}\n\nRole: a new user who has never seen context-mode. Make the user package exactly as release does: clone, npm install --no-package-lock, node build/build.mjs (full build, it writes the release tree), then npm pack INSIDE the release tree (release-out, NOT the repo root: the repo root is the dev package and has no bin). Install that tarball globally into a temp npm prefix with a temp HOME and put the prefix bin on PATH. This stands in for npm i -g context-mode@next (the @next tag is not on npm yet: that 404 is expected, do not report it). Install the ${a} agent CLI into the temp prefix if it installs without a login; else create the config dir it uses.
Read ONLY docs/install/README.md and docs/install/${a}.md (no source code). Do exactly what they say, copy-pasting the commands (add --yes if setup asks for it without a TTY, and say whether the page tells you that). Then follow the "by hand" line on a second clean HOME (apply what setup --print ${a} prints). Then context-mode doctor. Pass only if both paths end with doctor green for ${a} and you never had to guess, type a path, or edit JSON beyond pasting what --print gave. List every confusing sentence, failed command, command over 100 chars, and anything missing. Do not commit. Return agent, pass, commandsRun, problems.`,
  { label: `try2-${a}`, phase: 'Try', schema: TRY, ...HKM })))).filter(Boolean)
const bad = tries.filter((t) => !t.pass || t.problems.length)
log(`new-user tries: ${tries.length - bad.length}/${tries.length} clean`)

phase('Final')
let fix = null
if (bad.length) {
  fix = await agent(`${base('fix')}\n\nCommit + push allowed (git pull --rebase on reject, max 5; another workflow edits docs now, keep both sides on conflict). Tests first for code; never weaken an assertion; DEVIATIONS row per behaviour change; check-install-docs rules stay.\nNew-user test findings: ${JSON.stringify(bad).slice(0, 9000)}. Fix each real one at the root (docs or CLI), skip ones that are about the unpublished @next tag. Re-run build/check-install-docs.mjs, node --test tests/v2/, and re-verify each failed agent the same way (release-out tarball, clean temp HOME, both paths, doctor). Commit, push. Return done, commits, numbers (agents pass before/after), summary.`, { label: 'it-fix', phase: 'Final', schema: RESULT, ...SNH })
}
const ci = await agent(`${base('ci')}\n\nCommit + push allowed. Role: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'it-ci', phase: 'Final', ...SNH })
return { tries, fix, ci }
