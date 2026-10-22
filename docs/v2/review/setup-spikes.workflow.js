export const meta = {
  name: 'v2-setup-spikes',
  description: 'ADR-0019 spikes: S-NPM, S-PATH, S-HOOK, S-EXT, S-UI, S-V1 in parallel, each pushes its result; then ADR-0019 and PRD-setup updated with the evidence',
  phases: [
    { title: 'Spikes', detail: '6 spikes in parallel, disjoint files' },
    { title: 'Synthesis', detail: 'ADR-0019 open items closed with evidence, owner decisions listed' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }
const SPIKE = { type: 'object', properties: {
  id: { type: 'string' }, pass: { type: 'boolean' }, result: { type: 'string' },
  evidence: { type: 'string' }, adrChange: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } } },
  required: ['id', 'pass', 'result', 'evidence', 'adrChange', 'commits'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Read docs/v2/adr/0019-interactive-setup-and-npm-channel.md and docs/v2/PRD-setup.md first (only these two, plus the files your spike names). Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never create a GitHub Release.
NEVER run npm publish (not even to a test package), never npm login, never change npm settings or dist-tags: npm is outward-facing and needs the owner. npm publish --dry-run and npm pack are fine.
Own temp space only: /private/tmp/cm-v2-sp-${id} (clone, temp HOME, temp npm prefix). Never install anything into the real global prefix, never edit the real ~/.claude, ~/.codex, ~/.gemini, ~/.qwen. Delete your temp space before you return.
Write your result to docs/v2/spikes/setup/${id}.md (question, method, raw numbers or outputs, pass/fail against the ADR-0019 pass column, what the ADR must change). Commit and push it. Write no personal names.
Pace (hard rule): commit+push a first draft of the result file within your first 15 tool calls; push after each step; be done within 45 minutes; if blocked, push what you have and return pass=false with the blocker.`

const SPIKES = [
  { id: 'S-NPM', what: `Question: can release.yml publish context-mode to npm with trusted publishing (OIDC, no long-lived token) and provenance? Method: read npm docs on trusted publishing and provenance (cite URLs, date), the current .github/workflows/release.yml and scripts/release/publish.mjs. Build release-out, add the ADR-0019 package.json shape (name context-mode, version, bin context-mode -> ./cli.mjs, no dependencies, no scripts, pi key) in your temp copy only, run npm pack and npm publish --dry-run on it, and report the file list, size, and whether it equals release SHA256SUMS. Write the exact release.yml job (permissions id-token: write, npm publish --provenance --tag next) as a proposal in the result file, not in release.yml. List the one-time owner steps on npmjs.com.` },
  { id: 'S-PATH', what: `Question: where does npm i -g put the package, and can a CLI find its own absolute install path every time? Method: npm pack a minimal package with bin context-mode whose cli prints import.meta.url / fileURLToPath and realpath. Locally: system or Homebrew node, nvm (if present), fnm/Volta (install into your temp space only if quick). For Linux and Windows: push a branch spike/setup-path with a .github/workflows/spike-setup-path.yml triggered on push to that branch, matrix ubuntu/macos/windows x node 24.15.0/26, that does npm i -g of the tarball and runs context-mode to print its path, also through the .cmd shim on Windows and from a spawned process with shell:false. Collect gh run results. Delete the spike branch afterwards (git push origin --delete spike/setup-path). Pass: 6 of 6 layouts give the real absolute path.` },
  { id: 'S-HOOK', what: `Question: hook latency for three forms. Build release-out. With a golden Claude Code PostToolUse payload (e2e/fixtures/claude-code/2.1.303/PostToolUse-Bash-large.json) and a small PreToolUse payload, measure 50 runs each, cold and warm, p50/p95: (1) node /abs/release-out/hook.mjs --agent claude-code, (2) a global bin shim context-mode hook installed into your temp npm prefix (npm i -g --prefix of an npm pack tarball with a bin that imports hook.mjs), (3) npx --prefix <temp> context-mode hook (offline cache warm, and cold). Compare with HOOK_P95_MS 40 in src/core/contracts/constants.ts. Pass: (1) under 40 ms p95; record the others.` },
  { id: 'S-EXT', what: `Question: can Gemini and Qwen extensions be installed from the npm package dir instead of git, and stay current after npm i -g? Method: build release-out, npm pack + npm i -g into a temp prefix, then in a temp HOME install @google/gemini-cli and Qwen Code CLI into the temp prefix; run gemini extensions link <pkg dir> and the qwen equivalent; check extensions list shows enabled, the MCP server is connected (or its command starts and answers tools/list), and the hook command runs with a sample payload. Then npm i -g a second tarball with a bumped version and check the linked extension sees the new files. Pass: both agents list the extension and the hook runs, after the update too.` },
  { id: 'S-UI', what: `Question: prompt UI as a bundled library (@clack/prompts) or an own module on node:readline? Method: check @clack/prompts licence, size bundled with esbuild (minified), and whether it handles no-TTY and NO_COLOR. Write two tiny prototypes in your temp space (multi-select of 3 agents, confirm, spinner with 3 steps, summary table), one per option. Drive each in a pseudo-terminal (macOS script(1) or python3 pty, no new dependency) with arrow keys and space/enter, capture the screen, check the result; also run each with stdin not a TTY. Report bytes added, lines of code, pty results. Recommend one.` },
  { id: 'S-V1', what: `Question: which v1 entries must setup find and replace, per agent? Method: git archaeology on origin/main (v1): src/cli.ts setup/upgrade code, configs/, hooks/, .claude-plugin, .codex-plugin, docs, and the v1 README install sections. For each agent list every file and key v1 writes (MCP entries, hook entries, plugin/marketplace registrations, settings like hook timeouts, routing blocks in instruction files such as CLAUDE.md/AGENTS.md), with the exact shape and the v1 commit that added it. Add the linked issue numbers. Output a table (agent, file, key or block, v1 shape, how setup detects it, replace or remove). Pass: every agent in src/adapters/table.ts covered.` },
]

phase('Spikes')
const res = await parallel(SPIKES.map((s) => () => agent(`${base(s.id)}\n\nSpike ${s.id}. ${s.what}\nReturn id, pass, result (5 lines), evidence (numbers, versions, run ids), adrChange (what ADR-0019 must change), commits.`,
  { label: s.id, phase: 'Spikes', schema: SPIKE, ...SNM })))
const done = res.filter(Boolean)
log(done.map((r) => `${r.id}: ${r.pass ? 'pass' : 'FAIL'}`).join(', '))

phase('Synthesis')
const syn = await agent(`${base('S-SYN')}\n\nRole: ADR editor. Spike results: ${JSON.stringify(done).slice(0, 14000)}. Read docs/v2/spikes/setup/*.md. Update docs/v2/adr/0019-interactive-setup-and-npm-channel.md: replace the Open items table with a Results table (id, result, evidence link, pass/fail); change any decision a spike contradicted, with the reason; keep Status "Proposed" and list at the end, under "Owner decisions", only what needs the owner (npm trusted publisher setup on npmjs.com, prompt UI choice if close, anything a failed spike left open), each with a recommendation. Update docs/v2/PRD-setup.md Rollout step 1 and Open questions the same way. Commit, push. Return 6 lines: per spike pass/fail and the owner decisions.`,
  { label: 'S-SYN', phase: 'Synthesis', ...OPH })
return { spikes: done.map((r) => ({ id: r.id, pass: r.pass, result: r.result })), synthesis: syn }
