export const meta = {
  name: 'v2-cache-proof',
  description: 'Prove v2 does not break the prompt cache of Claude Code and the other hosts: static determinism audit, mining existing transcripts for cache usage, live multi-turn and cross-session A/B on Claude Code and Codex, doc-verified placement for the other hosts; fix any break test-first; re-measure; docs, review, gate, CI',
  phases: [
    { title: 'Measure', detail: 'static audit, transcript mining, live A/B, host docs, in parallel' },
    { title: 'Fix', detail: 'fix every cache break, re-measure' },
    { title: 'Ship', detail: 'result doc, review, gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const HKM = { model: 'claude-haiku-5-5', effort: 'medium' }
const FIND = { type: 'object', properties: {
  done: { type: 'boolean' }, breaks: { type: 'array', items: { type: 'object', properties: {
    host: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' }, evidence: { type: 'string' } },
    required: ['host', 'what', 'where', 'evidence'] } },
  numbers: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['done', 'breaks', 'numbers', 'commits', 'summary'] }
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
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Another workflow (hooks-all) works on exp/hooks-all and may merge into v2-design: git pull --rebase before every commit, keep both sides on conflict. Commit + push allowed (pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Pace (owner): commit + push about every minute of work (after every file change and every test run; small "wip:" commits are fine). On start, fetch and continue from what is pushed; never redo pushed commits.
Gateway repo /Users/mksglu/Server/Mert/context-mode-sandbox: READ ONLY; its CLAUDE.md live-run rules apply (transcript is the evidence, explicit --model, </dev/null, fail closed).
Live claude -p: real binary (record version), fresh CLAUDE_CONFIG_DIR with only the login credential, --plugin-dir <built release-out>, ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1, --max-budget-usd 1 per session, --output-format stream-json --verbose. No API key. Kill hung grandchildren with e2e/live/lib/proc-group.mjs.
Own temp space only: /private/tmp/cm-v2-cp-${id}; raw data under /private/tmp/cm-v2-impl-private/cache/${id}. Never edit the real ~/.claude, ~/.codex etc. Delete the temp space before you return.
Rules: no regex/truncation as a mechanism; never write instruction files; tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change; frozen evals e2e/live/compact-hard and bench/m2 never edited. No personal names, tenant ids or secrets.
Definitions: a cache break at turn n (n>1) = cache_creation_input_tokens at turn n is larger than the new content since turn n-1 (tool results + prompt + hook text) by more than 1024 tokens, i.e. part of the old prefix was written again. Cache hit ratio = cache_read / (cache_read + cache_creation + input). Cross-session prefix read = cache_read on turn 1 of a second session started within 4 minutes in the same project.`

const STATIC = `${base('static')}\n\nRole: static audit (no live runs).
1. Server determinism: start the built MCP server (release-out) 5 times per --agent id (all 10) with different cwd, session env, clock (TZ, a faked Date via a preload is fine) and an empty vs filled store. Capture initialize result (instructions, capabilities), tools/list, prompts/list, resources/list. They must be byte-identical across starts for the same agent. Grep the server for notifications/tools/list_changed, prompts/list_changed, resources/list_changed and any dynamic text (dates, counts, paths, ids, stats) in descriptions or instructions.
2. Hook output placement: for every event v2 emits output on (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, compact paths) and every host, classify where the text lands from the host docs (system prompt / prefix, appended to the current turn, replaces a tool result before the model sees it). Anything that edits or re-orders earlier content or varies the system prompt between turns is a break. SessionStart text that varies between sessions in the same project is a cross-session break unless it lands after the tool/system prefix.
3. Add a test (red first if it fails): tests/v2/cache/prefix-determinism.test.mjs pins byte-identical initialize/tools/list across starts per agent and no list_changed emission; and a lint that tool descriptions and instructions contain no dynamic tokens. Wire it into gate.
Return done, breaks (host, what, where file:line, evidence), numbers, commits, summary.`

const MINE = `${base('mine')}\n\nRole: mine existing evidence, no new spend. Raw Claude Code stream-json transcripts with per-turn usage exist under /private/tmp/cm-v2-impl-private/compact-m2/** (m2 eval, compact-hard, r2-r4, du-*), and any bench/live raw dirs referenced in docs/benchmarks/** and docs/v2/spikes/**. Write bench/cache/mine.mjs (committed, pure parsing) that reads them and outputs per arm (off/direct vs v2) and per workload: turns, cache breaks (definition above), cache hit ratio per turn and per session, median and p90. Separate turns right after a /compact (the host resets the cache there; count them apart). Run it, write bench/cache/mined.json and a table. Return done, breaks (each v2-only break with transcript path + turn), numbers, commits, summary.`

const LIVE_CC = `${base('cc')}\n\nRole: live A/B on Claude Code (claude-sonnet-5-5, --effort low, cap $10 total).
Write e2e/live/cache/run.mjs (new, not frozen): a 6-turn session in one temp project via --resume on the same session id, turns mix: a large cat (200 KB log), a Read of a 300-line file (allowed range), a Grep, a ctx_search, a plain question, a Bash with small output. Arms: off (no plugin) and v2 (plugin from release-out). n=3 per arm. Then cross-session: two fresh sessions in the same project back to back (< 4 min) per arm, record turn-1 cache_read. Then one session with /compact in the middle (v2 arm) and record the turns after it.
Report per arm: cache breaks per session, hit ratio per turn, cross-session prefix read, and the first-turn prefix size (system+tools tokens) per arm. Pass = v2 breaks <= off breaks, v2 hit ratio >= off - 2 points on turns 2-6, v2 cross-session prefix read >= 90% of v2 turn-1 prefix. Commit the runner and results JSON (docs/v2/spikes/cache/claude-code.json). Return done, breaks, numbers, commits, summary.`

const LIVE_CX = `${base('cx')}\n\nRole: live A/B on Codex (logged in with ChatGPT on this machine; copy only its auth file into a temp CODEX_HOME). Use codex exec --json with resume for a 5-turn session, same turn mix as the Claude runner, arms off and v2 (setup --agents codex into the temp CODEX_HOME), n=2. Read usage.cached_input_tokens / input_tokens per turn from the JSON events. Cross-session: two fresh sessions back to back. Same pass rule (breaks, hit ratio within 2 points, cross-session read). If codex exec cannot resume or hides usage, say so and fall back to nothing: report the gap. Commit e2e/live/cache/codex.mjs and docs/v2/spikes/cache/codex.json. Return done, breaks, numbers, commits, summary.`

const DOCS = `${base('docs')}\n\nRole: host docs (web search, primary sources, current versions) for gemini, qwen, copilot-cli, opencode, pi, vscode, kiro, zcode: (1) does the host use provider prompt caching and what is the prefix order (system, tools, history); (2) where does hook-injected context land (system prompt rebuilt per turn? appended to the user turn?); (3) does replacing a tool result in a hook happen before the result enters history; (4) does the host rebuild the tool list per turn from MCP tools/list and does it re-fetch on list_changed. With the static audit's rule (byte-identical tools/list, no list_changed), classify each host: cache-safe / break (where) / unknown (what is missing). Write docs/v2/spikes/cache/hosts.md with every URL + version. Return done, breaks, numbers, commits, summary.`

phase('Measure')
const found = (await parallel([
  () => agent(STATIC, { label: 'cp-static', phase: 'Measure', schema: FIND, ...OPH }),
  () => agent(MINE, { label: 'cp-mine', phase: 'Measure', schema: FIND, ...SNM }),
  () => agent(LIVE_CC, { label: 'cp-live-cc', phase: 'Measure', schema: FIND, ...SNH }),
  () => agent(LIVE_CX, { label: 'cp-live-codex', phase: 'Measure', schema: FIND, ...SNH }),
  () => agent(DOCS, { label: 'cp-hosts', phase: 'Measure', schema: FIND, ...SNM }),
])).filter(Boolean)
const breaks = found.flatMap((f) => f.breaks)
log(`measure done: ${found.length}/5 agents, ${breaks.length} break(s) reported`)

phase('Fix')
let fix = null, again = null
if (breaks.length) {
  fix = await agent(`${base('fix')}\n\nCache breaks found: ${JSON.stringify(breaks).slice(0, 10000)}. Measurement summaries: ${JSON.stringify(found.map((f) => ({ n: f.numbers, s: f.summary.slice(0, 600) }))).slice(0, 6000)}.
Fix each real break at the root, test-first (a red test that shows the break, then the fix): e.g. move any varying text out of instructions/tool descriptions, make tool order and text deterministic, never emit list_changed in a session, put per-session or per-turn context only where the host appends it after the prefix, never re-emit or edit earlier content. Keep saving and routing intact: run node --test tests/v2/, gate --all --quick, and GP-LIVE-ROUTING (sonnet) once. If a reported break is not real (host behaviour, or the off arm breaks the same way), say why with evidence and do not change code. Return done, commits, numbers, summary.`, { label: 'cp-fix', phase: 'Fix', schema: RESULT, ...OPH })
  again = await agent(`${base('again')}\n\nRe-measure after the fix (${JSON.stringify(fix).slice(0, 1500)}): run e2e/live/cache/run.mjs (Claude Code, n=3 per arm, cap $6) and e2e/live/cache/codex.mjs (n=2) on the current v2-design head, plus tests/v2/cache. Same pass rule. Commit results JSON next to the first ones (suffix -after). Return done, breaks, numbers, commits, summary.`, { label: 'cp-again', phase: 'Fix', schema: FIND, ...SNH })
}

phase('Ship')
const doc = await agent(`${base('doc')}\n\nWrite docs/v2/spikes/cache/RESULT.md: the question (does v2 break the prompt cache), the definitions, the static audit, mined numbers, live Claude Code and Codex A/B (every run, per-turn hit ratio, breaks, cross-session read), host table (cache-safe / break / unknown with sources), fixes and after numbers, open items. Plain short sentences, Gateway not involved. Add one ADR-0021 "Prompt-cache safety" with the rules the code now follows and the test that guards them. Update docs/v2/OPEN-ITEMS.md. Inputs: ${JSON.stringify({ found, fix, again }).slice(0, 14000)}. Commit, push. Return done, commits, numbers, summary.`, { label: 'cp-doc', phase: 'Ship', schema: RESULT, ...SNM })
const rv = await agent(`${base('review')}\n\nRole: adversarial review of the cache proof. Claims: ${JSON.stringify(doc).slice(0, 2500)}. Fresh clone. Re-run bench/cache/mine.mjs and tests/v2/cache; recompute every number in docs/v2/spikes/cache/RESULT.md from the committed JSON; read 3 raw v2 transcripts and check the per-turn usage by hand; check the break definition is applied the same to both arms and that post-compact turns are separated. Fix wrong numbers in place; list real defects. Return pass, problems, summary.`, { label: 'cp-review', phase: 'Ship', schema: CHECK, ...OPH })
const g = await agent(`${base('gate')}\n\nRole: gate on v2-design. Fresh clone, install, build, node scripts/gate.mjs --all twice, build/check-install-docs.mjs, build/check-secrets.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'cp-gate', phase: 'Ship', schema: GATE, ...HKM })
if (g && !g.green) await agent(`${base('gatefix')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push. Return done, commits, numbers, summary.`, { label: 'cp-gatefix', phase: 'Ship', schema: RESULT, ...OPH })
const ci = await agent(`${base('ci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 60 min). If red, fix the root cause (never weaken an assertion or raise a budget), push, watch again, max 2 rounds. Report per OS x Node and the final run id.`,
  { label: 'cp-ci', phase: 'Ship', ...SNM })
return { found, fix, again, doc, review: rv, gate: g, ci }
