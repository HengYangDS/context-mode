export const meta = {
  name: 'v2-night-npm-fixbench',
  description: 'Two tracks overnight: (A) fixture benchmark in the BENCHMARK.md style, v1 vs v2, deterministic, runs in seconds; (B) npm channel per ADR-0019 with PO decisions: build fix, context-mode CLI (setup/doctor/upgrade), tests, release.yml publish job (never run), gate, CI',
  phases: [
    { title: 'Bench', detail: 'fixture benchmark v1 vs v2, page, adversarial check' },
    { title: 'Npm', detail: 'decisions, build, CLI, tests, release job' },
    { title: 'Final', detail: 'gate, CI' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SNL = { model: 'claude-sonnet-5-5', effort: 'low' }
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
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never create a GitHub Release, never force-push v2-design.
NEVER run npm publish (not even a test package), never npm login, never change npm settings or dist-tags. npm pack and npm publish --dry-run are fine.
Own temp space only: /private/tmp/cm-v2-nt-${id} (clone, temp HOME, temp npm prefix). Never install into the real global prefix, never edit the real ~/.claude, ~/.codex, ~/.gemini, ~/.qwen, ~/.config. Delete your temp space before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken an assertion. DEVIATIONS.md row per behaviour change. Write no personal names, no tenant ids, no secrets.
Pace (hard rule): commit + push within your first 15 tool calls; push after each step; be done within 60 minutes; if blocked, push what you have and return done=false with the blocker in one line.`

// Opus sometimes fails with a safeguard API error; retry the same task once on Sonnet high.
async function run(prompt, label, phase, schema, opts) {
  const r = await agent(prompt, { label, phase, schema, ...opts })
  if (r) return r
  log(`${label}: no result on ${opts.model}, retry on sonnet high`)
  return agent(prompt, { label: label + '-retry', phase, schema, ...SNH })
}

// Track A: the v1 BENCHMARK.md method (real captured fixtures, tool output bytes, no model) for v1 and v2.
async function bench() {
  const w = await run(`${base('fb')}\n\nRole: benchmark engineer. Goal: a VERY short benchmark (whole run under 60 seconds, no model calls, no network) in the style of BENCHMARK.md on origin/main.
How v1 did it: origin/main BENCHMARK.md, tests/ecosystem-benchmark.ts, tests/benchmark.ts, tests/benchmark-results-v04.json, fixtures in tests/fixtures/ (21 scenarios: 14 ctx_execute_file summaries, 7 ctx_index + ctx_search). Raw size = fixture bytes; Context = bytes the tool returns to the model; Savings = 1 - context/raw; Time = tool time.
Do:
1. Copy the 21 fixtures from origin/main tests/fixtures into bench/fixtures/data/ on v2-design (record the v1 commit they came from).
2. Write bench/fixtures/run.mjs (plain Node, no deps): start the built v2 server (release-out/server.mjs) over MCP stdio, and for each scenario make the real tools/call that matches v1's scenario (port v1's exact code strings and search queries from ecosystem-benchmark.ts / benchmark.ts; if a v1 tool has no v2 twin, use the v2 tool that does the same job and say which). Also a third column: the v2 hook path: feed each fixture as a Claude Code PostToolUse Bash tool_response through release-out/hook.mjs --agent claude-code with the golden payload shape (e2e/fixtures/claude-code/2.1.303/PostToolUse-Bash-large.json) and measure the bytes the model would see after replace. Count code examples preserved for the index/search scenarios the way v1 did.
3. v1 column: build origin/main in your temp space (npm install there) and run v1's own script once to get today's v1 numbers; if the v1 install fails or takes over 10 minutes, use tests/benchmark-results-v04.json and the BENCHMARK.md table and say so.
4. Output bench/fixtures/results.json (schema: scenario, source, raw_bytes, v1_context_bytes, v2_tool_context_bytes, v2_hook_context_bytes, v2_ms, code_blocks, versions, shas, date) and docs/benchmarks/fixtures/README.md in the BENCHMARK.md layout: Overview table, Part 1, Part 2, Part 3 (hook path), totals, "What this measures and what it does not" (tool output bytes only, not cost; link docs/benchmarks/v1-v2-gateway and docs/benchmarks/try-it for live cost), How to reproduce (one command: node bench/fixtures/run.mjs). Show every row, including rows where v2 is worse.
5. Add a CI step in .github/workflows/ci.yml that runs node bench/fixtures/run.mjs --check (fails if any scenario errors or the total changes by more than 5% from results.json).
Commit, push. Return done, commits, numbers (per part totals v1 vs v2, run time), summary.`, 'fb-build', 'Bench', RESULT, OPH)
  const c = await run(`${base('fbc')}\n\nRole: adversarial checker. Fresh clone of v2-design. Run node bench/fixtures/run.mjs yourself and recompute every number in docs/benchmarks/fixtures/README.md and bench/fixtures/results.json. Check: each v2 scenario is a real tools/call or hook run (not hard-coded), the v1 numbers come from a real v1 run or are labelled as published, fixtures match origin/main byte for byte, totals add up, run time under 60 s. Fix wrong numbers in place, commit, push. Return pass, problems, summary.`, 'fb-check', 'Bench', CHECK, OPH)
  return { w, c }
}

// Track B: npm channel, ADR-0019. PO decisions taken by the assistant on the owner's mandate (2026-10-22).
const DECISIONS = `Product-owner decisions (2026-10-22, the owner delegated npm decisions to the assistant acting as PO; record them in ADR-0019 "Owner decisions" as "decided by PO on delegation, owner reviews in the morning"):
D1 Package: name context-mode, version 2.0.0, bin {"context-mode": "cli.mjs"} (no "./": npm 11 strips it), type module, engines {"node": ">=24.15.0"}, no dependencies, no install scripts, files = the release tree. package.json and cli.mjs are listed in SHA256SUMS; the npm tarball file list and hashes must equal release SHA256SUMS.
D2 Channel: npm is the user channel; the git release branch stays only for git-based installers. Publish with dist-tag next and --provenance through npm trusted publishing (OIDC) from release.yml, environment npm-publish. latest stays on v1 until the owner moves it by hand. O1 (trusted publisher on npmjs.com) stays an owner step.
D3 Hook budget (O2): the rule is hook overhead = hook wall time minus bare "node -e ''" wall time on the same host and run, p95 <= 15 ms; wall p95 is reported, not gated. Keep HOOK_P95_MS as the reported wall target.
D4 v1 compatibility (O3): the v2 CLI accepts the v1 forms "context-mode hook <platform> <event>" and "context-mode mcp" (alias of server) and maps them to v2; doctor reports them as "v1 form, run context-mode setup"; setup rewrites them to the absolute form node "<abs>/hook.mjs" --agent <id>.
D5 Prompt UI: @clack/prompts bundled at build time (devDependency only); TTY check first; no TTY = flag path.
D6 Issue reports: on FAIL show the redacted report and ask once; gh issue create if logged in, else print a prefilled URL; never send without a keypress.
D7 CLI follows ADR-0019 section 8 (clig.dev): --help with examples, exit codes 0/1/2/130, stdout results, stderr progress, --json, --yes, --no-input, --dry-run, NO_COLOR, Ctrl-C rollback.
Set ADR-0019 Status to "Accepted (PO on delegation 2026-10-22; O1 owner step open)".`

async function npm() {
  const steps = [
    { id: 'nd', opts: SNM, what: `${DECISIONS}\nTask: write the decisions into docs/v2/adr/0019-interactive-setup-and-npm-channel.md and docs/v2/PRD-setup.md (Rollout, Open questions closed), and amend ADR-0011 (step d npm deprecate removed: v2 is published on npm instead; dist-tag plan), ADR-0013 (npm publish job), ADR-0002 GS7 (package.json shape D1). Commit, push.` },
    { id: 'nb', opts: OPH, what: `${DECISIONS}\nTask: build. build/manifests.ts emits the D1 package.json into release-out; build adds cli.mjs (entry for the CLI, bundled) and lists package.json and cli.mjs in SHA256SUMS; assertOutPackageJson allows exactly the D1 keys (still throws on dependencies, scripts). cli.mjs for now: --help, --version, server (= node server.mjs), hook (= hook.mjs), and the v1 forms of D4. Tests first (tests/v2/build, a GP1 golden for the package shape, a test that npm pack file list + hashes equal SHA256SUMS). node --test tests/v2/ and gate --milestone M7 --quick. Commit, push.` },
    { id: 'nc', opts: OPH, what: `${DECISIONS}\nTask: the setup engine (no UI yet). src/setup/: one check registry built from src/adapters/table.ts (installMode, config paths, list command, allowed write paths, golden hook payloads), shared by setup, doctor and upgrade. Steps per ADR-0019 section 3: preflight, detect, plan (exact diff or agent command, absolute node "<abs>/server.mjs" and node "<abs>/hook.mjs" --agent <id>, never npx), apply (lock ~/.context-mode/setup.lock, backup ~/.context-mode/backups/<run-id>/, refuse unparsable files, atomic temp+rename, only context-mode keys, prefer the agent CLI), verify (parse, agent list command, MCP initialize + tools/list from the exact config command, hook golden payload and D3 budget, doctor checks), rollback per agent, summary. Idempotent; --remove restores byte for byte; never writes instruction files (allowlist guard). v1 entries from docs/v2/spikes/setup/S-V1.md detected and replaced. Tests first (E2E-style, temp HOME, fake agent binaries where the real one is absent). Commit + push after each step.` },
    { id: 'nu', opts: OPH, what: `${DECISIONS}\nTask: the CLI layer on the engine: context-mode setup, doctor (read-only, "fix now" runs setup for that agent), upgrade (npm i -g context-mode@<tag> then setup --repair), setup --list, --dry-run, --remove, --agents, --yes, --no-input, --json, --debug, --quiet, --verbose; @clack/prompts bundled (D5): multi-select, spinners, live checklist, summary table; D6 issue report; D7 rules; typo suggestion. ctx_doctor (MCP tool) prints the exact context-mode command to run. Tests: golden --help per command, exit code per failure class, no-TTY never blocks, NO_COLOR has no escape codes, pty run of the interactive flow (python3 pty or script(1)), Ctrl-C mid-apply leaves files byte-identical or fully applied. Commit + push after each step.` },
    { id: 'nt', opts: SNH, what: `${DECISIONS}\nTask: end-to-end install test. npm pack the build; in a clean temp HOME with a temp npm prefix: npm i -g <tarball>; context-mode setup --yes --agents <id> --json for every agent whose CLI can be installed into the temp prefix (claude-code, codex, gemini, qwen, opencode, pi, copilot-cli where possible; others with the fake-binary path); check each verify step passed; second run changes nothing; --remove restores byte for byte. Add this as e2e/cases/GP-SETUP-*.e2e.mjs and a CI job (ubuntu, macos, windows) that runs the fake-binary cases. Fix what fails at the root. Commit, push.` },
    { id: 'nr', opts: SNM, what: `${DECISIONS}\nTask: release.yml gets a publish-npm job after the release job: environment npm-publish, permissions id-token: write + contents: read, Node 24.15.0 with npm >= 11.5.1, npm publish release-out --provenance --tag next --access public, guarded by a check that the tarball equals SHA256SUMS. It runs only on a v2.* tag or workflow_dispatch with input publish=true; do NOT trigger it. Validate the YAML (actionlint if available, else a parse test). Write docs/v2/NPM-OWNER-STEPS.md: the exact npmjs.com trusted-publisher steps (from docs/v2/spikes/setup/S-NPM.md), then how to publish next, test, and move latest. Update README install section to the two commands (npm i -g context-mode@next && context-mode setup) under a "v2 preview" heading only; keep the v1 install text as is. Update check-install-docs.mjs rules. Commit, push.` },
  ]
  const out = []
  for (const s of steps) {
    const r = await run(`${base(s.id)}\n\n${s.what}\nReturn done, commits, numbers, summary (before/after, 5 lines).`, s.id, 'Npm', RESULT, s.opts)
    out.push({ id: s.id, done: !!(r && r.done), r })
    log(`npm ${s.id}: ${r && r.done ? 'done' : 'NOT done'}`)
    if (s.id === 'nb' && !(r && r.done)) break
  }
  return out
}

phase('Bench')
const [b, n] = await parallel([() => bench(), () => npm()])

phase('Final')
const g = await agent(`${base('ng')}\n\nRole: gate. Fresh clone of v2-design, install, build, node scripts/gate.mjs --all three times, node build/check-removed.mjs, node build/check-install-docs.mjs, node bench/fixtures/run.mjs --check. Do not fix. Return green, failing, summary.`,
  { label: 'ng', phase: 'Final', schema: GATE, ...SNL })
if (g && !g.green) await run(`${base('ngf')}\n\nRole: fixer. Failing: ${JSON.stringify(g.failing)} — ${g.summary}. Fix at the root, gate --all once, commit, push.`, 'ngf', 'Final', RESULT, OPH)
const ci = await agent(`${base('nci')}\n\nRole: CI checker. gh run watch the latest ci.yml run on v2-design (up to 90 min; queued macOS runners are not a failure). If red, fix the root cause, push, watch again (max 2 rounds). Report per OS and Node.`,
  { label: 'nci', phase: 'Final', ...SNM })
return { bench: b, npm: n, gate: g, ci }
