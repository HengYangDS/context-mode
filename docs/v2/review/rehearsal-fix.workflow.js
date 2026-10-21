export const meta = {
  name: 'v2-rehearsal-fix',
  description: 'Fix release-rehearsal findings: check-removed allowlist, plan.mjs with a rehearsal release branch, smoke real claude binary, lenient hook decode; gate, CI, re-rehearse',
  phases: [
    { title: 'Fix', detail: '3 fixers on disjoint files' },
    { title: 'Verify', detail: 'gate 3x, CI, re-rehearsal' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push; push without asking. Never touch main, never push a tag, never create a GitHub Release, never npm publish/deprecate, never force-push v2-design. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5). Another workflow (compaction push-recall, M2) changes src/core/hooks/dispatch.ts, src/core/contracts/constants.ts, README.md and docs/benchmarks/ right now: do not edit those files.
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return, after the push. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. DEVIATIONS.md row for each behaviour change. Use git archaeology before changing old code. Write no personal names.
Source: docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md (rehearsal findings).`

phase('Fix')
const TASKS = [
  { id: 'rf-removed', opts: SNM, prompt: `Finding: gate check-removed fails on docs/benchmarks/ (the owner's benchmark publish pack, intended to stay). Add docs/benchmarks/ to the allowed tree in build/check-removed.mjs and to the target tree in the doc that defines it (ADR-0015 / TECH-SPEC folder structure), with a test that a file there passes and a stray root file still fails. Run node scripts/gate.mjs --milestone M7 --quick. Commit, push to v2-design.` },
  { id: 'rf-release', opts: SNH, prompt: `Findings: (1) a pre-existing release branch (the rehearsal) makes scripts/release/plan.mjs fail with "no releasable commits", so the real first release would need a manual delete. (2) smoke.mjs failed when the claude on PATH is a shim script, not the real binary. (3) release.yml can only be dispatched from main.
Fix (1) in plan.mjs: the last release is the newest annotated v* tag on origin reachable from the release branch, not the branch's last commit; a release/release-staging commit with no pushed tag is a rehearsal and is replaced (stage already pushes release-staging with --force-with-lease; promote must accept a release branch that holds only untagged rehearsal commits, still refusing to drop any tagged release). Tests with a local bare remote: no release branch -> 2.0.0; rehearsal branch without tag -> 2.0.0 and promote replaces it; tagged v2.0.0 + new commits -> next version; tagged release not an ancestor -> refuse.
Fix (2) in smoke.mjs: resolve the real claude binary the way bench/live/run.mjs realClaude() does (Mach-O/ELF magic), and fail with a clear message if none.
For (3): do not touch main. Write the exact owner step in docs/v2/LAUNCH.md (release.yml must land on main with the v2 merge; until then run the same scripts locally as in the rehearsal) and replace the rehearsal's "delete release release-staging first" note with the new behaviour.
Run node --test for the release script tests and gate --milestone M7 --quick. Commit, push to v2-design.` },
  { id: 'rf-decode', opts: OPH, prompt: `Finding: hand-written Claude Code PostToolUse payloads produced no output from the hook; only the captured real 2.1.303 payload (e2e/fixtures/claude-code/2.1.303/PostToolUse-Bash-large.json) triggered the replace. Find exactly which field the decoder required (src/adapters/claude-code.ts decode, src/entries/hook.ts, src/core/project/resolve.ts inputs): run the hook with the real payload, then remove one field at a time and record which removal makes the output empty. Compare with the Claude Code hooks docs (code.claude.com/docs/en/hooks: the documented PostToolUse input fields) and with older captured fixtures in e2e/fixtures/claude-code/.
Rule: every field the docs list as always present may be required; any other field must have a defined default (e.g. tool_use_id missing -> label from a hash of the command and turn; cwd missing -> CLAUDE_PROJECT_DIR or process.cwd()). A payload that is missing a required field must make the hook exit 0 with empty stdout AND write one line to the debug log naming the missing field (no silent drop). Work on branch impl/decode-lenient from origin/v2-design (push early); do not merge it. Tests first: one golden per dropped optional field (still replaces) and one per required field (empty output + debug line). Build, node --test tests/v2/, gate --milestone M7 --quick. Push the branch. Return the field table (field, required?, before, after).` },
]
const fixes = await parallel(TASKS.map((t) => () =>
  agent(`${base(t.id)}\n\n${t.prompt}\n\nReturn: done, commits, numbers, summary (at most 6 lines).`, { label: t.id, phase: 'Fix', schema: RESULT, ...t.opts })))
TASKS.forEach((t, i) => log(`${t.id}: ${fixes[i] ? (fixes[i].done ? 'done' : 'NOT done') + ' | ' + fixes[i].numbers.slice(0, 160) : 'no result'}`))

phase('Verify')
const dec = fixes[2]
if (dec && dec.done) await agent(`${base('rf-merge')}\n\nRole: merger. Merge origin/impl/decode-lenient into v2-design (no-ff); resolve conflicts keeping both intents (the compaction workflow may have changed nearby code). Build, node --test tests/v2/, gate --milestone M7 --quick; push only if green; verify git merge-base --is-ancestor. Report 3 lines.`,
  { label: 'rf-merge', phase: 'Verify', ...SNM })
const gate = (label) => agent(`${base(label)}\n\nRole: gate. Fresh clone, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs. Do not fix. Return green, failing, summary.`,
  { label, phase: 'Verify', schema: GATE, ...SNL })
let g = await gate('rf-gate-1')
if (g && !g.green) {
  await agent(`${base('rf-fix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause (you may edit any file needed for this), run gate --all once, commit, push.`, { label: 'rf-fix', phase: 'Verify', ...OPH })
  g = await gate('rf-gate-2')
}
const rehearse = await agent(`${base('rf-rehearse')}\n\nTask: re-run the release rehearsal on the fixed v2-design, the same way as docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md, WITHOUT deleting the existing release/release-staging branches first: plan.mjs must now plan 2.0.0 with the rehearsal branch present; build; publish.mjs --stage (tag stays local); smoke.mjs --ref release-staging with the real claude binary resolved automatically (do not reorder PATH); promote against a local bare clone; then update GitHub release to the new staged commit with git push --force-with-lease origin <sha>:refs/heads/release --no-follow-tags (rehearsal branch only). Install from GitHub in a temp HOME, MCP initialize + tools/list, one hand-written minimal PostToolUse Bash payload (documented fields only) must now replace. Confirm: no refs/tags/v2*, no GitHub Release, main sha unchanged. Append "Re-run after fixes" to the rehearsal doc. Commit, push to v2-design.`,
  { label: 'rf-rehearse', phase: 'Verify', schema: RESULT, ...SNM })
const ci = await agent(`${base('rf-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 45 min). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'rf-ci', phase: 'Verify', ...SNM })
return { fixes, gate: g, rehearse, ci }
