export const meta = {
  name: 'v2-merge-pending',
  description: 'Merge impl/compact-push (no small-task regression: v2 38,202 vs v2-design 38,203); rebase and re-score impl/m2-trigger and impl/m2-text now that check-removed is fixed; merge only on 3x evidence; gate, CI',
  phases: [
    { title: 'Compact', detail: 'merge impl/compact-push' },
    { title: 'M2', detail: 'rebase, 3x score, merge if better' },
    { title: 'Final', detail: 'gate 3x, CI, docs' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const SCORE = { type: 'object', properties: {
  m1: { type: 'number' }, m2: { type: 'number' }, smallTok: { type: 'number' }, guardsOk: { type: 'boolean' }, detail: { type: 'string' } },
  required: ['m1', 'm2', 'smallTok', 'guardsOk', 'detail'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, base branch v2-design. The owner approved commit + push; push without asking. Never touch main, never push a tag, never create a GitHub Release, never npm publish/deprecate, never force-push v2-design. Commit as: git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Push rejected: git pull --rebase, push again (max 5). Another workflow may merge impl/project-source into v2-design (it touches dispatch.ts step 3): keep both intents on conflict.
Own clone only: rm -rf /private/tmp/cm-v2-fu-${id} && git clone https://github.com/mksglu/context-mode.git /private/tmp/cm-v2-fu-${id}. Delete it and its build output before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Never weaken an assertion. Never change bench/saving-score.mjs, bench/live/score-tasks.mjs, bench/saving-score.lock. Write no personal names.`

phase('Compact')
await agent(`${base('mp-compact')}\n\nRole: merger. Merge origin/impl/compact-push (DECISIONS-r11 push recall, live T-CMP sonnet 10/10, opus 4/5, baseline 10/10) into v2-design (no-ff). Evidence for no small-task regression: v2 small median tokens on the branch 38,202 vs v2-design final A/B 38,203; unit tests show 0 added hook bytes without compaction. Resolve conflicts keeping both intents. Build, node --test tests/v2/, gate --milestone M7 --quick; push only if green; verify git merge-base --is-ancestor. Then fix the runner gap: make e2e/live/compact/run.mjs record hook additionalContext bytes (from --include-hook-events) so injectedBytesMedian is measured next time; test, commit, push. Report 4 lines.`,
  { label: 'mp-compact', phase: 'Compact', ...SNM })

const score = (label, ref) => agent(`${base(label)}\n\nRole: scorer. Checkout ${ref}. Check sha256 of the score files against bench/saving-score.lock on origin/v2-design. Build. Run node bench/saving-score.mjs THREE times; return median M1, median M2, median smallTok, guardsOk = all three runs guardsOk. Change no file. detail: per run M1/M2 and per-task M2, 4 lines.`,
  { label, phase: 'M2', schema: SCORE, ...SNL })

phase('M2')
let best = await score('mp-base', 'origin/v2-design')
const hist = []
for (const id of ['text', 'trigger']) {
  const br = `impl/m2-${id}`
  await agent(`${base('mp-rebase-' + id)}\n\nRebase origin/${br} onto origin/v2-design (git rebase; resolve conflicts keeping both intents), build, node --test tests/v2/, gate --milestone M7 --quick (check-removed is fixed on v2-design now). Push with --force-with-lease to ${br} only. Report 3 lines.`,
    { label: `mp-rebase-${id}`, phase: 'M2', ...SNM })
  const s = await score(`mp-score-${id}`, `origin/${br}`)
  const better = s && s.guardsOk && s.m1 >= best.m1 - 0.5 && s.m2 > best.m2 + 1
  hist.push({ id, score: s, merged: !!better })
  log(`${id}: M1 ${s && s.m1}, M2 ${s && s.m2} vs base ${best && best.m2} -> ${better ? 'merge' : 'no merge'}`)
  if (better) {
    await agent(`${base('mp-merge-' + id)}\n\nRole: merger. Merge origin/${br} into v2-design (no-ff), build, gate --milestone M7 --quick, push only if green, verify ancestor. Report 3 lines.`,
      { label: `mp-merge-${id}`, phase: 'M2', ...SNM })
    best = s
  }
}

phase('Final')
const g = await agent(`${base('mp-gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'mp-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await agent(`${base('mp-fix')}\n\nRole: Fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at root cause, run gate --all once, commit, push.`, { label: 'mp-fix', phase: 'Final', ...OPH })
await agent(`${base('mp-docs')}\n\nUpdate docs/v2/review/MORNING-REPORT.md, docs/benchmarks/README.md (saving section) and .impl/BLOCKED-M7.md with: compaction push recall merged (live T-CMP sonnet 10/10, opus 4/5, call-rate gate retired per DECISIONS-r11), M2 re-score ${JSON.stringify({ best, hist }).slice(0, 1500)}, gate ${JSON.stringify(g).slice(0, 400)}. Every number with source and date. Commit, push.`,
  { label: 'mp-docs', phase: 'Final', ...SNM })
const ci = await agent(`${base('mp-ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (max 45 min). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'mp-ci', phase: 'Final', ...SNM })
return { best, hist, gate: g, ci }
