export const meta = {
  name: 'v2-compact-m2',
  description: 'Publish pack for benchmarks; compaction: re-score T-CMP, push-not-pull (anchored block + turn-boundary BM25 recall), live T-CMP; M2: trigger sweep + self-sufficient replace text; merge on evidence; gate, CI, A/B, report',
  phases: [
    { title: 'Publish', detail: 'benchmark publish pack' },
    { title: 'Compact', detail: 're-score, implement push recall, live T-CMP, merge' },
    { title: 'M2', detail: 'trigger sweep, replace text, 3x score, merge' },
    { title: 'Final', detail: 'gate, CI, A/B, docs, report' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const SCORE = { type: 'object', properties: {
  m1: { type: 'number' }, m2: { type: 'number' }, smallTok: { type: 'number' }, guardsOk: { type: 'boolean' }, detail: { type: 'string' } },
  required: ['m1', 'm2', 'smallTok', 'guardsOk', 'detail'] }
const TCMP = { type: 'object', properties: {
  correct: { type: 'number' }, baselineCorrect: { type: 'number' }, injectedBytesMedian: { type: 'number' }, noCompactRegression: { type: 'boolean' }, detail: { type: 'string' } },
  required: ['correct', 'baselineCorrect', 'injectedBytesMedian', 'noCompactRegression', 'detail'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, base branch v2-design. The owner approved commit + push after every step; push without asking. Never touch main, never force-push v2-design, never tag, never publish, never npm publish/deprecate. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5).
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return, after everything is pushed. Run node build/build.mjs --generated-only before node --test. npm ci fails (no lockfile): use npm install --no-package-lock.
No data loss: commit and push after each meaningful step. Never weaken an assertion or skip a case; a test that encodes a superseded rule is rewritten with a DEVIATIONS.md row. Never truncate or regex-filter output (BM25 selection of whole chunks only). Never change OUTPUT_CAP or HOOK_* budgets. Never change bench/saving-score.mjs, bench/live/score-tasks.mjs, bench/saving-score.lock. Files at the repo root outside the target tree fail check-removed: never add any. Use git archaeology before changing old code. Write no personal names. Private data stays in /private/tmp/cm-v2-impl-private.
Live runs: keyless claude -p, model claude-sonnet-5-5, effort low, --max-budget-usd 0.25, env ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1.
Pace: read only the files your task names; be done within about 60 minutes.`

const COMPACT_DESIGN = `Owner decision 2026-10-21 (DECISIONS-r11), compaction "push, not pull":
Evidence: after compaction the model called ctx_resume/ctx_search in 0 of 50 clean sessions (all arms, pointer line included). A model does not call a tool for state it does not know it lost, so no design may depend on that call.
(A) Anchored block at SessionStart(compact): deterministic, byte-budgeted, sections in fixed order: current goal (last user request verbatim), open errors, last state of edited files, decisions, next step. Keep ADR-0009 renderState as the base; add a byte budget constant if it has none.
(B) Turn-boundary recall: on every UserPromptSubmit after a compaction in that session, rank the session journal (and the same project's prior-session rows, scope rules of ADR-0009 §8) by BM25 against the prompt text; inject the top whole rows as additionalContext only when the top score is above a threshold, within a byte budget (new constants, e.g. RECALL_BUDGET_BYTES, RECALL_MIN_SCORE), never repeating a row already injected in this session. No compaction in the session -> the path returns allow with zero added bytes (small-task cost must not change).
(C) The GS11 call-rate gate measured the pull design; it is retired. GS11 = correctness (>= 0.80 arm with the shipped policy) plus the injected-bytes median, reported.`

phase('Publish')
const pub = agent(`${base('cm-pub')}\n\nTask: benchmark publish pack (the owner will publish these). Create docs/benchmarks/README.md (plain words, tables) and docs/benchmarks/data/ with the aggregate JSON files only (no private rows): saving loop (bench/saving-score-last.json and the round history in docs/v2/benchmarks.md), final A/B small vs large off/v1/v2 (bench/live/results/ab-final2.json), offline replay before/after with size buckets, live replace proof (16/16, sizes and bytes seen), memory live results, T-CMP clean results. For each: date, Claude Code version, model, effort, runs per cell, task list, exact reproduce command, cost, and the honest caveats (n per cell, noise range 78-89 for M2, fixed per-session cost on small tasks). Lead with what the product does: bytes the model sees on large outputs (off 4,695 B, v1 2,437 B, v2 735 B median) and cost. Link it from README.md Benchmarks (README <= 200 lines). Check every number against its source file. Commit, push.`,
  { label: 'cm-pub', phase: 'Publish', schema: RESULT, ...SNM })

const scoreM2 = (label, ref) => agent(`${base(label)}\n\nRole: scorer. Checkout ${ref}. Check sha256 of the score files against bench/saving-score.lock on origin/v2-design (mismatch: guardsOk false). Build. Run node bench/saving-score.mjs THREE times; return median M1, median M2, median small-task v2 session tokens (smallTok), guardsOk = all three runs guardsOk. Change no file. detail: per run M1/M2 and per-task M2, 4 lines.`,
  { label, phase: 'M2', schema: SCORE, ...SNL })
const merge = (id, br, ph) => agent(`${base('cm-merge-' + id)}\n\nRole: merger. Merge origin/${br} into v2-design (no-ff); resolve conflicts keeping both intents (other tracks change src/core/hooks/dispatch.ts and constants.ts too). Build, node --test tests/v2/, node scripts/gate.mjs --milestone M7 --quick, push, verify git merge-base --is-ancestor. If the gate fails, do not push; report the failure in 3 lines.`,
  { label: `cm-merge-${id}`, phase: ph, ...SNM })

const compactTrack = async () => {
  const rescore = await agent(`${base('cm-rescore')}\n\nTask: check the T-CMP measurement before any design change. In e2e/live/compact/ read the scorer and fixtures; all 15 misses in e2e/live/compact/results/2026-10-21-sonnet-5-5-clean-all-arms.json are fixture session-03 with a case-sensitive exactMatch. Decide from the fixture's own spec whether the expected answer is case-sensitive (e.g. a file name or id is; a word in prose is not). If the scorer is wrong, fix it (normalize only what the spec says, test first: one case that must still fail on a wrong answer), DEVIATIONS row, and re-score the stored results without new model calls. Report corrected correct per arm. Commit, push to v2-design.`,
    { label: 'cm-rescore', phase: 'Compact', schema: RESULT, ...SNM })
  const impl = await agent(`${base('cm-impl')}\n\n${COMPACT_DESIGN}\nT-CMP re-score result: ${JSON.stringify(rescore).slice(0, 1200)}\nTask: implement (A) and (B) on branch impl/compact-push from origin/v2-design (push early). Read ADR-0009, docs/v2/impl (compaction and hooks sections), src/core/hooks/dispatch.ts (sessionStart, userPromptSubmit), src/core/index (BM25), src/adapters/table.ts (compactDelivery, compactSummary). Tests first: no compaction -> zero added bytes on UserPromptSubmit; after compaction a prompt naming an earlier error gets that journal row; budget and no-repeat hold; below threshold -> nothing; per-agent rows follow the adapter table (agents without additionalContext on UserPromptSubmit keep their current single path, ADR-0001). Write docs/v2/review/DECISIONS-r11.md, amend ADR-0009 (Changes line), TECH-SPEC GS11 row, DEVIATIONS rows. Build, node --test tests/v2/, gate --milestone M7 --quick. Push. Return done, commits, numbers, summary.`,
    { label: 'cm-impl', phase: 'Compact', schema: RESULT, ...OPH })
  const live = await agent(`${base('cm-tcmp')}\n\nTask: live T-CMP on branch impl/compact-push (build it; do not change src/). Run e2e/live/compact/run.mjs with the corrected scorer: the shipped-policy arm 10 sessions on claude-sonnet-5-5 and 5 on claude-opus-5-5 (effort low), plus the old full-block arm 10 sessions on sonnet as baseline; cost <= $8. Also run the 5 small A/B tasks (bench/live/ab-quick.mjs, v2 arm only, 2 runs) to confirm no added bytes without compaction. Return correct (shipped arm, sonnet), baselineCorrect, injectedBytesMedian, noCompactRegression, detail (opus result, per-session misses, cost). Write the result to docs/v2/benchmarks.md "Compaction push recall" on the branch, push.`,
    { label: 'cm-tcmp', phase: 'Compact', schema: TCMP, ...SNM })
  const ok = live && live.correct >= 0.8 && live.correct >= live.baselineCorrect && live.noCompactRegression
  log(`compact: correct ${live && live.correct} vs baseline ${live && live.baselineCorrect}, injected ${live && live.injectedBytesMedian} B -> ${ok ? 'merge' : 'no merge'}`)
  if (ok) await merge('compact', 'impl/compact-push', 'Compact')
  return { rescore, impl, live, merged: !!ok }
}

const m2Track = async () => {
  let best = await scoreM2('cm-m2-base', 'origin/v2-design')
  const LEVERS = [
    { id: 'trigger', what: `Lower REPLACE_TRIGGER_BYTES from data. Offline: sweep 1024, 1536, 2048, 3072, 4096 with bench/replay.mjs; for each report M1, the <=1K and 1-4K bucket savings (must stay >= -1%) and how many results get replaced. Live: json-1 off output size and v2 bytes seen at the chosen value. Pick the lowest value that keeps every guard; tests first.` },
    { id: 'text', what: `Make the replace self-sufficient so the model does not re-check with grep/Read/ctx_execute. Read 6 live stream-json transcripts of big-json and multi-1 (run them) and list the follow-up calls and why. Then change only the replace text layout, deterministically: a first line with exact counts of the full output (lines, bytes) and the source label; selected chunks with their original line numbers; the more line with a ready ctx_search query made from the prompt words. No new truncation; selection stays whole-chunk BM25 within REPLACE_RETURN_BYTES (the count line and line numbers may use a small separate constant). Tests first; check with 6 live runs that follow-up calls drop.` },
  ]
  const hist = []
  for (const L of LEVERS) {
    const br = `impl/m2-${L.id}`
    const r = await agent(`${base('cm-m2-' + L.id)}\n\nRole: optimizer. Branch ${br} from origin/v2-design (push early). Current 3x-median score: ${JSON.stringify(best)}. Earlier: ${JSON.stringify(hist).slice(0, 1500)}. Task: ${L.what}\nBuild, node --test tests/v2/, gate --milestone M7 --quick, run node bench/saving-score.mjs once. DEVIATIONS row. Push ${br}. Return done, commits, numbers, summary.`,
      { label: `cm-m2-${L.id}`, phase: 'M2', schema: RESULT, ...OPH })
    const s = await scoreM2(`cm-m2-score-${L.id}`, `origin/${br}`)
    const better = s && s.guardsOk && s.m1 >= best.m1 - 0.5 && s.m2 > best.m2 + 1
    hist.push({ lever: L.id, change: r && r.summary, score: s, merged: !!better })
    log(`m2 ${L.id}: M1 ${s && s.m1}, M2 ${s && s.m2} -> ${better ? 'merge' : 'no merge'}`)
    if (better) { await merge('m2-' + L.id, br, 'M2'); best = s }
  }
  return { best, hist }
}

const [pubR, compactR, m2R] = await parallel([() => pub, compactTrack, m2Track])

phase('Final')
const ab = await agent(`${base('cm-ab')}\n\nTask: final A/B on v2-design (build) vs v1 (branch main as a local plugin) vs off with bench/live/ab-quick.mjs: SMALL (log-1 json-1 tests-1 file-1 git-1) and LARGE (multi-1 + bench/live/score-tasks.mjs), 3 runs each, cost <= $6. Report per group and arm: median session tokens, median tool_result bytes the model saw, success, cost, v2 vs v1, v2 vs off. Save bench/live/results/ab-final3.json, update docs/benchmarks/README.md and docs/v2/benchmarks.md. Commit, push.`,
  { label: 'cm-ab', phase: 'Final', schema: RESULT, ...SNM })
const gate = (label) => agent(`${base(label)}\n\nRole: gate. Fresh clone, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs. Do not fix. Return green, failing, summary.`,
  { label, phase: 'Final', schema: GATE, ...SNL })
let g = await gate('cm-gate-1')
if (g && !g.green) {
  await agent(`${base('cm-fix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'cm-fix', phase: 'Final', ...OPH })
  g = await gate('cm-gate-2')
}
const ci = await agent(`${base('cm-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 45 min). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'cm-ci', phase: 'Final', ...SNM })
await agent(`${base('cm-report')}\n\nRole: report writer. Rewrite docs/v2/review/MORNING-REPORT.md (short, tables, plain words): compaction (re-score ${JSON.stringify(compactR && compactR.rescore && compactR.rescore.numbers)}, live ${JSON.stringify(compactR && compactR.live)}, merged ${compactR && compactR.merged}); M2 ${JSON.stringify(m2R).slice(0, 2000)}; A/B ${JSON.stringify(ab && ab.numbers)}; publish pack ${JSON.stringify(pubR && pubR.summary).slice(0, 400)}; gate ${JSON.stringify(g).slice(0, 500)}; CI ${String(ci).slice(0, 500)}; what is still below target with its measured reason; owner-only steps (merge to main, tag, marketplace ref, npm deprecate). Also update .impl/BLOCKED-M7.md with evidence. Commit, push.`,
  { label: 'cm-report', phase: 'Final', ...SNM })
return { publish: pubR, compact: compactR, m2: m2R, ab, gate: g }
