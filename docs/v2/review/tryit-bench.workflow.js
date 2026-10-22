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
- Never write a secret or tenant id into any public file, commit or log. The owner tenant (id in the private ledger only) is forbidden; new disposable tenant per prompt.
- Follow ${GW}/CLAUDE.md: the transcript and the gateway per-call record are the evidence, never model prose; no regex, no truncation of evidence; explicit --model; </dev/null; fail closed; an unexercised link is INCONCLUSIVE.
- Method and evidence schema: the same as docs/benchmarks/v1-v2-gateway (prereg.md, analyze.mjs, ab.json schema context-mode.benchmark-evidence/2, t at df = n - 1).
- Write no personal names.`

phase('Prereg')
// First run (wf_fce5cd32-d7c) read for 2h40m and committed nothing. Facts are given here; each step has a hard pace rule.
const PACE = 'Pace (hard rule): the facts below are verified; do not re-read docs to confirm them. Commit+push within your first 12 tool calls; commit+push after each step; be done within 30 minutes. If blocked, commit what you have and return done=false with the blocker in one line.'
const TEXTS = {
  'repo-research': 'Research https://github.com/modelcontextprotocol/servers — architecture, tech stack, top contributors, open issues, and recent activity.',
  'git-history': 'Clone https://github.com/facebook/react and analyze the last 500 commits: top contributors, commit frequency by month, and most changed files.',
  'web-scrape': 'Fetch the Hacker News front page, extract all posts with titles, scores, and domains. Group by domain.',
  'large-json': 'Create a local server that returns a 7.5 MB JSON with 20,000 records and a secret hidden at index 13000. Fetch the endpoint, find the hidden record, and show me exactly what\'s in it.',
  'docs-search': 'Fetch the React useEffect docs, index them, and find the cleanup pattern with code examples.',
  'session-continuity': 'Start a multi-step task: Create a REST API with Express — add routes, tests, and error handling.',
}
const CLAIMS = 'README claims on origin/main: repo-research "5 calls, 62 KB context (raw: 986 KB, 94% saved)"; git-history "1 call, 5.6 KB context"; web-scrape "1 call, 3.2 KB context"; large-json "7.5 MB raw -> 0.9 KB context (99% saved)"; docs-search "2 calls, 1.8 KB context"; session-continuity "compaction recovery with full state".'
const HARNESS = 'Harness facts: worktree /private/tmp/cm-gwb-wt (local branch bench/v1-v2-gw, head e9c8539a, clean). Runner scripts/e2e/start-cost-ab-arms.mjs (--arms plain,v1,v2,gateway, --gw https://gateway.context-mode.com, --n, --bridge, --resume). Workloads are defined in scripts/e2e/short-workloads.mjs (each: prompt, fixture setup fx, oracle ok). Analysis helpers pairedPct / pairedDiff in scripts/e2e/start-cost-ab-lib.mjs. The page template is docs/benchmarks/v1-v2-gateway/{prereg.md,README.md,analyze.mjs} in the OSS repo.'

const pre = await agent(`${RULES}\n\n${PACE}\n\n${CLAIMS}\nPrompt texts (README text minus the trailing ctx-stats sentence): ${JSON.stringify(TEXTS)}\n\nRole: prereg writer. Fresh OSS clone /private/tmp/cm-tryit-pre (v2-design). Copy docs/benchmarks/v1-v2-gateway/prereg.md to ${OUT}/prereg.md and adapt it: arms plain, v1 (origin/main, record sha), v2 (origin/v2-design release-out, record sha), gateway (live, default settings, new tenant per prompt); model claude-opus-5-5; the 6 prompt texts verbatim; prompts 1-5: 1 warm-up + 4 measured cycles, order rotated; session-continuity: 2 cycles, demonstration only; oracles: large-json = the hidden record value appears in the final answer exactly; git-history = the answer names the top author that git shortlog -sn over the same 500 commits gives; the other three = end_turn, at least one fetch/tool call, non-empty answer (completion check, not quality); metrics: list-price cost (gateway from its per-call record), tokens, tool_result bytes seen, tool calls, success; README claims checked against v1 bytes; --max-budget-usd 3, --max-turns 60, stop at $80 total. Commit, push, delete the clone. Return done, commits (the prereg sha), numbers, summary.`,
  { label: 'tryit-prereg2', phase: 'Prereg', schema: RESULT, ...SNM })
if (!pre || !pre.done) return { stopped: 'prereg not written', pre }

const plan = await agent(`${RULES}\n\n${PACE}\n\n${HARNESS}\nPrereg: ${JSON.stringify(pre).slice(0, 1500)} (${OUT}/prereg.md on origin/v2-design).\nPrompt texts: ${JSON.stringify(TEXTS)}\n\nRole: harness engineer. In /private/tmp/cm-gwb-wt add a new file scripts/e2e/tryit-workloads.mjs with the 6 workloads (same shape as short-workloads.mjs: empty temp cwd fixture, prompt text, oracle per the prereg) and let start-cost-ab-arms.mjs load it with --workloads tryit. Local commits only. Smoke: large-json, arms plain,v1,v2,gateway, 1 cycle, claude-haiku-4-5-20251001, --gw https://gateway.context-mode.com. Pass only if each arm resolves by init/record evidence. Copy the change as a patch to the OSS repo bench/gateway-ab/tryit.patch (own clone /private/tmp/cm-tryit-h, delete after), commit, push. Return done (true only if smoke passed), commits, numbers (smoke per arm), summary.`,
  { label: 'tryit-harness', phase: 'Prereg', schema: RESULT, ...OPH })
