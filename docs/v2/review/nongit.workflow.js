export const meta = {
  name: 'v2-nongit',
  description: 'Hooks work in a non-git cwd: project key = git common dir, else realpath(cwd); tests first, live proof, on impl/replace-live',
  phases: [
    { title: 'Fix', detail: 'resolve.ts rule + tests' },
    { title: 'Proof', detail: 'live replace in non-git and git cwd' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input.
Repo github.com/mksglu/context-mode. Work on branch impl/replace-live (exists; fetch it, rebase on origin/v2-design first, push early and after each step). Do NOT merge into v2-design (a cleanup is running there). Never touch main, never force-push v2-design, never tag or publish. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com.
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return, after everything is pushed.
Never weaken a test, never truncate or regex-filter output, never change OUTPUT_CAP or HOOK_* budgets. Write no personal names.
Live runs: keyless claude -p, model claude-sonnet-5-5, effort low, --max-budget-usd 0.25, --include-hook-events, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --plugin-dir <built release-out>.`

phase('Fix')
const fix = await agent(`${base('ng-fix')}\n\nProblem: src/core/project/resolve.ts throws NO_GIT_DIR when the cwd is not inside a git repo, so every hook returns empty stdout there and no replace, journal or deny happens (live proof: model saw full 8.9/20/28 KB outputs in a non-git cwd). Owner decision (2026-10-21): one fixed rule, not a runtime fallback path: the project is the git common dir + worktree when a .git is found walking up; otherwise the project is realpath(cwd) with worktree = realpath(cwd). CLAUDE_PROJECT_DIR and the agent's own project env keep their current priority. The home dir and filesystem root as cwd: still a project (keyed by realpath) — check ADR-0005/impl/02 §2 for any rule that forbids it, follow the doc if it does and say so.
Use git archaeology on v1 (main: src/session/db.ts, project-dir util) to keep v1's non-git behaviour where it matches.
Tests first in tests/v2/project/ (non-git dir, nested non-git dir, git dir unchanged, linked worktree unchanged), plus a hook test: PostToolUse Bash large output in a non-git cwd returns the Bash replace shape. Implement. Build, node --test tests/v2/, node scripts/gate.mjs --milestone M7 --quick. DEVIATIONS.md row D-M7-NG-1 and a line in docs/v2/impl/02 §2 (or the doc that owns project resolution). Push. Return done, commits, numbers (test counts), summary.`,
  { label: 'ng-fix', phase: 'Fix', schema: RESULT, ...OPH })

phase('Proof')
const proof = await agent(`${base('ng-proof')}\n\nIndependent check of impl/replace-live (do not change src/). Claimed fix: ${JSON.stringify(fix).slice(0, 1200)}. Build. Run Bash outputs of 8 KB and 20 KB, 2 runs each, in (a) a non-git temp dir and (b) a git temp dir. Report tool_result bytes the model saw vs full, and answer correctness. Then node bench/saving-score.mjs on the branch (lock must match): M1, M2, guards. Append "Replace live proof, non-git cwd" to docs/v2/benchmarks.md. Push. Return done, commits, numbers, summary.`,
  { label: 'ng-proof', phase: 'Proof', schema: RESULT, ...SNM })
return { fix, proof }
