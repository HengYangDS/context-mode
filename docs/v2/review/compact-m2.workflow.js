export const meta = {
  name: 'v2-compact-m2',
  description: 'Two tracks in parallel: (A) post-compaction recall when facts live only in the DB, (B) saving M2 >= 90. Each: diagnose + frozen eval, 3 candidate algorithms on exp branches in parallel, numeric pick, merge, adversarial re-measure; then docs, gate, CI',
  phases: [
    { title: 'Diagnose', detail: 'root cause, frozen eval, baseline (both tracks)' },
    { title: 'Candidates', detail: '3 per track on exp/* branches, in parallel' },
    { title: 'Merge', detail: 'numeric pick, merge winner (+ graft), adversarial re-measure' },
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
const DIAG = { type: 'object', properties: {
  done: { type: 'boolean' }, evalCommit: { type: 'string' }, baseSha: { type: 'string' },
  baseline: { type: 'number' }, evalCmd: { type: 'string' }, summary: { type: 'string' } },
  required: ['done', 'evalCommit', 'baseSha', 'baseline', 'evalCmd', 'summary'] }
const CAND = { type: 'object', properties: {
  done: { type: 'boolean' }, branch: { type: 'string' }, sha: { type: 'string' },
  primary: { type: 'number' }, heldout: { type: 'number' }, guardsPass: { type: 'boolean' },
  guards: { type: 'string' }, spendUsd: { type: 'number' }, summary: { type: 'string' } },
  required: ['done', 'branch', 'sha', 'primary', 'heldout', 'guardsPass', 'guards', 'spendUsd', 'summary'] }
const CHECK = { type: 'object', properties: {
  pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['pass', 'problems', 'summary'] }
const GATE = { type: 'object', properties: {
  green: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['green', 'failing', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode. Work branch as stated in the task (v2-design or your own exp/* branch). Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push v2-design, never npm publish.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY. Its CLAUDE.md rules for live runs apply: transcript is the evidence, never model prose; explicit --model; </dev/null; fail closed.
Live claude -p runs: real Claude Code binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential copied, --plugin-dir <built release-out>, --strict-mcp-config, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd per session as stated. No API key: the login only (ADR-0012).
Own temp space only: /private/tmp/cm-v2-cm-${id}. Never edit the real ~/.claude. Delete your temp space before you return (keep raw transcripts under /private/tmp/cm-v2-impl-private/compact-m2/${id}). npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Owner rules: truncation and regex are not allowed as a fix; solve it with an algorithm. Never write instruction files (CLAUDE.md, AGENTS.md, ...). Subagent contexts must not grow (ADR-0016). Hook overhead p95 <= 15 ms (ADR-0019 D3) must hold. Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. Write no personal names, no tenant ids, no secrets.
Pace: commit + push within your first 15 tool calls; push after each step; done within the time stated.`

async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

const TRACKS = {
  compact: {
    budget: 45,
    diag: `Track A: compaction. Today (docs/v2/OPEN-ITEMS.md, ISSUE-COVERAGE.md, ADR-0009): after compaction answers are correct 10/10, but the model never calls ctx_resume or ctx_search from the pointer (0/10); the call-rate gate was retired. Correct answers without retrieval mean the probe is too easy: the compaction summary already holds the facts.
Do (on v2-design, 90 minutes):
1. Read ADR-0009, the compaction code (PreCompact / SessionStart source=compact / pointer text / ctx_resume / journal), and the existing live compaction probe and its results. Write down the exact pointer text the model sees after compaction and why the model ignores it (quote transcripts).
2. Build a HARD probe set e2e/live/compact-hard/: sessions that create facts that a summary drops but the DB keeps (exact values from large tool outputs that were replaced: hashes, line numbers, error lines, ids from a 2000-line log, a config value deep in a JSON), then force compaction the way the existing harness does, then ask questions that need those exact values. Oracle per question = exact value compare from the transcript final answer against the fixture (deterministic, no regex on prose: parse a required answer format). At least 12 questions over 4 sessions, plus 6 held-out questions in a separate file the candidates never see (heldout/), written now.
3. Metric (primary) = correct answers on the hard set after compaction, % over n runs; secondary = retrieval calls after compaction, tokens added after compaction (cost guard), wall time. Prereg file e2e/live/compact-hard/PREREG.md: model claude-sonnet-5-5 for search, claude-opus-5-5 confirm for the winner, n=3 per question per arm, --max-budget-usd 1 per session.
4. Measure baseline: current v2 and direct (no plugin). Commit + push the eval, prereg and baseline BEFORE returning. evalCmd = the one command that scores a built release-out (e.g. node e2e/live/compact-hard/run.mjs --bundle <dir> --set main|heldout --n 3 --model <m>).
Return done, evalCommit, baseSha (v2-design head), baseline (primary % for current v2), evalCmd, summary (direct vs v2 numbers, the cause in 3 lines).`,
    cands: [
      { id: 'a-pull', what: 'PULL: make retrieval the obvious next step. Rewrite the post-compaction pointer as a short, concrete, task-specific instruction built from the session state (what was being done, which stored outputs exist with their labels and sizes, the exact ctx_search query to run), shape ctx_resume to return a structured state digest, and tune the ctx_resume / ctx_search tool descriptions (prompt lint must pass, ADR-0005 style). Prove whether the model now retrieves AND answers correctly.' },
      { id: 'a-push', what: 'PUSH (query-driven): on the first UserPromptSubmit after a compaction, the hook runs the existing search (BM25 + trigram + RRF) over this session\'s stored outputs with the user prompt plus the session goal as the query, selects results by relevance with MMR diversity under a byte budget, and adds them as context once. Exact values come back verbatim (snippet algorithm, D-SEARCH-7). If ADR-0009 forbids this, amend it in the same branch with the reason and the measured result. Hook overhead budget applies: precompute the index at PostToolUse, not at prompt time.' },
      { id: 'a-ledger', what: 'LEDGER (salience-ranked state): keep a session fact ledger updated at PostToolUse (files touched, errors, ids/values seen in replaced outputs, decisions), score entries by type weight x recency decay x reference frequency (deterministic, documented formula), and deliver the top-k entries within a byte budget at SessionStart source=compact (or the agent\'s equivalent), each with the exact value and a retrieval handle. Check the Claude Code 2.1.303 reference contract (ADR-0001 fixtures) for what SessionStart compact can carry.' },
    ],
    guards: 'Guards: GP6 and all compaction e2e cases green; no answer quality loss on the old 10/10 probe; tokens added after compaction <= 2,000 per compaction; hook overhead D3 check passes; node --test tests/v2/ and gate --all green.',
  },
  m2: {
    budget: 35,
    diag: `Track B: saving M2. Today M2 = 87.23 (88.02 on a later commit) against a target of 90 (docs/v2/OPEN-ITEMS.md). An earlier finding: on 322k real calls the big-output bytes are 62% from Read, and the design does not replace Read output, only hints.
Do (on v2-design, 90 minutes):
1. Find the M2 definition, its harness and its workloads in docs/v2 and e2e/. Run it on current v2 and print a per-workload and per-tool table of bytes in vs bytes the model saw. Name the top 3 leak sources with numbers.
2. Freeze the eval: commit the M2 workloads as the main set, and add a held-out set of at least 6 new workloads written now (different repos/outputs: Read of large source files, MCP tool outputs, WebFetch, test runs, logs, JSON) that candidates never see (heldout/). Each workload keeps a task oracle so savings never count if the task fails.
3. evalCmd = the one command that scores a built release-out on main or heldout (deterministic where possible; if M2 needs live sessions, model claude-sonnet-5-5, n=3, --max-budget-usd 1 per session). Baseline current v2 on both sets. Commit + push BEFORE returning.
Return done, evalCommit, baseSha, baseline (M2 main for current v2), evalCmd, summary (top leaks).`,
    cands: [
      { id: 'b-read', what: 'READ PATH: large Read results are the biggest leak. Add an algorithmic Read handling: above the size threshold, PostToolUse replaces the Read output with a structure-aware view (outline from the parser: symbols, headings, line ranges, plus the region around what the task names) and indexes the full text, with an exact line-range retrieval handle. Edit after Read must still work in a live Claude Code session (prove it with a live edit task: Read big file -> Edit -> correct diff). Small and partial (offset/limit) reads pass through unchanged.' },
      { id: 'b-dedup', what: 'REDUNDANCY: outputs repeat across a session (same file read twice, test reruns, git status). Add content-defined chunking with rolling hashes (FastCDC-style) and a per-session chunk store: a repeated chunk returns a short reference with its handle instead of the bytes; a changed output returns only the changed chunks plus a delta header. Deterministic, exact (no truncation); retrieval returns the full bytes. Threshold chosen by measured gain, not a fixed guess.' },
      { id: 'b-shape', what: 'SHAPE BY CONTENT TYPE: replace generic replacement text with type-aware digests chosen by a detector over the content (not regex on content: use parsers: JSON.parse, line statistics, test-runner reporters, git porcelain formats): test output -> failing tests with their exact error blocks and counts; logs -> template mining (Drain-style) with counts and the exact rare lines; JSON -> schema with types, sizes and sample paths; diffs -> file/hunk stats with the hunks the task names. Every digest carries the retrieval handle; nothing is cut mid-unit.' },
    ],
    guards: 'Guards: task oracle success on every workload not lower than baseline; held-out M2 not lower than baseline; routing e2e (GP-LIVE-ROUTING) green; hook overhead D3 check passes; Edit-after-Read works; node --test tests/v2/ and gate --all green.',
  },
}

async function track(key) {
  const T = TRACKS[key]
  const d = await run(`${base(key + '-diag')}\n\n${T.diag}`, `${key}-diag`, 'Diagnose', DIAG, OPH)
  if (!d || !d.done) return { key, stopped: 'diagnosis not done', d }
  log(`${key}: baseline ${d.baseline}, eval ${d.evalCommit}`)

  const per = Math.floor(T.budget / T.cands.length)
  const cands = (await parallel(T.cands.map((c) => () => run(`${base(c.id)}\n\nTrack ${key}, candidate ${c.id}. Branch exp/${key}-${c.id} from ${d.baseSha} (push it; never push to v2-design). Diagnosis: ${d.summary}
Approach: ${c.what}
The eval is frozen at ${d.evalCommit}: never edit files under the eval or heldout paths (a checker diffs them). Score with: ${d.evalCmd} on --set main, then once on --set heldout. Live spend cap for you: $${per}.
${T.guards}
Write docs/v2/spikes/${key}/${c.id}.md: algorithm (formula, thresholds and why), before/after numbers on main and heldout, guards, spend. Time: 150 minutes.
Return done, branch, sha, primary (main metric, same unit as baseline ${d.baseline}), heldout, guardsPass, guards (each guard with its number), spendUsd, summary.`, `${key}-${c.id}`, 'Candidates', CAND, OPH)))).filter(Boolean)
  log(`${key}: ` + cands.map((c) => `${c.branch} ${c.primary}/${c.heldout} guards ${c.guardsPass}`).join(', '))

  // Numeric pick: guards must pass, held-out must not fall below baseline-on-heldout proxy (>= 0 change reported by agent), highest primary wins.
  const ok = cands.filter((c) => c.done && c.guardsPass && c.primary > d.baseline)
  ok.sort((a, b) => (b.primary - a.primary) || (b.heldout - a.heldout))
  if (!ok.length) return { key, d, cands, stopped: 'no candidate beat the baseline with guards passing' }
  const [win, ...rest] = ok

  const m = await run(`${base(key + '-merge')}\n\nTrack ${key}. Baseline ${d.baseline} (eval ${d.evalCommit}, cmd ${d.evalCmd}). Winner ${win.branch} (${win.sha}): main ${win.primary}, heldout ${win.heldout}. Other passing candidates: ${JSON.stringify(rest.map((c) => ({ branch: c.branch, sha: c.sha, primary: c.primary, heldout: c.heldout })))}.
Merge the winner into v2-design (rebase or merge, no force-push). Then for each other passing candidate, try grafting it on top in a temp branch and keep it only if main AND heldout both rise and all guards still pass (measure; cap $10 total). Re-run the guards on the merged v2-design. ${T.guards}
Then confirm the final build once with claude-opus-5-5 on the main set (n as the prereg says). Update the ADR that owns the area (ADR-0009 for compaction, the savings ADR / TECH-SPEC for M2), docs/v2/OPEN-ITEMS.md and docs/v2/spikes/${key}/RESULT.md (all candidates' numbers, the pick rule, why the winner won, losses). Keep all exp/${key}-* branches (evidence). Commit, push. Time: 120 minutes.`, `${key}-merge`, 'Merge', RESULT, OPH)

  const ck = await run(`${base(key + '-check')}\n\nRole: adversarial checker for track ${key}. Fresh clone of v2-design. (1) git: the eval and heldout files are unchanged since ${d.evalCommit}, and the eval commit is older than every candidate commit. (2) Re-measure with your own run of ${d.evalCmd} on main and heldout against a fresh build (sonnet, n=2, cap $8) and compare with the claimed numbers in docs/v2/spikes/${key}/RESULT.md. (3) Read the merged code: no truncation or regex used as the saving or recall mechanism, no instruction-file writes, no subagent context growth, hook overhead D3 check passes. (4) Run node --test tests/v2/ and gate --all. Fix wrong numbers in the docs in place; report real defects. Return pass, problems, summary. Time: 75 minutes.`, `${key}-check`, 'Merge', CHECK, OPH)
  return { key, d, cands, win: { branch: win.branch, primary: win.primary, heldout: win.heldout }, m, ck }
}

phase('Diagnose')
const results = await parallel([() => track('compact'), () => track('m2')])

phase('Final')
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all three times, build/check-removed.mjs, build/check-install-docs.mjs, build/check-readme.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'cm-gate', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('gatefix')}\n\nRole: fixer on v2-design. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'cm-gatefix', 'Final', RESULT, OPH)
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'cm-ci', phase: 'Final', ...SNM })
return { results, gate: g, ci }