if (!plan || !plan.done) return { stopped: 'harness smoke failed', pre, plan }

phase('Run')
const runs = await parallel(PROMPTS.map((p) => () => agent(`${RULES}\n\nPre-registration: ${JSON.stringify(plan).slice(0, 3000)} (read ${OUT}/prereg.md on origin/v2-design for the exact text).
${PACE.replace('be done within 30 minutes','be done within 120 minutes')}\nRole: runner for prompt ${p} only (--workloads tryit). In ${WT} run the warm-up and measured cycles for ${p} exactly as the prereg says, claude-opus-5-5, --gw https://gateway.context-mode.com. After EVERY cycle append the run lines to ${OUT}/runs/${p}.jsonl in your own clone /private/tmp/cm-tryit-${p} (v2-design), commit and push (tenant ids withheld). Void only on arm-resolution failure, with reason, re-run once. Stop if the stop rule is hit. Keep raw transcripts in /private/tmp/cm-v2-impl-private/tryit/${p}. Delete the clone at the end. Return done, commits, numbers (per arm: runs, success, mean cost, mean tool_result bytes seen), summary.`,
  { label: `tryit-${p}`, phase: 'Run', schema: RESULT, ...SNM })))

phase('Publish')
const page = await agent(`${RULES}\n\nPrereg: ${JSON.stringify(plan).slice(0, 2000)}. Runner results: ${JSON.stringify(runs).slice(0, 6000)}.
Role: analyst and writer. Fresh OSS clone (v2-design). Write ${OUT}/analyze.mjs (deterministic, prereg analysis) and produce ${OUT}/ab.json and ${OUT}/index.json. Write ${OUT}/README.md in the style of docs/benchmarks/v1-v2-gateway/README.md and the web benchmark page: lead sentence with the headline numbers linked to JSON; Key facts; one table per prompt (Direct | v1 | v2 | Context Mode Gateway: mean cost, saving vs direct with likely range, tool_result bytes seen, success k/n, head-to-head); a table "README claims checked" (claim, measured, true/false); How we measured; Verify it yourself; Sources. With n=4, say plainly where the range crosses zero. Show all rows, wins and losses. Link it from docs/benchmarks/README.md. Commit, push. Return done, commits, numbers, summary.`,
  { label: 'tryit-write', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. Fresh OSS clone (v2-design). Recompute every number in ${OUT}/README.md and ab.json with your own separate script from runs/*.jsonl (do not reuse analyze.mjs). Check: prereg commit before the first run; no run dropped outside the exclusion rule; every gateway run has a gateway record; every plugin run shows its plugin's tools; oracle values come from transcripts/tool results; no secret or tenant id in any file; links resolve. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'tryit-check', phase: 'Publish', schema: CHECK, ...OPH })
return { plan, runs, page, check }
