export const meta = {
  name: 'v1-v2-gateway-bench',
  description: 'Publishable paired benchmark: direct vs OSS v1 vs OSS v2 vs Context Mode Gateway, real claude -p, pre-registered, web-docs style page + evidence JSON',
  phases: [
    { title: 'Read', detail: 'gateway docs + harness, web benchmark docs, OSS v2 benchmarks' },
    { title: 'Prereg', detail: 'plan committed before the first pair' },
    { title: 'Harness', detail: 'four-arm harness: arms direct, v1, v2, gateway; smoke' },
    { title: 'Run', detail: 'one agent per task, results pushed per pair' },
    { title: 'Publish', detail: 'analysis, page, evidence, adversarial number check' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }

const GW = '/Users/mksglu/Server/Mert/context-mode-sandbox'
const WEB = '/Users/mksglu/Server/Mert/context-mode-web-2026-10'
const WT = '/private/tmp/cm-gwb-wt'          // sandbox worktree, local branch bench/v1-v2-gw, NEVER pushed
const OSS = '/private/tmp/cm-gwb-oss'       // OSS clone, branch v2-design, pushed
const OUT = 'docs/benchmarks/v1-v2-gateway' // in the OSS repo

const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const NOTES = { type: 'object', properties: { notes: { type: 'string' } }, required: ['notes'] }
const PLAN = { type: 'object', properties: {
  tasks: { type: 'array', items: { type: 'string' } }, pairsPerTask: { type: 'number' }, prereg: { type: 'string' },
  commit: { type: 'string' }, summary: { type: 'string' } }, required: ['tasks', 'pairsPerTask', 'prereg', 'commit', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }

const RULES = `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Hard rules:
- Gateway repo ${GW}: READ ONLY. Never edit it, never git push it (push equals production deploy). All harness work happens in the git worktree ${WT} (local branch bench/v1-v2-gw); commit there locally, never push that branch.
- Web repo ${WEB}: READ ONLY. Never edit, commit or push it.
- The OSS repo (github.com/mksglu/context-mode) branch v2-design, clone ${OSS}: here you may commit and push (owner approved; push without asking; git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never npm.
- Never write a secret (admin key, OAuth token, credential, tenant id of a real account) into any file, commit or log. Evidence files withhold tenant ids, the way the web evidence does.
- Tenants: every workload runs in its own new disposable tenant. The owner tenant t_1b9423c0 is forbidden; the harness must refuse it.
- Follow ${GW}/CLAUDE.md: the transcript and the gateway's per-call record are the evidence, never model prose; no regex, no truncation of evidence; explicit --model; </dev/null on every claude -p; fail closed (a non-200 or unknown shape is an error); an unexercised link is INCONCLUSIVE, not a pass.
- Never use the user's own checkout /Users/mksglu/Server/Mert/context-mode for v1: use your own clone of origin/main.
- Write no personal names.`

phase('Read')
const reads = await parallel([
  () => agent(`${RULES}\n\nRead EVERY doc that bears on measuring and publishing savings in the gateway repo ${GW}: CLAUDE.md, docs/SAVINGS.md, docs/PERF.md, docs/PERF-AUDIT-WORKFLOW.md, docs/adr/0004*, docs/adr/0010*, docs/adr/0011*, docs/prd/oss-vs-gateway-context-saving.md, docs/prd/oss-vs-gateway-measured-2026-08.md, docs/recon/savings-*.md, docs/recon/codemode-saving-*.md, docs/verify/four-arm-protocol.md and any docs/verify/*bench*/*arm* file, scripts/gw-bench.mjs, tests/fourarm/* (README, config, runner, cell, matrix, cost, analyze, gates, smoke, probe-tenant), tests/e2e-saving.mjs. Return notes (dense, plain): how a session is routed through the gateway (env, base URL, headers), how a fresh tenant/account is made and at what default settings (memory, skills, Protect), how cost is taken for the gateway arm (per-call record, hidden calls) and for direct (Claude Code total), how the plugin arm is set (--plugin-dir, --strict-mcp-config, config dir recipe, keychain credential copy), the corpus/tasks and their oracles, the analysis method, every documented pitfall, and exact file:function names to extend for arms direct, v1, v2, gateway.`,
    { label: 'read-gateway', phase: 'Read', schema: NOTES, ...SNH }),
  () => agent(`${RULES}\n\nRead the published benchmark style in the web repo ${WEB}: dist/docs/benchmarks.md, dist/benchmarks/full.md, dist/docs/how-saving-works.md, dist/context-saving.md, pages/docs/benchmarks.html, every static/benchmarks/prereg/*.md, and the evidence JSON format (find benchmarks/data/*.json, long-session/*.json, recall/*.json under static or dist). Return notes: the page outline (lead sentence, Key facts, per-category tables and their exact columns, How we measured, Verify it yourself, Sources), the wording rules visible in it, the prereg template (sections, what is fixed in advance, stopping and exclusion rules), the evidence JSON schema (per pair fields, analysis fields, what is withheld), the statistics used (mean cost, "likely" 95% range method, win rule, per-1,000-tasks), and the exact Opus 5.5 short-task list with each task's setup so the same tasks can be re-run.`,
    { label: 'read-web', phase: 'Read', schema: NOTES, ...SNH }),
  () => agent(`${RULES}\n\nIn the OSS repo (clone github.com/mksglu/context-mode to /private/tmp/cm-gwb-read, branch v2-design; delete it at the end) read docs/benchmarks/README.md, docs/benchmarks/data/*, docs/v2/benchmarks.md, bench/live/ab-quick.mjs, bench/live/score-tasks.mjs, docs/install/claude-code.md, docs/v2/review/RELEASE-REHEARSAL-2026-10-21.md. Return notes: how to build v2 as a Claude Code plugin dir (release-out), how v1 (origin/main) is built as a local plugin dir (the commands ab-quick used, version 1.0.169), the isolation env used (ENABLE_CLAUDEAI_MCP_SERVERS=false, CLAUDE_CODE_DISABLE_AUTO_MEMORY=1, CLAUDE_CODE_DISABLE_CLAUDE_MDS=1), the latest v1/v2/off numbers to cross-check against, and known pitfalls (real claude binary vs shim, hook payload, persisted output at 30 KB).`,
    { label: 'read-oss', phase: 'Read', schema: NOTES, ...SNM }),
])
const ctx = reads.filter(Boolean).map((r, i) => `### ${['gateway', 'web', 'oss'][i]}\n${r.notes}`).join('\n\n').slice(0, 30000)

phase('Prereg')
const plan = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\nRole: benchmark designer. Write the pre-registration ${OUT}/prereg.md in the OSS repo (clone ${OSS} fresh, branch v2-design) in the same template as the web prereg files. Fixed decisions (owner, 2026-10-21):
- Arms: direct (no plugin, no gateway), v1 (OSS plugin built from origin/main, record its version and sha), v2 (OSS plugin built from origin/v2-design release-out, record sha), gateway (Context Mode Gateway, the live production URL the harness uses, a new tenant per workload, default settings: memory on, skills on with none imported, Protect off — record them; no plugin). Every arm: same Claude Code binary and version, fresh config dir, --strict-mcp-config, the same isolation env, same cwd shape and corpus bytes.
- Model: claude-opus-5-5, so rows compare with the published Opus 5.5 page. Tasks: the published Opus 5.5 short tasks (code search, one-line edit, repo history, one large log, one large JSON file, npm test fix loop short) with their oracles.
- Design: per task 8 cycles; each cycle runs all 4 arms back to back, arm order rotated by a Latin square; 1 warm-up cycle per task that does not count. 6 tasks x 9 cycles x 4 arms = 216 sessions.
- Cost: list price on the token counts Anthropic returned; direct/v1/v2 from Claude Code's own usage, gateway from the gateway per-call record including hidden calls (cross-check against Claude Code's total and report both).
- Analysis per task and per comparison (v1, v2, gateway each vs direct; v2 vs v1; v2 vs gateway): mean cost per arm, saving %, "likely" 95% range by the same method as the web page, head-to-head count, task success per arm. A row counts as a win only when the whole range is below zero. ALL rows are shown, wins and losses (no row is dropped). Exclusion rule: only runs whose arm failed to resolve (plugin not loaded, gateway not in path, auth error) are void, listed with their reason, and re-run once.
- Session cap --max-budget-usd 1.5; stop rule: total list-price value above $60 stops the run.
Commit and push the prereg BEFORE any measured run; return its commit sha. Return tasks (ids), pairsPerTask 8, prereg (path), commit, summary.`,
  { label: 'prereg', phase: 'Prereg', schema: PLAN, ...OPH })

phase('Harness')
const harness = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\nPre-registration: ${JSON.stringify(plan)}.
Role: harness engineer. Create the worktree: git -C ${GW} worktree add -b bench/v1-v2-gw ${WT} HEAD (if it exists, reuse it). Extend tests/fourarm (or a sibling dir tests/v1v2gw that imports its pieces) so the arms are exactly direct, v1, v2, gateway as the prereg says: v1 plugin dir = your own clone of OSS origin/main built as the OSS notes say; v2 plugin dir = OSS origin/v2-design release-out. Keep every existing safety assertion (claude version, credential copy, tenant refusal of t_1b9423c0, plugin-state check, strict MCP). Each run writes one whole JSON line (no cut) with: task, cycle, arm, order, session id, transcript path, per-turn usage, cost (both sources for gateway), oracle result, arm-resolution evidence (plugin loaded: init tools list; gateway: the gateway per-call record found for that session), void reason if any. Commit in the worktree (local only).
Smoke: one task x 4 arms x 1 cycle on claude-haiku-4-5-20251001 (cheap). Pass only if each arm resolves by evidence from the transcript/record (v1 and v2 plugin tools present and distinct versions; gateway calls recorded under a non-owner tenant; direct has neither). Copy the harness as a patch (git format-patch from the worktree) to the OSS repo bench/gateway-ab/harness.patch plus bench/gateway-ab/README.md (how to run, no secrets), commit, push. Return done (true only if smoke passed), commits, numbers (smoke per arm: tokens, cost, resolution evidence), summary.`,
  { label: 'harness', phase: 'Harness', schema: RESULT, ...OPH })
if (!harness || !harness.done) return { stopped: 'harness smoke failed', plan, harness }

phase('Run')
const runs = await parallel((plan.tasks || []).map((t) => () => agent(`${RULES}\n\nPre-registration: ${JSON.stringify(plan)}. Harness: ${JSON.stringify(harness).slice(0, 2500)}.
Role: runner for task ${t} only. In the worktree ${WT} run the warm-up cycle, then ${plan.pairsPerTask} measured cycles of all 4 arms for task ${t} on claude-opus-5-5, exactly per the prereg (Latin-square order, fresh tenant per workload, fresh config dir per run). After EVERY cycle append the run lines to ${OUT}/runs/${t}.jsonl in your own OSS clone /private/tmp/cm-gwb-run-${t} (branch v2-design), commit and push (tenant ids withheld). Void runs: record the reason, re-run once, as the prereg says. If the stop rule is hit, stop and say so. Delete your OSS clone at the end. Return done, commits, numbers (per arm: runs, success, mean cost, voids), summary.`,
  { label: `run-${t}`, phase: 'Run', schema: RESULT, ...SNM })))

phase('Publish')
const page = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\nPre-registration: ${JSON.stringify(plan)}. Runner results: ${JSON.stringify(runs).slice(0, 6000)}.
Role: analyst and writer. In a fresh OSS clone ${OSS} (v2-design): write ${OUT}/analyze.mjs (deterministic, reads runs/*.jsonl, applies the prereg analysis exactly) and run it to produce ${OUT}/ab.json (evidence file in the web evidence schema: per pair fields, per row analysis, versions, shas, dates, prereg commit; tenant ids withheld) and ${OUT}/index.json. Then write ${OUT}/README.md in the web benchmark page style: lead sentence with the headline numbers and links to the JSON, Key facts (What it is, Who it is for, Clients, Measured result, Limits), one table per comparison with the web columns (Category and task | Saved | Direct | arm | Per 1,000 tasks | Head-to-head | Evidence), How we measured, Verify it yourself, Sources. Show all rows, wins and losses; say plainly where an arm cost more. Plain words, short sentences, every number linked to its JSON. Link it from docs/benchmarks/README.md. Commit, push. Return done, commits, numbers (headline per comparison), summary.`,
  { label: 'analyze-write', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. In a fresh OSS clone (v2-design) re-run ${OUT}/analyze.mjs from the raw runs/*.jsonl with your own independent recomputation (write a separate small script; do not reuse analyze.mjs functions) and compare every number, range and count in ${OUT}/README.md and ab.json. Check: prereg commit time is before the first run's timestamp; no run is missing or dropped outside the prereg exclusion rule; every void has a reason; no secret or tenant id in any file; each gateway run has a gateway record and each plugin run has its plugin's tools; links resolve. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'check', phase: 'Publish', schema: CHECK, ...OPH })
return { plan, harness, runs, page, check }
