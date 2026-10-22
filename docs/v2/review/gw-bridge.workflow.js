export const meta = {
  name: 'v1-v2-gateway-bridge',
  description: 'Finish the drift bridge (plain vs gateway, 2 pairs) for grep, tests, json, edit on the live host, then update ab.json/README and re-check numbers',
  phases: [
    { title: 'Bridge', detail: 'one runner per missing task, --gw https://gateway.context-mode.com' },
    { title: 'Publish', detail: 'update analysis, page, adversarial check' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const GW = '/Users/mksglu/Server/Mert/context-mode-sandbox'
const WEB = '/Users/mksglu/Server/Mert/context-mode-web-2026-10'
const WT = '/private/tmp/cm-gwb-wt'
const OUT = 'docs/benchmarks/v1-v2-gateway'
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }

const RULES = `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
- Gateway repo ${GW} and web repo ${WEB}: READ ONLY, never push (gateway push = production deploy). Harness work only in the worktree ${WT} (local branch bench/v1-v2-gw, never pushed).
- OSS repo github.com/mksglu/context-mode branch v2-design: commit and push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release.
- Never write a secret or tenant id into any public file, commit or log. The owner tenant (id in the private ledger only) is forbidden. New disposable tenant per workload.
- Follow ${GW}/CLAUDE.md: transcript and gateway per-call record are the evidence; no regex, no truncation of evidence; explicit --model; </dev/null; fail closed; unexercised = INCONCLUSIVE.
- The published pre-registration is ${OUT}/prereg.md (commit bcc45e33). The bridge is a drift check only and is never merged into any row.
- Write no personal names.`

phase('Bridge')
const runs = await parallel(['grep', 'tests', 'json', 'edit'].map((t) => () => agent(`${RULES}\n\nRole: bridge runner, task ${t}. The first run skipped the bridge for this task because the harness default host (cm-gateway-poc.mksglu.workers.dev) answers 404 / Cloudflare 1042. The live gateway is https://gateway.context-mode.com (/__version answers 200). In ${WT} run exactly the prereg bridge for task ${t}: 2 pairs plain vs gateway, claude-opus-5-5, new disposable tenant, default flags read back and recorded, passing --gw https://gateway.context-mode.com. Gateway cost from the per-call record (/__ops) checked against the client total. Append the bridge lines to ${OUT}/runs/${t}.jsonl in your own clone /private/tmp/cm-gwb-br-${t} (v2-design), commit, push. Delete the clone. Return done, commits, numbers (plain mean, gateway mean, saving %, resolution evidence), summary.`,
  { label: `bridge-${t}`, phase: 'Bridge', schema: RESULT, ...SNM })))

phase('Publish')
const upd = await agent(`${RULES}\n\nBridge results: ${JSON.stringify(runs).slice(0, 4000)}.\nRole: analyst. Fresh OSS clone (v2-design). Re-run ${OUT}/analyze.mjs to refresh ab.json with the bridge pairs (still kept apart from the rows). Update the bridge section of ${OUT}/README.md: per task plain vs gateway on today's client, 2 pairs each, and what it says about drift since 2026-09-29 (n=2: say plainly it is a drift check, not a result). Also note in How we measured that the bridge host is gateway.context-mode.com. Commit, push. Return done, commits, numbers, summary.`,
  { label: 'bridge-publish', phase: 'Publish', schema: RESULT, ...OPH })
const check = await agent(`${RULES}\n\nRole: adversarial checker. Fresh OSS clone (v2-design). Recompute every number in ${OUT}/README.md and ab.json with your own separate script from runs/*.jsonl and ${WEB}/static/benchmarks/data/v3-opus55-short.json (t at df = n - 1). Check: bridge pairs are not merged into rows; every bridge run has a gateway record; no secret or tenant id in any file; links resolve. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`,
  { label: 'bridge-check', phase: 'Publish', schema: CHECK, ...OPH })
return { runs, upd, check }
