export const meta = {
  name: 'tryit-fix',
  description: 'Try-it benchmark fix: diagnose gateway no-tool-call runs, fix large-json oracle (transcript, not disk), new gateway tenant per cycle, prereg amendment, re-run web-scrape/docs-search/large-json, update page, adversarial check',
  phases: [
    { title: 'Diagnose', detail: 'why gateway made no tool call; oracle fix; prereg amendment' },
    { title: 'Run', detail: '3 prompts, 4 arms, warm-up + 4 cycles' },
    { title: 'Publish', detail: 'page update, adversarial check' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const GW = '/Users/mksglu/Server/Mert/context-mode-sandbox'
const WT = '/private/tmp/cm-gwb-wt'
const OUT = 'docs/benchmarks/try-it'
const PRIV = '/private/tmp/cm-v2-impl-private/tryit'
const RERUN = ['web-scrape', 'docs-search', 'large-json']
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }

const RULES = `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
- Gateway repo ${GW}: READ ONLY, never push (push = production deploy). Harness work only in ${WT} (local branch bench/v1-v2-gw, never pushed; runner scripts/e2e/start-cost-ab-arms.mjs --workloads tryit, workloads scripts/e2e/tryit-workloads.mjs, --gw https://gateway.context-mode.com).
- OSS repo github.com/mksglu/context-mode branch v2-design: commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never npm.
- Never write a secret or tenant id into a public file, commit or log. Owner tenant t_1b9423c0 forbidden.
- Follow ${GW}/CLAUDE.md: transcript and gateway per-call record are the evidence, never model prose; no regex on evidence; explicit --model; </dev/null; fail closed.
- Never delete or rewrite existing run lines: earlier runs are kept and marked superseded in the analysis, with the reason.
- Write no personal names.
- Pace (hard rule): commit+push within your first 15 tool calls; push after each step; done within 45 minutes (runners: 120 minutes).`

phase('Diagnose')
const diag = await agent(`${RULES}\n\nRole: diagnostician. In the first try-it run (${OUT}, prereg on v2-design), the gateway arm made no tool call in all web-scrape and docs-search sessions (oracle no-tool-call, answered on turn 1), and all 4 arms of large-json failed with no-served-data-on-disk because the model built the data in memory.
1. Read the raw gateway transcripts in ${PRIV}/web-scrape and ${PRIV}/docs-search (and the gateway per-call record ids stored there). State with evidence why no tool was called: memory injection from an earlier cycle on the same tenant, a skill, a refusal, or an answer from training data. Quote the injected block or the answer start as evidence (no tenant ids).
2. Fix in ${WT} (local commits): (a) gateway arm gets a NEW disposable tenant per session (not per prompt), default flags read back and recorded; (b) large-json oracle reads the hidden record from the transcript: the tool_result that served or generated index 13000 (the record object as JSON-parsed from that tool_result), and passes if every leaf value appears in the final answer; still fail closed if no such tool_result exists. Unit-test both in scripts/e2e/oss-arms-lib.test.mjs.
3. Re-score the old large-json runs with the new oracle in the private ledger only (for the page as a note).
4. Write ${OUT}/prereg-amendment-1.md: what changed, why (the diagnosis), which prompts re-run, that earlier lines stay and are marked superseded. Update bench/gateway-ab/tryit.patch. Commit + push BEFORE any new measured run.
Smoke: large-json and web-scrape, gateway + v2 arms, 1 cycle, claude-haiku-4-5-20251001; pass only if the gateway session uses a fresh tenant and the new oracle gives a real verdict.
Return done (true only if amendment pushed and smoke passed), commits, numbers (diagnosis in one line, smoke), summary.`,
  { label: 'fix-diagnose', phase: 'Diagnose', schema: RESULT, ...OPH })
let ready = diag && diag.done
if (diag && !diag.done) {
  // First diagnose run stopped fail-closed: WebFetch uses claude-haiku-5-5, missing from the price table.
  const pf = await agent(`${RULES}\n\nPrevious step: ${JSON.stringify(diag).slice(0, 3000)}\n\nRole: price fix + smoke. Official list price of claude-haiku-5-5: read it yourself from https://platform.claude.com/docs/en/about-claude/pricing today (both the up-to-100k and over-100k prompt tiers, if the page has tiers: input, 5m cache write, 1h cache write, cache read, output). Quote the exact table rows in the addendum. If you cannot read a value from the page, do not guess: record the helper call as unpriced (cost_unpriced: true, tokens kept) and say so. Do not change any other price.
1. In ${WT} add claude-haiku-5-5 to PRICES with both tiers; price each request by its own prompt length when per-request usage is available (gateway record, per-model usage in the result event); if only a per-model total is available, use the lower tier and flag the run (price_tier_assumed). Unit test both tiers. Local commit.
2. Append a section "Addendum: helper model price" to ${OUT}/prereg-amendment-1.md with the prices, the source URL and date, and the tier rule; update bench/gateway-ab/tryit.patch. Commit + push BEFORE any measured run.
3. Re-run the smoke: web-scrape, arms plain, v2, gateway, 1 cycle, claude-haiku-4-5-20251001. Pass only if every arm resolves, the gateway session has a fresh tenant, and the WebFetch helper call is priced.
Return done (true only if addendum pushed and smoke passed), commits, numbers, summary.`,
    { label: 'fix-price', phase: 'Diagnose', schema: RESULT, model: 'claude-sonnet-5-5', effort: 'high' })
  ready = pf && pf.done
  diag.priceFix = pf
}
if (!ready) return { stopped: 'diagnose/price fix not done', diag }

phase('Run')
const runs = await parallel(RERUN.map((p) => () => agent(`${RULES}\n\nAmendment: ${JSON.stringify(diag).slice(0, 2500)} (${OUT}/prereg-amendment-1.md on v2-design).
Role: runner for ${p}. In ${WT} run 1 warm-up + 4 measured cycles, arms plain, v1, v2, gateway, order rotated, claude-opus-5-5, new gateway tenant per session, --max-budget-usd 3, --max-turns 60. Append run lines to ${OUT}/runs/${p}.jsonl with "amendment": 1 on each new line, in your own clone /private/tmp/cm-tryitfix-${p} (v2-design); commit + push after every cycle. Void only on arm-resolution failure, re-run once. Raw transcripts in ${PRIV}/${p}-a1. Delete the clone at the end. Return done, commits, numbers (per arm: runs, success, mean cost, mean tool_result bytes, tool calls), summary.`,
  { label: `rerun-${p}`, phase: 'Run', schema: RESULT, ...SNM })))

phase('Publish')
const page = await agent(`${RULES}\n\nRe-run results: ${JSON.stringify(runs).slice(0, 5000)}. Diagnosis: ${JSON.stringify(diag).slice(0, 1500)}.
Role: analyst. Fresh OSS clone (v2-design). Update ${OUT}/analyze.mjs: for ${RERUN.join(', ')} use only amendment-1 lines; keep the old lines in ab.json under "superseded" with the reason. Regenerate ab.json and index.json. Update ${OUT}/README.md: tables for the 3 prompts, pooled totals, README-claims table, a short "Amendment 1" section (what went wrong, why, what changed, link to the amendment). Plain short sentences, all rows shown, wins and losses. Commit, push. Return done, commits, numbers (per prompt and pooled, per arm), summary.`,
  { label: 'fix-write', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. Fresh OSS clone (v2-design). Recompute every number in ${OUT}/README.md and ab.json with your own script from runs/*.jsonl (not analyze.mjs; t at df = n - 1; amendment-1 lines for ${RERUN.join(', ')}). Check: amendment commit before the first amendment-1 run; each amendment-1 gateway session has its own tenant (count distinct private tenant ids in ${PRIV}, do not print them) and a gateway record; old lines unchanged in git history; no secret or tenant id in public files. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'fix-check', phase: 'Publish', schema: CHECK, ...OPH })
return { diag, runs, page, check }
