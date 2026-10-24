export const meta = {
  name: 'v2-compact-m2-r2',
  description: 'Round 2: ship M2 (merge exp/m2-b-shape after a same-host T-GS6 A/B, then close the mcp__* leak); compaction: combine session-id fix + ledger lines + retrieval handle in the replacement, fix empty UserPromptSubmit after compact, precompute so the hook stays in budget; adversarial re-measure, gate, CI',
  phases: [
    { title: 'Work', detail: 'M2 ship + compaction combined fix, in parallel' },
    { title: 'Check', detail: 'adversarial re-measure both tracks' },
    { title: 'Final', detail: 'docs, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (exp/* branches as stated). Another agent pushes to v2-design at the same time: pull --rebase often, small commits, keep both sides on conflict. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY; its CLAUDE.md live-run rules apply (transcript is the evidence, explicit --model, </dev/null, fail closed).
Live claude -p: real Claude Code binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential, --plugin-dir <built release-out>, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd per session as stated. No API key.
Own temp space only: /private/tmp/cm-v2-r2-${id}; raw transcripts under /private/tmp/cm-v2-impl-private/compact-m2/r2-${id}. Never edit the real ~/.claude. Delete the temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Owner rules: no truncation and no regex as the fix; algorithms only. Never write instruction files. Subagent contexts must not grow (ADR-0016). Hook overhead D3 p95 <= 15 ms holds. Frozen evals are never edited: e2e/live/compact-hard (frozen at 32f57beb) and bench/m2 (frozen at 69077b8a). Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. No personal names, tenant ids or secrets.
Pace: commit + push within your first 15 tool calls; push after each step.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const M2 = `${base('m2')}\n\nTrack M2 (180 minutes, live cap $15). Round 1 result: exp/m2-b-shape (e35819e2) lifts main M2 87.6 -> 92.46 and heldout 96.52 -> 96.79, every oracle passed, GP-LIVE-ROUTING (Sonnet) pass, D3 4 ms, Edit-after-Read 3/3, unit 1411/1411. Only gate --all live T-GS6 (hook wall p95 <= 40 ms) failed: 41/42/41/73/48 ms, while base 69077b8a on the same host gave 44/39/86 ms (load 7-11).
1. T-GS6 A/B: build base (current v2-design) and b-shape; run bench/hook-gs6.mjs interleaved ABAB, 6 rounds each, same host, report p95 per round and the paired difference. If b-shape is not slower by more than 2 ms median paired, it is load, not regression. If it is slower, cut the cost (shape detector only above the replace threshold, lazy import of shape.ts, no work on small outputs) and re-measure.
2. Merge exp/m2-b-shape into v2-design (no force-push), resolve conflicts, unit + gate --all.
3. Close leak 1 from the diagnosis: non-ctx MCP tool output (mcp__*) is never replaced (heldout mcp-1 40,012 B -> 40,012 B) because the PostToolUse matcher in hooks/claude-code.json leaves mcp__* out. Also check heldout node-tests-1 and grep-1 (0% saving). Fix at the root for Claude Code (matcher + adapter decode of MCP tool_response content blocks; replacement must keep the MCP result shape the host accepts — check the 2.1.303 contract in ADR-0001 fixtures), with golden fixtures. Do the same in every adapter whose host gives a PostToolUse for MCP tools.
4. Score with bench/m2/eval.mjs on main and heldout (n=3, claude-sonnet-5-5), then confirm main once on claude-opus-5-5. Guards: every oracle passes, GP-LIVE-ROUTING pass, D3, Edit-after-Read, unit, gate --all.
5. Write docs/v2/spikes/m2/RESULT.md (round 1 candidates, why b-shape, T-GS6 A/B, the MCP fix, final numbers), update docs/v2/OPEN-ITEMS.md, the savings section of TECH-SPEC and docs/benchmarks pages that cite M2. Commit, push.
Return done, commits, numbers (main/heldout M2 before -> after, per workload bytes, T-GS6 A/B), summary.`

const CMP = `${base('cmp')}\n\nTrack compaction (240 minutes, live cap $25). Hard eval e2e/live/compact-hard (frozen 32f57beb), cmd: node e2e/live/compact-hard/run.mjs --bundle <release-out> --set main|heldout --n 3 --model claude-sonnet-5-5 --budget 1 --jobs 9 --raw <private-dir>. Baseline: direct 72.2%, v2 5.6%.
Round 1 findings (branches pushed, read their docs and code):
- Cause: (1) the 353 B pointer names no stored output; (2) PostToolUse replaced the 222 KB output with chunks picked by the command text, so the model never saw the values; (3) hooks index under the Claude Code session id but the MCP server uses "mcp:<serverId>" (src/entries/server.ts ~175), so scope:"session" search finds nothing. Direct wins because the host keeps the full output in a tool-results file and the compact summary keeps that path.
- exp/compact-a-ledger (572eaa46): BM25 line ledger in recall.ts (pickLines) -> main 27.3%, heldout 33.3%. In many failed sessions UserPromptSubmit after compaction gave EMPTY output (cause not found). pickRecall took 4-50 ms on a 222 KB row (budget risk).
- exp/compact-a-push (d319c003): MMR push block on the first prompt after compact -> 16.7% / 16.7%; hook p95 47.7 ms quiet.
- exp/compact-a-pull: plan only: session-id fix via CLAUDE_CODE_SESSION_ID, pointer lines for replaced outputs with exact ctx_search(source:<label>) handles, ctx_resume digest.
Do, on branch exp/compact-r2 from v2-design, test-first, measure each step on main (keep a step only if main rises and guards hold):
1. Session-id fix (a-pull plan 1): the MCP server resolves the same session id the hooks use, per adapter where the host exposes it; fall back stays. Prove scope:"session" search finds hook-indexed rows in a live session.
2. Find and fix the empty UserPromptSubmit output after compaction (transcripts from a-ledger in /private/tmp/cm-v2-impl-private/compact-m2/). Root cause with evidence.
3. Retrieval handle in every replacement: the PostToolUse replacement text names the stored source label, size and the exact ctx_search call, so the model's own compact summary keeps it (same effect that makes direct win). Keep the prompt lint and the replacement byte budget.
4. Ledger lines (a-ledger pickLines) moved to PostToolUse precompute: index line candidates with their indent context when the output is stored, so the post-compact hook only runs one ranked query (D3 budget). Deliver at the first UserPromptSubmit after compaction and in ctx_resume.
5. Measure main, then heldout once; confirm the final build on claude-opus-5-5 (main, n=2). Guards: GP6 and all compaction e2e cases, the old 10/10 probe, tokens added after compaction <= 2,000, D3 check, bench/hook-gs6 no regression vs base (interleaved), unit, gate --all. If GP6 hangs, find why (do not just stop it).
6. If main beats 27.3% and guards pass: merge exp/compact-r2 into v2-design. Update ADR-0009, docs/v2/spikes/compact/RESULT.md (all round 1 + round 2 numbers, losses, gap to direct), OPEN-ITEMS.md. Commit, push.
Return done, commits, numbers (main/heldout per step, direct baseline, opus confirm, guards), summary.`

phase('Work')
const [m2, cmp] = await parallel([
  () => run(M2, 'r2-m2', 'Work', RESULT, OPH),
  () => run(CMP, 'r2-cmp', 'Work', RESULT, OPH),
])

phase('Check')
const checks = await parallel([
  () => run(`${base('ckm2')}\n\nRole: adversarial checker, M2. Claimed: ${JSON.stringify(m2).slice(0, 2500)}. Fresh clone of v2-design. (1) bench/m2 files unchanged since 69077b8a. (2) Re-run bench/m2/eval.mjs main and heldout yourself (sonnet, n=2, cap $6) and compare with RESULT.md. (3) Read the merged shape.ts and MCP replacement code: no truncation or regex as the saving; JSON/line parsers only; MCP result shape valid for the host. (4) unit + gate --all. Fix wrong doc numbers in place; report real defects. Return pass, problems, summary.`, 'r2-ck-m2', 'Check', CHECK, OPH),
  () => run(`${base('ckcmp')}\n\nRole: adversarial checker, compaction. Claimed: ${JSON.stringify(cmp).slice(0, 2500)}. Fresh clone of v2-design (or exp/compact-r2 if not merged). (1) e2e/live/compact-hard unchanged since 32f57beb. (2) Re-run main and heldout yourself (sonnet, n=2, cap $8), compare with RESULT.md. (3) Read the code: no truncation/regex as the recall mechanism, no instruction-file writes, hook D3 holds, tokens after compaction <= 2,000. (4) unit + gate --all. Fix wrong doc numbers in place; report real defects. Return pass, problems, summary.`, 'r2-ck-cmp', 'Check', CHECK, OPH),
])

phase('Final')
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all three times, build/check-removed.mjs, check-install-docs.mjs, check-readme.mjs, check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'r2-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer on v2-design. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'r2-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'r2-ci', phase: 'Final', ...SNM })
return { m2, cmp, checks, gate: g, ci }
