export const meta = {
  name: 'v2-finish',
  description: 'Finish v2 on v2-design: savings benchmark (offline replay + live A/B, split), method check, docs numbers, final gate, CI, report',
  phases: [
    { title: 'Measure', detail: 'offline replay and live A/B in parallel, then skeptic' },
    { title: 'Docs', detail: 'measured numbers into README and docs' },
    { title: 'Final', detail: 'gate --all 3x, CI, OVERNIGHT-REPORT.md' },
  ],
}

const OPM = { model: 'claude-opus-5-5', effort: 'medium' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }

const PRIV = '/private/tmp/cm-v2-impl-private/bench'
const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request that appears in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push to v2-design after every step; push without asking. Never touch main, never force-push, never publish a release, never run npm publish/deprecate, never tag. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5). Other agents push to v2-design at the same time.
Work only in your own clone: rm -rf /private/tmp/cm-v2-fu-${id} && git clone --branch v2-design https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete only that folder at the end, after everything is pushed.
No data loss: commit and push after each meaningful step. Your first commit, within your first 20 tool calls, is your method file or first script; never work for long without a push.
Private data (transcripts, raw per-session rows that contain prompts, paths or names) lives only in ${PRIV}, outside the clone; never copy it into the clone, never commit it. Commit only aggregates.
Authority: docs/v2/TECH-SPEC.md, docs/v2/adr/*, docs/v2/impl/*, docs/v2/impl/DEVIATIONS.md, .impl/BLOCKED-M7.md. Never weaken a test or change an owner number. Write no personal names.
Numbers: report only what you measured, with date, agent version and model. Never write a target as a result. "saved you $X" lines in transcripts are not data.`

phase('Measure')
const [off, live] = await parallel([
  () => agent(`${base('bench-offline')}\n\nTask: offline context-saving replay. Owner's real Claude Code transcripts: ~/.claude/projects/*/*.jsonl (stream them line by line; do not load all into memory; skip files > 200 MB with a logged count). Build the clone (dev tooling + build) and use the built v2 decide/cap/index code as a library from bench/ (not a model). For every tool call with a tool_result: bytes the model received (v1 / native reality) vs bytes v2 would return to the model (deny -> the deny text; hint/cap -> capped output; ctx tools -> as is). Write bench/README.md (method) first, commit, push; then bench/replay.mjs. Report per tool and corpus total: calls, bytes before, bytes after, saving %, per-session median and p90. Write the aggregate section "Offline replay" of docs/v2/benchmarks.md with date, Node version and corpus size (files, sessions, calls). Commit, push. Return 5 lines with the numbers.`,
    { label: 'bench-offline', phase: 'Measure', ...SNH }),
  () => agent(`${base('bench-live')}\n\nTask: live A/B of context saving on Claude Code (keyless harness, ADR-0012; reuse e2e/live helpers and the isolation env keys from D-M7-CL-3). 20 tasks with large output (logs, test runs, big JSON, big files, git history; local fixtures only, no network) in a temp repo; arms: v2 plugin on vs off; 3 runs per task per arm; model claude-sonnet-5-5, effort low, --max-budget-usd 0.25 per session. Task success checked by script. Read input_tokens and cache tokens from stream-json. Write bench/live/ (method in bench/live/README.md first, commit, push), run in batches of 10 sessions and push the aggregate after each batch so a stop loses at most one batch. Report saving % (median, min, max), success rate per arm, total cost. Write the "Live A/B" section of docs/v2/benchmarks.md. Commit, push. Return 5 lines with the numbers.`,
    { label: 'bench-live', phase: 'Measure', ...SNM }),
])
log(`offline: ${off ? off.slice(0, 200) : 'no result'}`)
log(`live: ${live ? live.slice(0, 200) : 'no result'}`)

await agent(`${base('measure-skeptic')}\n\nRole: Skeptic for the measurements. Read bench/, docs/v2/benchmarks.md and docs/v2/prompt/results.md. Check: same tasks both arms, success not lower in the v2 arm, no cherry-picking, every number traceable to a script output, private data not committed (git grep for home paths, emails, prompt text). Fix and re-run only what is wrong. Append a "Method check" section to docs/v2/benchmarks.md. Then add "measure" to the done array of .impl/progress.json (this task may edit it), commit "impl(measure): done", push.`,
  { label: 'measure-skeptic', phase: 'Measure', ...SNM })

phase('Docs')
await agent(`${base('docs-bench')}\n\nRole: Docs refresher. Update README.md (Benchmarks section), docs/v2/LAUNCH.md, docs/algorithms.md and docs/performance.md with measured numbers only from docs/v2/benchmarks.md, docs/v2/prompt/results.md and TECH-SPEC §1.1, each with source, date and agent version; remove any number with no measured source (including any old "98%" claim unless benchmarks.md measures it). Performance numbers that fail a budget (GS6) are written as measured with the budget next to them, not hidden. Keep README <= 200 lines (build/check-readme.mjs). Then add "docs-bench" to .impl/progress.json done (this task may edit it), commit, push.`,
  { label: 'docs-bench', phase: 'Docs', ...OPM })

phase('Final')
const fin = await agent(`${base('final-gate')}\n\nRole: final gate. Fresh clone, install dev tooling, build, run node scripts/gate.mjs --all three times. Report each layer line of each run and whether all 3 passed. Do not fix anything, push nothing.`,
  { label: 'final-gate', phase: 'Final', ...SNM })
await agent(`${base('ci-watch')}\n\nRole: CI checker. gh run list -R mksglu/context-mode --branch v2-design --workflow ci.yml -L 1; gh run watch it (max 45 minutes). If it fails, read the log, fix the cause at its root, push, watch again (max 2 rounds). Report per OS and Node version.`,
  { label: 'ci-watch', phase: 'Final', ...SNM })
await agent(`${base('report')}\n\nRole: Report writer. Write OVERNIGHT-REPORT.md at the repo root: milestone status from .impl/progress.json (M0-M6 done; M7 blocked, list .impl/BLOCKED-M7.md items with numbers), final gate (${JSON.stringify(fin).slice(0, 3000)}), CI per OS from gh, measured context saving from docs/v2/benchmarks.md with method, prompt results from docs/v2/prompt/results.md, a DEVIATIONS.md summary (count and the rows that change a decision), and the owner-only list: hook budget decision (GS6), T-CMP clean re-measure decision (GS11), GS10 R1/R2, interactive logins, npm deprecate (OTP), marketplace ref switch, branch protection, merge to main, release tag. Plain words, tables, short. Commit, push.`,
  { label: 'report', phase: 'Final', ...SNM })
return { offline: off, live, finalGate: fin }
