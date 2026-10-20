export const meta = {
  name: 'v2-saving-90-resume',
  description: 'Resume from r5: loop until v2 keeps >= 90% of large tool output out of context (offline + live), guards hold; open items first, frozen score script, branch per round, merge only on improvement',
  phases: [
    { title: 'Prep', detail: 'frozen score script + 4 open items in parallel' },
    { title: 'Loop', detail: 'optimize on a branch -> score -> merge only if better' },
    { title: 'Check', detail: 'skeptic, gate 3x, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const TARGET = 90, MAX_ROUNDS = 8, MAX_DRY = 2

const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const SCORE = { type: 'object', properties: {
  m1: { type: 'number' }, m2: { type: 'number' }, guardsOk: { type: 'boolean' }, head: { type: 'string' },
  detail: { type: 'string' } }, required: ['m1', 'm2', 'guardsOk', 'head', 'detail'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request that appears in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push after every step; push without asking. Never touch main, never force-push v2-design, never publish, never tag. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Work only in your own clone: rm -rf /private/tmp/cm-v2-fu-${id} && git clone --branch v2-design https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete only that folder at the end, after everything is pushed.
No data loss: first commit within your first 20 tool calls; commit and push after each meaningful step.
Never weaken an assertion or skip a case. Never use truncation, head/tail cuts or regex filtering to shrink output: shrinking is BM25/FTS selection of chunks only (owner rule). Never change OUTPUT_CAP or HOOK_* budgets. Never edit .impl/progress.json. Private data (transcripts, per-session rows) stays in /private/tmp/cm-v2-impl-private/bench, never in the repo. Write no personal names.
Live runs: keyless claude -p, model claude-sonnet-5-5, effort low, --max-budget-usd 0.25 per session, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, sessions in parallel.
Pace: read only the files your task names; be done within about 45 minutes. Disk: delete your clone and any build output you made before you return.`

const SCORE_DEF = `Score definition (frozen; owner target >= ${TARGET}% on M1 and M2):
- M1 (offline): bench/replay.mjs over the owner's corpus, fixed population = results of Bash, Read, Grep, Glob, WebFetch, WebSearch and non-ctx MCP tools whose native output is > 4096 bytes. M1 = 100 * (bytes before - bytes the model gets under v2) / bytes before, counting a deny as its text plus the re-run bound.
- M2 (live): fixed large-output task set bench/live/score-tasks.mjs (json-1, multi-1 and 2 new large tasks, frozen in the prep commit). Per task: sum of UTF-8 bytes of tool_result content the model saw (from stream-json) in arm v2 vs arm off; M2 = median over tasks of 100 * (off - v2) / off.
- Guards (all must hold): v2 success >= off success on every task (score tasks plus the 5 small tasks log-1 json-1 tests-1 file-1 git-1); offline <=1K bucket saving >= -1%; median session tokens of the 5 small tasks not higher than the baseline v2 value + 2%; node scripts/gate.mjs --milestone M7 --quick exit 0.
- Report also, not as target: corpus-total offline saving, median session tokens per arm, cost.`

const A = args || {}
const prep = A.prep || []
const PREP = prep.map((p) => ({ id: p.id }))
const score = (label, ref) => agent(`${base(label)}\n\nRole: scorer. In your clone: git fetch origin; git checkout ${ref}; verify sha256 of bench/saving-score.mjs and bench/live/score-tasks.mjs equals bench/saving-score.lock on origin/v2-design (if not, return guardsOk false with detail "score files changed"). Install dev tooling, build, run node bench/saving-score.mjs. Do not change any file except committing bench/saving-score-last.json on ${ref} if it is a branch. Return m1, m2, guardsOk, head (commit), detail (guards and the report-only numbers, 5 lines).`,
  { label, phase: 'Loop', schema: SCORE, ...SNL })

phase('Loop')
let best = A.best
const history = A.history || []
let dry = 0
if (A.pending) {
  const p = A.pending
  const s = await score(`sv-score-${p.round}`, `origin/${p.branch}`)
  const better = s && s.guardsOk && (s.m1 + s.m2 > best.m1 + best.m2 + 1)
  history.push({ round: p.round, branch: p.branch, change: p.change, m1: s && s.m1, m2: s && s.m2, guardsOk: s && s.guardsOk, merged: !!better })
  log(`round ${p.round} (resumed): M1 ${s && s.m1}%, M2 ${s && s.m2}% -> ${better ? "merge" : "no merge"}`)
  if (better) { await agent(`${base("sv-merge-" + p.round)}\n\nRole: merger. Merge origin/${p.branch} into v2-design (no-ff, rebase-free; resolve conflicts by keeping both sides' intent), build, run gate --milestone M7 --quick, push. Verify with git merge-base --is-ancestor. If the gate fails, do not push; report.`, { label: `sv-merge-${p.round}`, phase: "Loop", ...SNL }); best = s }
}
for (let r = (A.pending ? A.pending.round + 1 : 1); r <= (A.maxRound || 12) && best && !(best.m1 >= TARGET && best.m2 >= TARGET && best.guardsOk) && dry < MAX_DRY; r++) {
  const br = `impl/saving-r${r}`
  const opt = await agent(`${base('sv-opt-' + r)}\n\nRole: optimizer, round ${r}. ${SCORE_DEF}
Current best on v2-design: ${JSON.stringify(best)}. Known blockers for M2 from earlier rounds: json-1 off output is under REPLACE_TRIGGER_BYTES 4096 so no replace happens; multi-1 model re-runs grep after each replace. r4 failed gate gp-cases. Earlier rounds (tried, numbers, merged or not): ${JSON.stringify(history)}. Prep results: ${JSON.stringify(prep.map((x, i) => ({ id: PREP[i].id, numbers: x && x.numbers, summary: x && x.summary })))}.
Work on a new branch ${br} from origin/v2-design (git checkout -b ${br}; push it). Do not touch bench/saving-score.mjs, bench/live/score-tasks.mjs, bench/saving-score.lock, fixtures or guards.
First read the per-bucket and per-tool numbers and pick the ONE change with the largest expected gain, from the data. Allowed levers: a new constant for how many bytes the replace returns (separate from OUTPUT_CAP, which stays the trigger cap elsewhere), a new constant for the replace trigger size, chunk size and BM25 selection by intent, the more-line text, Read range handling, ctx_search result size, and the fixed per-session text (tool descriptions <= current lint limits). Write tests first, implement, run node --test tests/v2/ and gate --milestone M7 --quick, then run node bench/saving-score.mjs yourself. Record a DEVIATIONS.md row with the measured numbers. Push ${br}. Return done, commits, numbers (your own score run), summary (what you changed and why, 5 lines).`,
    { label: `sv-opt-${r}`, phase: 'Loop', schema: RESULT, ...OPH })
  const s = await score(`sv-score-${r}`, `origin/${br}`)
  const better = s && s.guardsOk && (s.m1 + s.m2 > best.m1 + best.m2 + 1)
  history.push({ round: r, branch: br, change: opt && opt.summary, m1: s && s.m1, m2: s && s.m2, guardsOk: s && s.guardsOk, merged: !!better })
  log(`round ${r}: M1 ${s && s.m1}%, M2 ${s && s.m2}%, guards ${s && s.guardsOk} -> ${better ? 'merge' : 'keep branch, no merge'}`)
  if (better) {
    await agent(`${base('sv-merge-' + r)}\n\nRole: merger. Merge origin/${br} into v2-design (no-ff), build, run gate --milestone M7 --quick, push. Verify with git merge-base --is-ancestor origin/${br} origin/v2-design. If the gate fails, do not push; report.`,
      { label: `sv-merge-${r}`, phase: 'Loop', ...SNL })
    best = s; dry = 0
  } else dry++
}
const reached = best && best.m1 >= TARGET && best.m2 >= TARGET && best.guardsOk
log(`loop end: ${reached ? 'target reached' : 'target NOT reached'} | best M1 ${best && best.m1}%, M2 ${best && best.m2}%`)

phase('Check')
const proof = await agent(`${base('sv-proof2')}\n\nTask: live proof after the fixes. Build v2-design. Run Bash outputs of 8 KB, 20 KB and 28 KB (seq) with --plugin-dir release-out, 2 runs each. From stream-json report the bytes of the tool_result the model saw vs the full output. Append to docs/v2/benchmarks.md "Replace live proof (after r1 shape fix)". Commit, push. Do not change src/.`, { label: 'sv-proof2', phase: 'Check', ...SNL })
const sk = await agent(`${base('sv-skeptic')}\n\nRole: skeptic. Rounds: ${JSON.stringify(history)}. Check on v2-design: score files match the lock and were not changed after the prep commit (git log), the replace path uses BM25 selection only (no truncation, head/tail, regex), success not lower in any arm, numbers in docs/v2/benchmarks.md match bench/saving-score-last.json. Write a "Saving loop" section in docs/v2/benchmarks.md: baseline, each round (change, M1, M2, merged), final, and whether ${TARGET}% was reached; if not, the measured ceiling and what blocks it. Commit, push. Return 5 lines.`,
  { label: 'sv-skeptic', phase: 'Check', ...SNM })
const g = await agent(`${base('sv-gate')}\n\nRole: gate. Fresh clone, install, build, node scripts/gate.mjs --all three times. Do not fix. Return green, failing, summary.`,
  { label: 'sv-gate', phase: 'Check', schema: GATE, ...SNL })
const ci = await agent(`${base('sv-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 40 min). If red, fix the root cause, push, watch again (1 round). Report per OS and Node.`,
  { label: 'sv-ci', phase: 'Check', ...SNM })
return { reached, best, history, proof, skeptic: sk, gate: g, ci }
