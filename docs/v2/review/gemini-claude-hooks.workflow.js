export const meta = {
  name: 'v2-gemini-claude-hooks',
  description: 'hooks/hooks.json serves Gemini but Claude Code also loads it and its SessionStart errors (bad substitution); fix so both work, prove live in both, re-stage rehearsal release, gate, CI',
  phases: [
    { title: 'Fix', detail: 'one fix, live proof in Claude Code and Gemini' },
    { title: 'Final', detail: 'release re-stage, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push; push without asking. Never touch main, never push a tag, never create a GitHub Release, never npm publish, never force-push v2-design. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Own temp space only: /private/tmp/cm-v2-fu-${id} (clone, temp HOME, temp npm prefix). Never edit the real ~/.claude, ~/.gemini: run agents with HOME/XDG_CONFIG_HOME/npm_config_prefix inside your temp space (copy only the login credential the agent needs, the way bench/live does for Claude Code). Delete your temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. Write no personal names.
Pace (hard rule): failing test within 10 tool calls, commit+push it; commit+push after each step; done within 45 minutes; if blocked, commit what you have and return done=false with the blocker in one line.`

phase('Fix')
const fix = await agent(`${base('gch-fix')}\n\nProblem (measured live, commit 8d11ff6b D-FU-RM-GEMINI-1): release-out/hooks/hooks.json is Gemini's hook file (Gemini reads hooks only from <ext>/hooks/hooks.json and expands \${extensionPath} and \${/}). Claude Code ALSO loads <plugin>/hooks/hooks.json by default, in addition to plugin.json "hooks": "./hooks/claude-code.json". It ignores Gemini-only events (BeforeTool, AfterTool, BeforeAgent, PreCompress) but runs the SessionStart entry through /bin/sh, which fails: "/bin/sh: \${extensionPath}\${/}hook.mjs: bad substitution", exit 1, outcome error, every session.
Pick the first option that you PROVE live in both agents:
(a) Check Claude Code's plugin docs (code.claude.com/docs/en/plugins-reference) and the 2.1.303 binary for a way to stop the default hooks/hooks.json load (e.g. a plugin.json field). If one exists and works, use it.
(b) Otherwise remove SessionStart from the Gemini hooks/hooks.json only if Gemini keeps working without it (Gemini still gets BeforeAgent, which can carry the session-start work: check src/adapters/gemini.ts and move it there if needed, tests first); Claude Code then sees only events it ignores.
(c) Never use a shell trick that depends on short-circuit expansion.
Proof required:
- Claude Code: build release-out; claude plugin validate release-out; one live claude -p (claude-sonnet-5-5, effort low, --max-budget-usd 0.25, --plugin-dir release-out, --include-hook-events --output-format stream-json --verbose, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, Bash seq 1 3000): no hook event with outcome error; the Bash replace is seen (bytes far below 13,893).
- Gemini: gemini extensions install from a local copy of release-out in a temp HOME (or link), then gemini extensions list shows it enabled and its hooks registered; run the hook command Gemini would run with a sample BeforeTool payload. A live gemini session only if a login is available; else say "not run: login".
Add a GP1/unit test that fails if any hooks/hooks.json entry would run under Claude Code with a \${extensionPath} or \${/} token. Build, node --test tests/v2/, gate --milestone M7 --quick. Update docs/install/gemini.md if behaviour changed. Commit, push. Return done (true only with the Claude live proof), commits, numbers, summary.`,
  { label: 'gch-fix', phase: 'Fix', schema: RESULT, ...OPH })
if (!fix || !fix.done) return { stopped: 'fix not proven', fix }

phase('Final')
const rel = await agent(`${base('gch-rel')}\n\nRe-stage the rehearsal release exactly as docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md "Re-run after fixes" did, on the new v2-design head (plan, build, publish --stage with tag local only, smoke --ref release-staging, promote on a local bare clone, git push --force-with-lease origin <staged-sha>:refs/heads/release --no-follow-tags). Confirm: no refs/tags/v2*, no GitHub Release, main unchanged. Append "Re-run 4 (gemini hooks.json vs Claude Code)" to the rehearsal doc. Commit, push. Return done, commits, numbers, summary.`,
  { label: 'gch-rel', phase: 'Final', schema: RESULT, ...SNM })
const g = await agent(`${base('gch-gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs, node build/check-install-docs.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'gch-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await agent(`${base('gch-gatefix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'gch-gatefix', phase: 'Final', ...OPH })
const ci = await agent(`${base('gch-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min; queued macOS runners are not a failure). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'gch-ci', phase: 'Final', ...SNM })
return { fix, rel, gate: g, ci }
