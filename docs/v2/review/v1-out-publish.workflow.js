export const meta = {
  name: 'v2-v1-out-publish',
  description: 'Two tracks: (A) remove v1 migration text from user-facing docs and CLI output (keep silent compatibility), CI rule; (B) publish the Gateway / v2 / v1 benchmark on the web site from the existing evidence: draft on a branch, independent number check, then publish per the web repo rules',
  phases: [
    { title: 'Work', detail: 'v1 out of docs + web draft, in parallel' },
    { title: 'Check', detail: 'number check of the web draft' },
    { title: 'Publish', detail: 'publish web page, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const WEB = '/Users/mksglu/Server/Mert/context-mode-web-2026-10'
const common = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never force-push. Never npm publish. Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY.
Own temp space only: /private/tmp/cm-v2-vp-${id}. Delete it before you return. No personal names, tenant ids, secrets or private ledger paths in any public file.
Pace: commit + push within your first 12 tool calls; push after each step.`
const oss = (id) => `${common(id)}
OSS repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Another workflow rewrites docs/install/* and src/cli + src/setup right now: git pull --rebase before every commit, small commits, keep both sides on conflict. Never touch main, never tag, never release. Tests first; never weaken an assertion; DEVIATIONS.md row per behaviour change. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.`
const web = (id) => `${common(id)}
Web repo: ${WEB}. NEVER work in that folder: it has someone's uncommitted changes (build.mjs, demos.mjs). Clone its remote (git -C ${WEB} remote get-url origin) fresh into your temp space. Read its CLAUDE.md / README first and follow its rules for benchmark pages, build, tests and deploy exactly.`

const V1OUT = `${oss('v1out')}\n\nOwner (2026-10-25): "v1'e geçişi kaldıralım, v1 görmek istemiyorum; v1 sadece benchmark yayınlarken". Do (120 minutes):
1. User-facing docs (README.md, docs/install/**, docs/*.md outside docs/v2 and docs/benchmarks, CONTRIBUTING, issue templates, skill/command text shipped to users, MCP tool descriptions and server instructions): delete every "upgrade from v1", "migrate", "v1" mention and v1-only section. The user sees one product. Keep "v1" only in docs/benchmarks/** and in internal design records under docs/v2/** (ADRs, spikes, DEVIATIONS).
2. CLI output (setup, doctor, upgrade, --help): no "v1" wording. Keep the silent compatibility: setup still finds old context-mode entries and replaces them, doctor reports them as "old context-mode entry, run: context-mode setup". Do not remove the detection code (old users must keep working). Tests that pin "v1" text change to the new wording, one DEVIATIONS row (D-V1OUT-1).
3. Add a rule to build/check-install-docs.mjs (red test first): the string "v1" (word) must not appear in README.md, docs/install/**, CLI help/output goldens, src/prompt/**, issue templates. docs/benchmarks/** and docs/v2/** are exempt.
4. node --test tests/v2/ and node scripts/gate.mjs --all --quick. Return done, commits, numbers (files changed, v1 mentions removed), summary.`

const DRAFT = `${web('draft')}\n\nOwner (2026-10-25): publish the benchmark we already have; order Gateway first, then v2, then v1.
Evidence (OSS v2-design, fresh clone github.com/mksglu/context-mode branch v2-design, read only): docs/benchmarks/v1-v2-gateway/ (ab.json, README, runs), docs/benchmarks/try-it/ (ab.json, README, prereg + amendments), docs/benchmarks/fixtures/ (results.json), docs/benchmarks/v2-vs-v1/README.md, docs/v2/spikes/search/DIAGNOSIS.md, docs/v2/spikes/compact/RESULT.md, docs/v2/spikes/m2/RESULT.md.
Do (150 minutes):
1. Study how the web site publishes benchmark pages today (static/benchmarks/*, data JSON format, prereg pages, index/listing, build step) and copy that format exactly.
2. Add one benchmark publication: "Context Mode Gateway vs v2 vs v1" with data JSON and page. Every table orders the arms Gateway, v2, v1, then Direct (the no-plugin baseline). Rows: cost on six short tasks (vs direct, wins, 95% range), Try-it prompts (cost, success), fixture byte savings, search quality (recall@5, MRR, code blocks whole), compaction recall when facts live only in the DB (direct 72%, v2 100%), M2 saving, hook overhead. Only numbers that exist in the evidence files; cite each by file. Each row states the v2 commit it was measured on; if a v2 row predates later v2 changes, say so in one line. Keep the honest lines: v2 vs direct on short tasks (+2.2%, +15.5% Try-it), Gateway JSON task 0/4 and why. Gateway is the paid plan: one short call-to-action line in the site's existing style, no new tracking.
3. Build and run the web repo's tests locally. Push to a NEW branch bench/gw-v2-v1 only (not the deploy branch). Return done, commits (branch + sha), numbers (headline per row), summary (files added, how the site publishes, the exact publish step).`

phase('Work')
const [v1out, draft] = await parallel([
  () => agent(V1OUT, { label: 'vp-v1out', phase: 'Work', schema: RESULT, ...SNH }),
  () => agent(DRAFT, { label: 'vp-draft', phase: 'Work', schema: RESULT, ...OPH }),
])

phase('Check')
let ck = null
if (draft && draft.done) {
  ck = await agent(`${web('check')}\n\nRole: independent number checker for a public page. Draft: ${JSON.stringify(draft).slice(0, 2500)}. Fresh clones of the web repo (branch bench/gw-v2-v1) and OSS v2-design. Recompute every number on the page and in its data JSON from the OSS evidence files with your own script. Check: arm order Gateway, v2, v1, Direct in every table; each number cites its file; no claim the evidence does not hold; losses shown; no tenant id, secret, private path or personal name; the site builds and its tests pass. Fix wrong numbers on the branch (commit, push to bench/gw-v2-v1). Return pass, problems, summary.`,
    { label: 'vp-check', phase: 'Check', schema: CHECK, ...OPH })
}

phase('Publish')
let pub = null
if (ck && ck.pass) {
  pub = await agent(`${web('pub')}\n\nThe page on branch bench/gw-v2-v1 passed the number check: ${JSON.stringify(ck).slice(0, 1500)}. Publish it now the way the web repo's CLAUDE.md says (merge into the deploy branch and push, or its deploy command). Before: pull the deploy branch, rebase the page on it, build and test. After: confirm the live URL serves the page (curl, HTTP 200, a headline number present). Then add a link to the published URL in OSS docs/benchmarks/v2-vs-v1/README.md and README.md (oss rules: ${'v2-design'}, pull --rebase). Return done, commits, numbers (live URL, HTTP status), summary.`,
    { label: 'vp-publish', phase: 'Publish', schema: RESULT, ...OPH })
} else log('web page not published: check did not pass or draft not done')
const g = await agent(`${oss('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs. Do not fix. Return green, failing, summary.`,
  { label: 'vp-gate', phase: 'Publish', schema: GATE, ...HKM })
if (g && !g.green) await agent(`${oss('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, { label: 'vp-gatefix', phase: 'Publish', ...SNH })
const ci = await agent(`${oss('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'vp-ci', phase: 'Publish', ...SNH })
return { v1out, draft, ck, pub, gate: g, ci }
