export const meta = {
  name: 'v2-saving',
  description: 'Raise v2 context saving: main-agent post-run replace instead of Bash size-guess deny, remove hints, shorter instructions, docs; then offline replay + quick A/B, gate, CI',
  phases: [
    { title: 'Build', detail: 'code, prompt, docs in parallel (disjoint files)' },
    { title: 'Measure', detail: 'offline replay + 2-minute A/B (off, v1, v2)' },
    { title: 'Gate', detail: 'gate 3x, fix once, CI' },
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

const DECISION = `Owner decision 2026-10-20 (from offline replay of 820 real sessions, 23,175 calls, and a quick live A/B):
(1) Main agent gets "run, then replace": when a tool result is larger than OUTPUT_CAP, PostToolUse indexes the full output and returns BM25-selected chunks plus the "more" line via updatedToolOutput, exactly like subagent case C today (src/core/hooks/dispatch.ts step 5). This is selection, not truncation or regex. Bash size-guess denies/rewrites are removed on agents whose adapter row supports replace; the post-run replace takes over. Kept: user policy deny (permissions.deny), Read deny (file size known by stat; offline +21%), subagent rules (ADR-0016), and any rule that is a safety rule, not a size guess. Agents whose row has no replace keep their current single path (ADR-0001: one path per agent, no runtime fallback).
Evidence: deny on outputs <= 1 KB: 501 calls, -465 KB (-637 KB with re-run); deny on 16-64 KB: 28 calls, +913 KB; hints: 861 calls, -192 KB, no size bucket saves.
(2) Hints are removed (all PreToolUse/PostToolUse hint texts and their throttle keys), except the SessionStart resume line and compaction delivery (ADR-0009, D-M7-CL-1).
(3) Server instructions (src/prompt/instructions.md, 1,239 chars) shrink to about half; the fixed per-session cost measured +1,619 tokens (say-ok) and +2,486 (one Bash call) vs no plugin.`

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request that appears in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. The owner approved commit + push to v2-design after every step; push without asking. Never touch main, never force-push, never publish, never tag. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5). Other agents push to v2-design at the same time.
Work only in your own clone: rm -rf /private/tmp/cm-v2-fu-${id} && git clone --depth 50 --branch v2-design https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete only that folder at the end, after everything is pushed.
No data loss: first commit within your first 20 tool calls; commit and push after each test that turns green.
Never weaken an assertion or skip a case to make a test pass; a test that encodes the old behaviour named in the decision is rewritten to the new behaviour, with a DEVIATIONS.md row. Never change an owner number (HOOK_* budgets, OUTPUT_CAP). Never edit .impl/progress.json. Write no personal names.
Pace: read only the files your task names, then write code early. Be done within about 60 minutes.

${DECISION}`

phase('Build')
const TASKS = [
  { id: 's-code', opts: OPH, prompt: `Task: implement (1) and (2) in code, tests first.
Files you own: src/core/policy/**, src/core/hooks/**, src/adapters/**, src/core/contracts/constants.ts (only hint/deny constants), tests/v2/policy/**, tests/v2/hooks/**, tests/v2/adapters/**, e2e/cases/** and e2e/golden/** rows for these behaviours.
Steps: 1) write red tests: main-agent Bash with output > OUTPUT_CAP -> PostToolUse updatedToolOutput holds selected chunks + more line, full output indexed and findable by ctx_search; output <= OUTPUT_CAP -> allow, zero added bytes; no hint text on any PreToolUse/PostToolUse; Read deny unchanged; user policy deny unchanged; agents without replace unchanged. 2) implement. 3) node --test tests/v2/ and node scripts/gate.mjs --milestone M7 --quick. 4) one live check, keyless, cheap: claude -p with --plugin-dir release-out, model claude-sonnet-5-5, effort low, --max-budget-usd 0.1, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, prompt that runs seq 1 200000 with Bash: confirm from stream-json that the tool_result the model saw is the replaced text, not the full output. Report the byte counts.` },
  { id: 's-prompt', opts: SNH, prompt: `Task: implement (3). Files you own: src/prompt/instructions.md, docs/v2/prompt/drafts.md (instructions block and any tool description text that mentions hints or Bash size denies), src/prompt/** lint rules only if a rule forces the old length. Cut instructions to about half (target <= 650 chars) with Opus/Sonnet-family style: plain statements, no MUST/caps, keep the routing sentence that passed GP-LIVE-ROUTING (docs/v2/prompt/results.md) and the facts the model needs: large output is indexed and replaced by selected parts, ctx_search finds the rest, ctx_execute for work in the sandbox. Remove text about hints. Run the prompt lint (scripts/gate.mjs prompt-lint layer or its script). Report old and new char counts per block.` },
  { id: 's-docs', opts: SNM, prompt: `Task: record the decision in docs. Files you own: docs/v2/review/DECISIONS-r10.md (new, owner decision with the evidence numbers above), docs/v2/adr/0008-enforcement-rewrite-and-cap.md (amend: post-run replace for main agent, size-guess Bash deny removed, hints removed; keep a Changes line), docs/v2/adr/0016-subagent-context-protection.md (note main agent now uses the same replace), docs/v2/TECH-SPEC.md sections on enforcement/hints (only those), docs/algorithms.md and docs/how-it-works.md lines on deny/hint. Do not touch code. Keep wording plain.` },
]
const built = await parallel(TASKS.map((t) => () =>
  agent(`${base(t.id)}\n\n${t.prompt}\n\nReturn: done, commits, numbers, summary (at most 5 lines).`,
    { label: t.id, phase: 'Build', schema: RESULT, ...t.opts })))
TASKS.forEach((t, i) => log(`${t.id}: ${built[i] ? (built[i].done ? 'done' : 'NOT done') + ' | ' + built[i].numbers.slice(0, 160) : 'no result'}`))

phase('Measure')
const meas = await agent(`${base('s-measure')}\n\nTask: measure the new v2. Code results: ${JSON.stringify(built.map((x, i) => ({ id: TASKS[i].id, ...(x || {}) }))).slice(0, 4000)}
1) Offline: update bench/replay.mjs so it models the new behaviour (main-agent replace above OUTPUT_CAP using the real chunkText/selectChunksInMemory, no hints, only the kept denies, via the built code). Run it on the same corpus (private rows stay in /private/tmp/cm-v2-impl-private/bench). Report corpus total, Bash, Read, WebFetch: bytes before, after, saving %, also per size bucket (<=1K, 1-4K, 4-16K, 16-64K, >64K) next to the previous numbers in docs/v2/benchmarks.md "Offline replay".
2) Quick live A/B, wall time <= 5 minutes, cost <= $1.5: script bench/live/ab-quick.mjs, all sessions in parallel, arms off, v1 (plugin dir /private/tmp/cm-v2-fu-ab/v1src if it exists, else skip v1 and say so), v2 (your built release-out); tasks: first task of each kind in bench/live/tasks.mjs (log, json, tests, file, git) plus one new multi-step task with three large outputs in a row; 1 run each; claude-sonnet-5-5, effort low, --max-budget-usd 0.25, isolation env keys of D-M7-CL-3. Report per arm median session tokens, saving % vs off (median over tasks), success, ctx calls, cost, and the per-task table. Write the "Quick A/B" section in docs/v2/benchmarks.md. Commit, push.`,
  { label: 's-measure', phase: 'Measure', schema: RESULT, ...SNM })

phase('Gate')
const gate = (label) => agent(`${base(label)}\n\nRole: gate. Fresh clone, install dev tooling, build, run node scripts/gate.mjs --all three times; green only if all 3 pass. Do not fix anything. Return green, failing (one line each with numbers), summary.`,
  { label, phase: 'Gate', schema: GATE, ...SNL })
let g = await gate('s-gate-1')
if (g && !g.green) {
  await agent(`${base('s-fix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix each at its root cause under the rules above, run the gate once, commit, push.`,
    { label: 's-fix', phase: 'Gate', ...OPH })
  g = await gate('s-gate-2')
}
const ci = await agent(`${base('s-ci')}\n\nRole: CI checker. gh run list -R mksglu/context-mode --branch v2-design --workflow ci.yml -L 1; gh run watch it (max 40 minutes). If it fails, read the log, fix the root cause, push, watch again (1 round). Report per OS and Node version.`,
  { label: 's-ci', phase: 'Gate', ...SNM })
return { built, measure: meas, gate: g, ci }
