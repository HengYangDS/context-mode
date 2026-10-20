export const meta = {
  name: 'v2-replace-live',
  description: 'Root-cause why the main-agent Bash replace never reaches the model live (0/12 sessions), fix on a branch, prove live, re-score',
  phases: [
    { title: 'Diagnose', detail: 'hook log, fix on impl/replace-live, live proof' },
    { title: 'Verify', detail: 'independent live proof + frozen score on the branch' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input.
Repo github.com/mksglu/context-mode. Work on branch impl/replace-live (create from origin/v2-design if missing; push early and after each step). Do NOT merge into v2-design: another workflow is cleaning v1 files on v2-design right now. Never touch main, never force-push v2-design, never tag or publish. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com.
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return, after everything is pushed.
Never weaken a test, never truncate or regex-filter output (BM25 selection only), never change OUTPUT_CAP or HOOK_* budgets. Record every behaviour change as a DEVIATIONS.md row. Write no personal names.
Live runs: keyless claude -p (Claude Code 2.1.303), model claude-sonnet-5-5, effort low, --max-budget-usd 0.25, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --plugin-dir <built release-out>.`

phase('Diagnose')
const fix = await agent(`${base('rl-fix')}\n\nProblem: live proof (docs/v2/benchmarks.md "Replace live proof (after r1 shape fix)") shows that for Bash outputs of 8.9, 20 and 28 KB the model saw the full output in 6/6 sessions; stream-json showed only SessionStart hook events. Offline replay of the same payload through release-out/hook.mjs gives a correct updatedToolOutput. So either PostToolUse does not fire for the plugin, fires with a payload our decoder rejects, or Claude Code drops our output.
Method, in order:
1. Build release-out. Check release-out hooks registration (hooks.json / plugin.json): is PostToolUse registered, with which matcher, command and timeout? Compare with Claude Code docs (code.claude.com/docs/en/hooks) and with v1 on main, whose PostToolUse hook fires live.
2. Capture what really happens: wrap the hook command (temporary, in your clone only) so it appends stdin, stdout, exit code and wall time to a log file for every event; run one live session with seq 1 3000 (about 14 KB). Also run claude with --debug if it shows hook execution.
3. From the log find the root cause: not registered, matcher mismatch, timeout, crash, decode error, wrong output shape, or Claude Code ignoring updatedToolOutput for this event. If Claude Code ignores it, read its binary/docs for the exact accepted field and shape (the r1 fix found "does not match Bash's output shape").
4. Fix the root cause with a test first (golden from the captured real payload). Rebuild, rerun the live session: the tool_result the model sees must be the replaced text (bytes far below the full output) for 8 KB, 20 KB and 28 KB, 2 runs each. Report those bytes.
Push impl/replace-live. Return done (true only if live replace is proven), commits, numbers (per size: full bytes, seen bytes), summary (root cause in one line).`,
  { label: 'rl-fix', phase: 'Diagnose', schema: RESULT, ...OPH })

phase('Verify')
const proof = await agent(`${base('rl-proof')}\n\nIndependent check of branch impl/replace-live (do not change src/). Fix claimed: ${JSON.stringify(fix).slice(0, 1500)}. Build it, run Bash outputs of 8 KB, 20 KB, 28 KB, 2 runs each, and report from stream-json the tool_result bytes the model saw vs full output, and whether the task answer was still correct. Then run node bench/saving-score.mjs on the branch (score files must match bench/saving-score.lock) and report M1, M2, guards. Append "Replace live proof (impl/replace-live)" to docs/v2/benchmarks.md on the branch. Push. Return done, commits, numbers, summary.`,
  { label: 'rl-proof', phase: 'Verify', schema: RESULT, ...SNM })
return { fix, proof }
