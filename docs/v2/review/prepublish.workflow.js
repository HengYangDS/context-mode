export const meta = {
  name: 'v2-prepublish',
  description: 'Pre-publish round: search returns whole raw code without perf loss; open-items audit (issues, PRs, gaps); docs sync; v2-vs-v1 (+gateway) publication page; npm install docs + CLI report; README last; gate, CI',
  phases: [
    { title: 'Work', detail: 'search fix, audit, CLI report in parallel' },
    { title: 'Docs', detail: 'sync, publication page, install docs' },
    { title: 'Final', detail: 'README, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish, never change npm settings.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox and web repo /Users/mksglu/Server/Mert/context-mode-web-2026-10: READ ONLY.
Own temp space only: /private/tmp/cm-v2-pp-${id}. Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first for code. Never weaken an assertion. No regex on evidence, no truncation as a fix. DEVIATIONS.md row per behaviour change. Write no personal names, no tenant ids, no secrets. Docs: plain short sentences, active voice, ASD-STE100 style; every claim links to evidence in the repo; show losses as well as wins.
Pace: commit + push within your first 15 tool calls; push after each step; done within 90 minutes.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const SEARCH = `${base('search')}\n\nOwner (2026-10-23): v2 must keep its best performance; solve it algorithmically. Problem (docs/v2/spikes/search/DIAGNOSIS.md sections 6-7): code fences come back whole in only 9/70 replies (v1 21/70) and code-symbol queries hit 4/7 (was 7/7), because (a) snippets are clipped at 800 B and (b) FTS5 highlight HTML-escapes < > & so code does not come back as stored text.
Do, test-first, measure each step on the frozen held-out set (e2e/fixtures/search/heldout.json), bench/search/crosscheck-queries.json and bench/fixtures/run.mjs:
1. No HTML escaping: build snippets from the stored chunk text with match offsets (FTS5 offsets or your own term positions on the stored text), mark matches only if a marker is needed, never entity-encode.
2. Fence-aware snippet window: choose the window by an algorithm, not a fixed clip: score windows by matched-term density (BM25-like term weights) and expand to whole syntactic units: a whole fenced block if the best window touches it, else whole paragraph/line boundaries. Budget per result and per reply in bytes; a fenced block larger than the per-result cap returns its best-scoring contiguous lines with the fence and a "lines a-b of N" marker (never a cut mid-line).
3. Code-symbol queries: tokenise identifiers (camelCase, snake_case, dotted, paths) into parts plus the whole symbol at index and query time; boost exact symbol matches in fenced code.
4. Perf: search p95 on 1 MB indexed must not rise above the current 12.1 ms by more than 10%; aim to cut it (prepared statements cached, one query plan for AND/OR, trigram pass only on miss, no per-call regex compile). Report p50/p95 before/after.
Pass: code fences whole >= v1 (21/70), code-symbol 7/7, held-out recall@5 >= 0.86 and MRR >= 0.72, crosscheck >= 0.90, 0 no-hit, bytes per reply reported honestly. Update GP-SEARCH-heldout floors to the new values, DIAGNOSIS.md section 8, results.json and docs/benchmarks/fixtures/README.md. node --test tests/v2/ and gate --all. Return done, commits, numbers (before/after per metric), summary.`

const AUDIT = `${base('audit')}\n\nRole: open-items auditor. Owner asks: does v2 still solve every v1 issue and PR, and is anything left unfixed (owner believes compact, memory, saving, stats and DB are done)? Do:
1. gh issue list and gh pr list on mksglu/context-mode (all states; if the tracker is off, use the API: gh api repos/mksglu/context-mode/issues?state=all&per_page=100 paginated, and the earlier coverage files in docs/v2). Map every open-at-v2-start issue and PR to the v2 change that resolves it, with the test or e2e case that proves it. Status per item: resolved+tested, resolved-untested, partly, not resolved, out of scope (with reason).
2. Verify the owner's list with evidence, not docs prose: compaction (GP cases + live probe status), memory, savings, ctx-stats issues, DB (node:sqlite, locking, WAL, concurrency). Run the relevant e2e cases.
3. List every known open item from docs/v2 (DEVIATIONS, spikes, rehearsal docs, LAUNCH.md, review notes): e.g. macOS/Windows hook timing not gated, opencode verifier env, kiro SessionStart empty output, Gemini resume hint at start, ADR-0006 live probe, npm trusted publisher (owner), try-it cost result vs direct on short tasks.
Write docs/v2/OPEN-ITEMS.md (one table: item, status, evidence, owner or next step) and docs/v2/ISSUE-COVERAGE.md (counts per status at top). Commit, push. Return done, commits, numbers (counts), summary (top 10 open items).`

const CLIREP = `${base('clirep')}\n\nRole: CLI reviewer for the owner. Build release-out, npm pack, npm i -g into a temp prefix and temp HOME. Run and capture verbatim (no ANSI, NO_COLOR=1, and once in a pty for the interactive look): context-mode --help, --version, setup --help, setup --list, setup --dry-run (with 2-3 fake agents present), setup --yes --agents claude-code,codex --json, doctor, doctor --json, upgrade --help, setup --remove --yes, a typo (context-mode setpu), a broken config file, no TTY. Check each against clig.dev and ADR-0019 section 8 (help with examples, exit codes 0/1/2/130, stdout/stderr split, --json purity, prompts only on TTY, NO_COLOR, dry-run, Ctrl-C rollback, error = what/why/fix, startup < 100 ms for --help). Fix small real defects test-first (e.g. wording, exit code, missing example); list bigger ones. Write docs/v2/CLI-REPORT.md: the user journey in 2 commands with real captured output, a pass/fail table per rule, defects fixed, defects open, and suggestions to make it simpler. Commit, push. Return done, commits, numbers (rules pass/total), summary.`

const SYNC = `${base('sync')}\n\nRole: docs sync. Make docs/v2 (PRD-v2.md, PRD-setup.md, TECH-SPEC.md, ADR 0001-0019, impl/*, LAUNCH.md, benchmarks.md, docs/benchmarks/*/README.md links) agree with the code on v2-design today: npm channel and context-mode CLI (ADR-0019 D1-D7), search layers (DIAGNOSIS.md), hook startup work (D-CI-PERF-3/4), Gemini SessionStart removal (D-FU-GCH-1), pi package.json, kiro event name, release rehearsal state. For each contradiction: fix the doc to match the code, or if the code is wrong, list it in docs/v2/OPEN-ITEMS.md (another agent writes that file; append a row under a "From docs sync" heading, pull first). Run build/check-removed.mjs, build/check-install-docs.mjs and the prompt lint. Commit, push. Return done, commits, numbers (contradictions fixed / listed), summary.`

const PUB = `${base('pub')}\n\nRole: writer of the publication page. Write docs/benchmarks/v2-vs-v1/README.md (and link it from docs/benchmarks/README.md), in the style of the web benchmark pages (/Users/mksglu/Server/Mert/context-mode-web-2026-10/static/benchmarks and docs/benchmarks/v1-v2-gateway/README.md): lead sentence with headline numbers linked to evidence; Key facts; one comparison table Direct | v1 | v2 | Context Mode Gateway per topic: cost on short tasks (v1-v2-gateway), Try-it prompts (try-it), fixture byte savings (fixtures), search quality (DIAGNOSIS held-out recall/MRR, code blocks), hook latency, install (2 commands vs v1 steps), issue coverage (ISSUE-COVERAGE.md when present, else link), reliability (CI matrix, DB), privacy (no telemetry, local only); a short "Where v2 is not better" section with the real losses (v2 vs direct on short tasks, bytes when search finds more); a Gateway section: what it adds over the free v2 (paid plan, per-request compression, measured savings with links), positioned as the upgrade path, not as a v2 weakness. Only numbers that exist in the repo evidence files; cite each. Commit, push. Return done, commits, numbers (headline per row), summary.`

const INST = `${base('inst')}\n\nRole: install docs. With the CLI on v2-design (context-mode setup/doctor/upgrade, ADR-0019), rewrite installation for npm: docs/install/README.md becomes the single page: requirements (Node >= 24.15.0), the two commands (npm i -g context-mode@next && context-mode setup; after the owner moves latest: without @next), what setup does, --list to see which agents work, --dry-run, uninstall (context-mode setup --remove && npm rm -g context-mode), upgrade from v1 (same two commands; what setup replaces), troubleshooting (context-mode doctor, the issue report). Per-agent pages shrink to: what setup does for that agent, the manual fallback (one block), known limits, verified table. Keep the git release route only where an agent installs from git (Claude Code marketplace, Gemini/Qwen extension) and say setup runs it. Update build/check-install-docs.mjs rules and its tests. Verify the two-command flow in a clean temp HOME with the npm-packed build (setup --yes --agents for agents whose CLI installs in the temp prefix). Commit, push. Return done, commits, numbers, summary.`

phase('Work')
const [search, audit, clirep] = await parallel([
  () => run(SEARCH, 'pp-search', 'Work', RESULT, OPH),
  () => run(AUDIT, 'pp-audit', 'Work', RESULT, SNH),
  () => run(CLIREP, 'pp-clirep', 'Work', RESULT, SNH),
])

phase('Docs')
const ctx = `Earlier results: search ${JSON.stringify(search).slice(0, 1500)}; audit ${JSON.stringify(audit).slice(0, 1500)}; cli ${JSON.stringify(clirep).slice(0, 1200)}.`
const [sync, pub, inst] = await parallel([
  () => run(`${SYNC}\n\n${ctx}`, 'pp-sync', 'Docs', RESULT, SNH),
  () => run(`${PUB}\n\n${ctx}`, 'pp-pub', 'Docs', RESULT, OPH),
  () => run(`${INST}\n\n${ctx}`, 'pp-inst', 'Docs', RESULT, SNH),
])

phase('Final')
const readme = await run(`${base('readme')}\n\n${ctx}\nRole: README editor. Update README.md on v2-design for v2 (the owner reviews it by hand after): what it is in one sentence, the problem it solves, the two install commands (npm, @next until latest moves), supported agents table generated from the adapter table (full / MCP only), headline numbers linked to docs/benchmarks/v2-vs-v1/README.md, privacy (local only, no telemetry), a short Gateway section (paid plan, link), docs links. Remove v1-only content (old Try It claims that the try-it benchmark marked false). Keep the README line limit in build/check-readme.mjs. Commit, push.`, 'pp-readme', 'Final', RESULT, OPH)
const g = await agent(`${base('gate')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, build/check-removed.mjs, build/check-install-docs.mjs, build/check-readme.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'pp-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'pp-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'pp-ci', phase: 'Final', ...SNM })
return { search, audit, clirep, sync, pub, inst, readme, gate: g, ci }
