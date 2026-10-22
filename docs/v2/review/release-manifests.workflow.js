export const meta = {
  name: 'v2-release-manifests',
  description: 'Fix release build manifests found by the install-doc verifiers (pi package.json, gemini/qwen extension manifests, codex/vscode/copilot hook commands, kiro event name), re-stage the rehearsal release branch, re-verify the affected install docs, gate, CI',
  phases: [
    { title: 'Fix', detail: 'build/manifests.ts and adapters, tests first' },
    { title: 'Release', detail: 're-stage rehearsal release branch (no tag, no GitHub Release)' },
    { title: 'Verify', detail: 'copy-paste verify per affected agent, docs fix round' },
    { title: 'Final', detail: 'gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const AFFECTED = ['pi', 'gemini', 'qwen', 'codex', 'vscode', 'copilot-cli', 'kiro', 'opencode']
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  agent: { type: 'string' }, pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, evidence: { type: 'string' } },
  required: ['agent', 'pass', 'problems', 'evidence'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push; push without asking. Never touch main, never push a tag, never create a GitHub Release, never npm publish, never force-push v2-design. The rehearsal branches release and release-staging may be updated only as the Release step says. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Own temp space only: /private/tmp/cm-v2-fu-${id} (clone, temp HOME, temp npm prefix). Never edit the real ~/.config, ~/.codex, ~/.gemini, ~/.pi etc.: run agents with HOME/USERPROFILE/XDG_CONFIG_HOME/npm_config_prefix inside your temp space. Delete your temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. Write no personal names. Pace: be done within 60 minutes.
Owner rule for install docs: every command runs as copied, no user path; see docs/install/README.md.`

phase('Fix')
// First run (wf_2aee70db-76a) spent 7 h on research and wrote nothing. Its verified findings are below;
// the work is split into small sequential tasks (they share build/manifests.ts), each with a hard pace rule.
const PACE = 'Pace (hard rule): the findings below are already verified; do not re-research. Write the failing test within your first 10 tool calls, commit and push it; then the fix; commit and push after each step; be done within 30 minutes. If blocked, commit what you have, write the blocker in one line and return done=false.'
const FIXES = [
  { id: 'kiro', opts: SNM, what: 'Kiro CLI v3 hook docs name the trigger UserPromptSubmit. Change src/adapters/table.ts eventMap UserPromptSubmit from "PromptSubmit" to "UserPromptSubmit"; update e2e/golden/GP1/kiro-hooks-v1-schema.json and tests/v2/build/manifests.test.mjs (~line 125). src/adapters/kiro.ts already decodes both names. DEVIATIONS row.' },
  { id: 'qwen', opts: SNH, what: 'Qwen expands ${extensionPath}, ${CLAUDE_PLUGIN_ROOT}, ${/} in qwen-extension.json; for hooks it reads config.hooks (a path relative to the extension). In hook commands it replaces only ${CLAUDE_PLUGIN_ROOT}. Emit qwen-extension.json with the server at ${extensionPath}${/}server.mjs and "hooks": "hooks/qwen.json"; emit hooks/qwen.json commands as node "${CLAUDE_PLUGIN_ROOT}/hook.mjs" --agent qwen. Test the shapes. DEVIATIONS row.' },
  { id: 'gemini', opts: SNH, what: 'Gemini reads hooks only from <ext>/hooks/hooks.json and expands ${extensionPath} and ${/} in gemini-extension.json and hooks.json. Owner decision 2026-10-22: emit gemini-extension.json with the server at ${extensionPath}${/}server.mjs and hooks/hooks.json in Gemini shape with commands node "${extensionPath}${/}hook.mjs" --agent gemini. Claude Code may also read hooks/hooks.json; claude plugin validate says unknown events are ignored at runtime. Prove it: build release-out, run claude plugin validate and one live claude -p session (claude-sonnet-5-5, effort low, --max-budget-usd 0.25, --plugin-dir release-out, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, a Bash seq 1 3000) and show the Claude hooks still fire (replace seen) and nothing errors. If Claude breaks, stop and report. Test the shapes. DEVIATIONS row.' },
  { id: 'pi', opts: OPH, what: 'Pi (dist/core/package-manager.js resolveExtensionEntries) reads package.json "pi".extensions from the package dir. build/build.mjs assertOutTree() throws on package.json (ADR-0002 GS7) and e2e/golden/GP1/no-package-json-in-out.json expects none. Owner decision 2026-10-22: the out tree may hold ONE package.json with only name, version, private:true, type:"module" and a "pi" key (extensions ["./pi/index.js"], skills) — no dependencies, no scripts, so Pi's npm install on git install does nothing. Amend ADR-0002 GS7 to say exactly that, change assertOutTree to allow only that shape (still throws on dependencies or scripts), replace the golden with one that checks the allowed shape, emit it from build/manifests.ts (pi: ...). Tests first. DEVIATIONS row.' },
  { id: 'templates', opts: SNM, what: 'codex, vscode, copilot-cli have no documented plugin-root variable; the install docs one-line writer already writes absolute commands. Mark the shipped hook files as templates in the docs (docs/install/{codex,vscode,copilot-cli}.md: "the writer fills the path; do not copy hooks/<id>.json by hand") and in impl/10-adapters.md; keep tests/v2/build/manifests.test.mjs and e2e/cases/GP1-absolute-node-path.e2e.mjs consistent. Also claude-code: docs/install/claude-code.md and docs/v2/LAUNCH.md state plainly that the marketplace command works after the owner-only ADR-0011 step b (marketplace.json source -> github ref release on main), with the claude mcp add fallback until then. DEVIATIONS row.' },
]
const fixes = []
for (const f of FIXES) {
  const r = await agent(`${base('rm-' + f.id)}\n\n${PACE}\n\nTask (${f.id}): ${f.what}\nBuild release-out and check the emitted file(s). node --test tests/v2/ and node scripts/gate.mjs --milestone M7 --quick. Commit, push to v2-design. Return done, commits, numbers, summary (before/after, 4 lines).`,
    { label: 'rm-' + f.id, phase: 'Fix', schema: RESULT, ...f.opts })
  fixes.push({ id: f.id, r })
  log(`fix ${f.id}: ${r && r.done ? 'done' : 'NOT done'}`)
}
const fix = { done: fixes.some((x) => x.r && x.r.done), fixes }
if (!fix.done) return { stopped: 'no manifest fix done', fix }

phase('Release')
const rel = await agent(`${base('rm-rel')}\n\nRe-stage the rehearsal release exactly as docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md "Re-run after fixes" did, on the new v2-design head: plan.mjs (must plan 2.0.0 with the rehearsal branch present), build, publish.mjs --stage (tag local only), smoke.mjs --ref release-staging (real claude binary), promote against a local bare clone, then git push --force-with-lease origin <staged-sha>:refs/heads/release --no-follow-tags. Confirm: release has package.json (pi key), gemini-extension.json + hooks/hooks.json, fixed qwen/codex/vscode/copilot/kiro files; no refs/tags/v2*; no GitHub Release; main sha unchanged. Append "Re-run 2 (manifests)" to the rehearsal doc. Commit, push to v2-design. Return done, commits, numbers (release sha, file list), summary.`,
  { label: 'rm-rel', phase: 'Release', schema: RESULT, ...SNM })

phase('Verify')
const verify = (round) => parallel(AFFECTED.map((a) => () => agent(`${base('rm-v' + round + '-' + a)}\n\nRole: adversarial verifier, round ${round}, agent ${a}. Take docs/install/${a}.md from origin/v2-design as a new user. In a clean temp HOME (agent CLI in a temp prefix if it can run here) run every Install block exactly as written against the GitHub release branch, then Verify, Update, Uninstall. Pass only if no block needed an edit, the agent lists/loads context-mode (for pi: the extension handlers load; for gemini/qwen: the extension's server is Connected and hooks are registered), the server answers tools/list with 9 tools, and no user path appears. Things that cannot run here (Windows, GUI-only, login-only live session): list them in problems as "not run: <why>" — those alone do not fail the check. Return pass, problems, evidence.`,
  { label: `rm-v${round}-${a}`, phase: 'Verify', schema: CHECK, ...SNM })))
let checks = (await verify(1)).filter(Boolean)
const hardFail = (c) => !c.pass && c.problems.some((p) => !String(p).startsWith('not run'))
if (checks.some(hardFail)) {
  const bad = checks.filter(hardFail)
  log(`verify r1 failing: ${bad.map((c) => c.agent).join(', ')}`)
  await agent(`${base('rm-fix2')}\n\nRole: fixer. Verifier findings: ${JSON.stringify(bad).slice(0, 8000)}. Fix at the root (release manifests in build/ or the docs/install text), tests first, build, gate --milestone M7 --quick, commit, push. If you changed build output, re-stage the rehearsal release exactly as docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md says (no tag, no GitHub Release, main unchanged).`,
    { label: 'rm-fix2', phase: 'Verify', ...OPH })
  checks = (await verify(2)).filter(Boolean)
}
log(`verify final: ${checks.filter((c) => !hardFail(c)).length}/${checks.length} ok`)

phase('Final')
await agent(`${base('rm-docs')}\n\nUpdate docs/install/README.md table (agent, method, verified yes/no, date, version) and each affected docs/install/<agent>.md Verified table from these results: ${JSON.stringify(checks).slice(0, 8000)}. Say plainly what was not run and why. Run build/check-install-docs.mjs. Commit, push.`,
  { label: 'rm-docs', phase: 'Final', ...SNM })
const g = await agent(`${base('rm-gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs, node build/check-install-docs.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'rm-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await agent(`${base('rm-gatefix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'rm-gatefix', phase: 'Final', ...OPH })
const ci = await agent(`${base('rm-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min; macOS runners may queue — waiting is not a failure). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node, and say plainly if a job is still queued.`,
  { label: 'rm-ci', phase: 'Final', ...SNM })
return { fix, rel, checks: checks.map((c) => ({ agent: c.agent, pass: c.pass, problems: c.problems })), gate: g, ci }
