export const meta = {
  name: 'v2-project-source',
  description: 'Hook never drops silently when no project is found: fixed project-source order per agent, one stderr line on failure; tests first, verify, merge',
  phases: [
    { title: 'Fix', detail: 'branch impl/project-source' },
    { title: 'Verify', detail: 'independent check, merge, gate, CI' },
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
Repo github.com/mksglu/context-mode, base branch v2-design. The owner approved commit + push; push without asking. Never touch main, never push a tag, never create a GitHub Release, never npm publish/deprecate, never force-push v2-design. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Another workflow (compaction push-recall, branch impl/compact-push) changes src/core/hooks/dispatch.ts: keep your edit there to the few lines named below so its merge stays easy.
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return, after the push. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. DEVIATIONS.md row for each behaviour change. Use git archaeology before changing old code. Write no personal names.`

phase('Fix')
const fix = await agent(`${base('ps-fix')}\n\nProblem: src/core/hooks/dispatch.ts handleHook step 3 catches any resolveProject error and returns allow with no log line. src/core/project/resolve.ts throws NO_PROJECT when the agent's project source yields no dir (line ~146). Live finding: a Claude Code payload with a cwd field but no CLAUDE_PROJECT_DIR in env gives empty output and no log, even though cwd is a documented, always-present Claude Code hook input field (code.claude.com/docs/en/hooks, common input fields).
Owner decision 2026-10-21 (no runtime fallback path, one fixed order per agent, ADR-0001):
1. Each adapter row has one fixed project-source order. Claude Code: CLAUDE_PROJECT_DIR, then the payload cwd, then process.cwd(). For every other agent read impl/02 §2 and the adapter table, write the order down, and add the payload cwd where that agent's hook input documents one. Then the non-git rule (D-M7-NG-1) applies to the chosen dir as today.
2. handleHook step 3: when resolveProject still throws, write exactly one stderr line "hooks: no project: <error code> <detail>" (same style as the decode line) and keep the allow answer. No silent drop anywhere in handleHook: check every return path.
3. Docs: impl/02 §2 project-source table, DEVIATIONS row D-FU-PS-1.
Work on branch impl/project-source from origin/v2-design (push early). Tests first: Claude Code payload with cwd and no CLAUDE_PROJECT_DIR in a non-git dir -> replace for a large Bash output; same in a git dir -> replace; no cwd, no env -> process.cwd() is used; a dir that does not exist -> allow plus one stderr line with NO_GIT_DIR; per-agent order table test. Build, node --test tests/v2/, node scripts/gate.mjs --milestone M7 --quick. Push the branch. Return done, commits, numbers (tests), summary with the per-agent order table.`,
  { label: 'ps-fix', phase: 'Fix', schema: RESULT, ...OPH })

phase('Verify')
const chk = await agent(`${base('ps-check')}\n\nIndependent check of branch impl/project-source (do not change src/). Claimed: ${JSON.stringify(fix).slice(0, 1500)}. Build it. With env holding only PATH and HOME (no CLAUDE_PROJECT_DIR), pipe hand-written PostToolUse Bash payloads (documented fields only, 12 KB stdout) into release-out/hook.mjs --agent claude-code: (a) cwd = a non-git temp dir, (b) cwd = a git temp dir, (c) no cwd field, run from a temp dir, (d) cwd = a dir that does not exist. Report stdout bytes, the replace shape, and stderr for each. (a)-(c) must replace; (d) must give allow plus one stderr line. Also run one live claude -p session (sonnet-5-5, effort low, --max-budget-usd 0.25, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --plugin-dir release-out) in a non-git dir with seq 1 3000 and report the bytes the model saw. Return done (true only if all hold), commits (none), numbers, summary.`,
  { label: 'ps-check', phase: 'Verify', schema: RESULT, ...SNM })
if (fix && fix.done && chk && chk.done) {
  await agent(`${base('ps-merge')}\n\nRole: merger. Merge origin/impl/project-source into v2-design (no-ff); resolve conflicts keeping both intents. Build, node --test tests/v2/, gate --milestone M7 --quick; push only if green; verify git merge-base --is-ancestor. Report 3 lines.`,
    { label: 'ps-merge', phase: 'Verify', ...SNM })
} else log('project-source: not merged (fix or check not done)')
const g = await agent(`${base('ps-gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'ps-gate', phase: 'Verify', schema: GATE, ...SNL })
if (g && !g.green) await agent(`${base('ps-gatefix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'ps-gatefix', phase: 'Verify', ...OPH })
const ci = await agent(`${base('ps-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 45 min). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'ps-ci', phase: 'Verify', ...SNM })
return { fix, check: chk, gate: g, ci }
