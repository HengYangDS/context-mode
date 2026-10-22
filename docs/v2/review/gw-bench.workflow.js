export const meta = {
  name: 'v1-v2-gateway-bench',
  description: 'Publishable benchmark: direct vs OSS v1 vs OSS v2 measured on the published gateway workloads, gateway rows reused from the 89 published evidence files, small drift bridge, web-docs style page',
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
- Tenants: every workload runs in its own new disposable tenant. The owner tenant (id in the private ledger only) is forbidden; the harness must refuse it.
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


const PUB = `${WEB}/static/benchmarks/data`
const EVID = `Published gateway evidence (owner, 2026-10-21: reuse it, do not re-measure the gateway from scratch): ${PUB}/v3-opus55-short.json (Opus 5.5, Claude Code 2.1.283, 2026-09-29, harness start-cost-ab, schema context-mode.benchmark-evidence/2, workloads tests/json/log/git/grep/edit, 12-16 pairs each, arms plain vs gateway), plus final-opus55-tests-W3-minitest-W4.json, v4-opus55-W1-W2-W3-W4.json, final-haiku45.json, and ${WEB}/static/benchmarks/long-session and recall (index.json in each). 89 JSON files in total.`

phase('Prereg')
const plan = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\n${EVID}\n\nRole: benchmark designer. Write the pre-registration ${OUT}/prereg.md in the OSS repo (fresh clone ${OSS}, branch v2-design) in the web prereg template. Fixed decisions (owner, 2026-10-21):
- The gateway rows come from the published evidence files above, unchanged; cite file and workload id. Do not re-run them.
- New measured arms, on the SAME workloads as v3-opus55-short.json (tests, json, log, git, grep, edit), same harness (the gateway repo's start-cost-ab harness, same task setup, corpus and oracle), same model claude-opus-5-5: direct (plain, measured again now), v1 (OSS plugin from origin/main, record version and sha), v2 (OSS plugin from origin/v2-design release-out, record sha). Every arm: same Claude Code binary, fresh config dir, --strict-mcp-config, same isolation env. Per task: 1 warm-up cycle (not counted) + 8 cycles, each cycle runs direct, v1, v2 back to back, order rotated. 6 x 9 x 3 = 162 sessions.
- Each OSS arm is compared with the direct arm measured in the same cycles (paired). The gateway row is compared with its own published plain arm. The page says plainly that gateway rows are from 2026-09-29 on Claude Code 2.1.283 and the OSS rows are from today on the current Claude Code version, so the comparison is "saving vs each arm's own direct baseline", not raw dollars across dates.
- Bridge check (to detect drift since 2026-09-29): per task 2 extra pairs of plain vs gateway on today's client, new disposable tenant per workload, default settings. Reported as a drift check only, never merged into the published rows.
- Cost: list price on the token counts Anthropic returned, same price table as the evidence file (record it). Analysis exactly as the evidence file's analysis_method (mean saving %, 95% t interval, verdict less/more/same, head-to-head). All rows shown, wins and losses. Void only on arm-resolution failure, with reason, re-run once.
- --max-budget-usd 1.5 per session; stop rule at $50 total list-price value.
Commit and push the prereg BEFORE any measured run. Return tasks (the 6 ids), pairsPerTask 8, prereg path, commit, summary.`,
  { label: 'prereg', phase: 'Prereg', schema: PLAN, ...OPH })

phase('Harness')
const harness = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\n${EVID}\n\nPre-registration: ${JSON.stringify(plan)}.
Role: harness engineer. git -C ${GW} worktree add -b bench/v1-v2-gw ${WT} HEAD (reuse if it exists). Find the start-cost-ab harness that produced v3-opus55-short.json and extend it (in the worktree only) with arms v1 and v2 (plugin dirs: your own clone of OSS origin/main built as the OSS notes say; OSS origin/v2-design release-out). Keep every safety assertion (claude version, credential copy, owner tenant refusal, plugin-state check, strict MCP). Output the same evidence schema (context-mode.benchmark-evidence/2) with arms plain, v1, v2, plus per run arm-resolution evidence (plugin tools in init, distinct versions; gateway record for bridge runs). Local commits only.
Smoke: one task x arms plain, v1, v2, gateway x 1 on claude-haiku-4-5-20251001. Pass only if each arm resolves by transcript/record evidence. Copy the harness as a patch to the OSS repo bench/gateway-ab/harness.patch + README.md (how to run, no secrets), commit, push. Return done (true only if smoke passed), commits, numbers, summary.`,
  { label: 'harness', phase: 'Harness', schema: RESULT, ...OPH })
if (!harness || !harness.done) return { stopped: 'harness smoke failed', plan, harness }

phase('Run')
const runs = await parallel((plan.tasks || []).map((t) => () => agent(`${RULES}\n\nPre-registration: ${JSON.stringify(plan)}. Harness: ${JSON.stringify(harness).slice(0, 2500)}.
Role: runner for task ${t} only. In ${WT} run the warm-up cycle, then ${plan.pairsPerTask} measured cycles of plain, v1, v2 for task ${t} on claude-opus-5-5 per the prereg, then the 2 bridge pairs (plain vs gateway, new disposable tenant). After EVERY cycle append the run lines to ${OUT}/runs/${t}.jsonl in your own OSS clone /private/tmp/cm-gwb-run-${t} (v2-design), commit and push (tenant ids withheld). Voids per prereg. Stop if the stop rule is hit. Delete your clone at the end. Return done, commits, numbers (per arm: runs, success, mean cost, voids; bridge: gateway saving vs plain), summary.`,
  { label: `run-${t}`, phase: 'Run', schema: RESULT, ...SNM })))

phase('Publish')
const page = await agent(`${RULES}\n\nContext from readers:\n${ctx}\n\n${EVID}\n\nPre-registration: ${JSON.stringify(plan)}. Runner results: ${JSON.stringify(runs).slice(0, 6000)}.
Role: analyst and writer. Fresh OSS clone ${OSS} (v2-design). Write ${OUT}/analyze.mjs (deterministic: reads runs/*.jsonl and the published gateway evidence JSON, applies the prereg analysis) and produce ${OUT}/ab.json (schema context-mode.benchmark-evidence/2: OSS pairs, gateway rows cited from the published files with their source_file and workload id, bridge result separately, versions, shas, dates, prereg commit; tenant ids withheld) and ${OUT}/index.json. Write ${OUT}/README.md in the web benchmark page style (lead sentence with headline numbers linked to JSON, Key facts: What it is, Who it is for, Clients, Measured result, Limits; one table per task category with columns Category and task | Direct | v1 | v2 | Context Mode Gateway | saving vs own direct with "likely" range | Head-to-head | Evidence; How we measured; Verify it yourself; Sources). Show all rows, wins and losses; say where an arm cost more; state the date/client difference of the gateway rows and the bridge drift result. Plain short sentences. Link it from docs/benchmarks/README.md. Commit, push. Return done, commits, numbers (headline per arm), summary.`,
  { label: 'analyze-write', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. Fresh OSS clone (v2-design). Recompute every number in ${OUT}/README.md and ab.json with your own separate script from runs/*.jsonl and the published gateway JSON in ${PUB} (do not reuse analyze.mjs). Check: prereg commit before the first run; no run dropped outside the exclusion rule; every void has a reason; gateway rows match the published files exactly; no secret or tenant id in any file; each plugin run shows its plugin's tools; links resolve. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'check', phase: 'Publish', schema: CHECK, ...OPH })
return { plan, harness, runs, page, check }
