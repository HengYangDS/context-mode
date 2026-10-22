export const meta = {
  name: 'tryit-bench',
  description: 'README "Try it" prompts through direct, OSS v1, OSS v2 and Context Mode Gateway: pre-registered, real claude -p, evidence JSON, page in the published benchmark style, adversarial check',
  phases: [
    { title: 'Prereg', detail: 'plan + harness workloads, smoke' },
    { title: 'Run', detail: 'one runner per prompt, results pushed per cycle' },
    { title: 'Publish', detail: 'analysis, page, adversarial number check' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const GW = '/Users/mksglu/Server/Mert/context-mode-sandbox'
const WEB = '/Users/mksglu/Server/Mert/context-mode-web-2026-10'
const WT = '/private/tmp/cm-gwb-wt'
const OUT = 'docs/benchmarks/try-it'
const PROMPTS = ['repo-research', 'git-history', 'web-scrape', 'large-json', 'docs-search', 'session-continuity']

const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }

const RULES = `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
- Gateway repo ${GW} and web repo ${WEB}: READ ONLY, never push (gateway push = production deploy). Harness work only in the existing worktree ${WT} (local branch bench/v1-v2-gw, never pushed; it already runs arms plain, v1, v2, gateway via scripts/e2e/start-cost-ab-arms.mjs, with --gw https://gateway.context-mode.com).
- OSS repo github.com/mksglu/context-mode branch v2-design: commit and push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never npm.
- Never write a secret or tenant id into any public file, commit or log. Owner tenant t_1b9423c0 is forbidden; new disposable tenant per prompt.
- Follow ${GW}/CLAUDE.md: the transcript and the gateway per-call record are the evidence, never model prose; no regex, no truncation of evidence; explicit --model; </dev/null; fail closed; an unexercised link is INCONCLUSIVE.
- Method and evidence schema: the same as docs/benchmarks/v1-v2-gateway (prereg.md, analyze.mjs, ab.json schema context-mode.benchmark-evidence/2, t at df = n - 1).
- Write no personal names.`

phase('Prereg')
const plan = await agent(`${RULES}\n\nRole: designer + harness engineer. The OSS README on origin/main has a "Try It" section with 6 prompts (deep repo research of modelcontextprotocol/servers; git history of facebook/react, last 500 commits; Hacker News front page scrape; local 7.5 MB JSON server with a secret at index 13000; React useEffect docs search; session continuity: Express REST API, 20+ tool calls). Read them verbatim from origin/main README.md and the claims printed next to each (e.g. "62 KB context, raw 986 KB, 94% saved").
1. Write ${OUT}/prereg.md (same template as docs/benchmarks/v1-v2-gateway/prereg.md) and commit + push it BEFORE any measured run. Fixed decisions:
   - Arms: plain (direct), v1 (origin/main, record sha/version), v2 (origin/v2-design release-out, record sha), gateway (live, default settings, new tenant per prompt). Same Claude Code binary, fresh config dir, --strict-mcp-config, same isolation env.
   - Model claude-opus-5-5 (same as the v1-v2-gateway page).
   - Prompt text: verbatim, minus the trailing "Then run /context-mode:ctx-stats." sentence (it only exists in v1; dropping it in every arm keeps the arms equal). Write the exact text used per prompt.
   - Prompts 1-5: 1 warm-up cycle + 4 measured cycles, each cycle runs the 4 arms back to back, order rotated. Prompt 6 (session continuity) is long: 2 measured cycles, reported as a demonstration, not a result.
   - Oracle per prompt, deterministic, from the transcript/tool results, never model prose: e.g. large-json: the hidden record's content appears in the final answer exactly; git-history: the answer names a top contributor that git shortlog over the same 500 commits confirms; web-scrape / repo-research / docs-search: the run ended with end_turn, made at least one fetch, and the answer is non-empty (state plainly these are completion checks, not quality checks).
   - Metrics per run: list-price cost (gateway from its per-call record, checked against the client total), total input+output tokens, bytes of tool_result the model saw (sum over the transcript), tool calls, wall time, success.
   - Also check each README claim against the v1 arm's measured bytes and say true / false / not measurable.
   - --max-budget-usd 3 per session, --max-turns 60; stop rule $80 total list-price value.
2. Add these workloads to the harness in ${WT} (local commits only): workload setup (empty temp cwd; for large-json no extra setup, the model builds the server), prompt text, oracle. Keep every safety assertion.
3. Smoke: large-json, 4 arms x 1 on claude-haiku-4-5-20251001. Pass only if every arm resolves by transcript/record evidence. Update bench/gateway-ab/harness.patch in the OSS repo. Commit, push.
Return done (true only if prereg pushed and smoke passed), commits, numbers (prereg commit, smoke per arm), summary.`,
  { label: 'tryit-prereg', phase: 'Prereg', schema: RESULT, ...OPH })
if (!plan || !plan.done) return { stopped: 'prereg or smoke failed', plan }

phase('Run')
const runs = await parallel(PROMPTS.map((p) => () => agent(`${RULES}\n\nPre-registration: ${JSON.stringify(plan).slice(0, 3000)} (read ${OUT}/prereg.md on origin/v2-design for the exact text).
Role: runner for prompt ${p} only. In ${WT} run the warm-up and measured cycles for ${p} exactly as the prereg says, claude-opus-5-5, --gw https://gateway.context-mode.com. After EVERY cycle append the run lines to ${OUT}/runs/${p}.jsonl in your own clone /private/tmp/cm-tryit-${p} (v2-design), commit and push (tenant ids withheld). Void only on arm-resolution failure, with reason, re-run once. Stop if the stop rule is hit. Keep raw transcripts in /private/tmp/cm-v2-impl-private/tryit/${p}. Delete the clone at the end. Return done, commits, numbers (per arm: runs, success, mean cost, mean tool_result bytes seen), summary.`,
  { label: `tryit-${p}`, phase: 'Run', schema: RESULT, ...SNM })))

phase('Publish')
const page = await agent(`${RULES}\n\nPrereg: ${JSON.stringify(plan).slice(0, 2000)}. Runner results: ${JSON.stringify(runs).slice(0, 6000)}.
Role: analyst and writer. Fresh OSS clone (v2-design). Write ${OUT}/analyze.mjs (deterministic, prereg analysis) and produce ${OUT}/ab.json and ${OUT}/index.json. Write ${OUT}/README.md in the style of docs/benchmarks/v1-v2-gateway/README.md and the web benchmark page: lead sentence with the headline numbers linked to JSON; Key facts; one table per prompt (Direct | v1 | v2 | Context Mode Gateway: mean cost, saving vs direct with likely range, tool_result bytes seen, success k/n, head-to-head); a table "README claims checked" (claim, measured, true/false); How we measured; Verify it yourself; Sources. With n=4, say plainly where the range crosses zero. Show all rows, wins and losses. Link it from docs/benchmarks/README.md. Commit, push. Return done, commits, numbers, summary.`,
  { label: 'tryit-write', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. Fresh OSS clone (v2-design). Recompute every number in ${OUT}/README.md and ab.json with your own separate script from runs/*.jsonl (do not reuse analyze.mjs). Check: prereg commit before the first run; no run dropped outside the exclusion rule; every gateway run has a gateway record; every plugin run shows its plugin's tools; oracle values come from transcripts/tool results; no secret or tenant id in any file; links resolve. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'tryit-check', phase: 'Publish', schema: CHECK, ...OPH })
return { plan, runs, page, check }
