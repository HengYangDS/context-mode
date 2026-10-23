export const meta = {
  name: 'v2-hook-startup',
  description: 'Cut hook.mjs startup cost so the D3 perf gate (overhead p95 <= 15 ms) passes on ubuntu Node 24 without raising the budget; then watch CI',
  phases: [
    { title: 'Profile', detail: 'measure and cut hook startup' },
    { title: 'CI', detail: 'watch until green, max 2 rounds' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-hs-${id}. Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Never raise the 15 ms budget (ADR-0019 D3), never skip or weaken the perf check. DEVIATIONS.md row per behaviour change. Write no personal names.
Pace: commit + push within your first 15 tool calls; push after each step; done within 60 minutes.`

phase('Profile')
const prompt = `${base('prof')}\n\nCI run 39882613923 (head fc6ce76f): only ubuntu Node 24.15.0 fails "D3 hook overhead p95 <= 15 ms" (e2e/checks/setup-hook-overhead.mjs): claude-code batches 17,16,16,16,17 ms, codex 16,15,15,17,17. Node 26 passes. So hook.mjs costs about 1-2 ms too much on Node 24.
Task: cut the hook's own startup cost.
1. Measure locally with Node 24.15.0 (install it into your temp space, e.g. via npx -y node@24.15.0 or a downloaded tarball) and Node 26: node --cpu-prof and a module-load trace (NODE_DEBUG=module or --trace-... flags) of release-out/hook.mjs on the golden PostToolUse and PreToolUse payloads. List the top costs (module evaluation, large constant tables, node:sqlite open, JSON parse, sync fs).
2. Cut them at the root, in this order of preference: do no work the event does not need (lazy import per event and per agent, no DB open on a PreToolUse that does not touch the DB), smaller bundle for the hook entry (separate esbuild entry, tree-shaking, no prompt/CLI code in hook.mjs), module.enableCompileCache() with a cache dir under ~/.context-mode/ if it helps on a cold+warm measure and is safe on all OSes.
3. Show before/after p95 overhead with the same perf check on Node 24 and 26 locally. Unit tests and node scripts/gate.mjs --all pass. Commit + push one commit per change. Return: top costs found, changes, before/after numbers, commits.`
let prof = await agent(prompt, { label: 'hs-prof', phase: 'Profile', ...OPH })
if (!prof) prof = await agent(prompt, { label: 'hs-prof-retry', phase: 'Profile', ...SNH })

phase('CI')
const ci = await agent(`${base('ci')}\n\nRole: CI checker. Watch the latest ci.yml run on v2-design with gh run watch (up to 90 min per round). If red, read the failed logs, fix the root cause (same rules: never raise the budget, never skip a job), push, watch again. Max 2 rounds. Report a table per OS x Node plus the setup e2e jobs, the final run id and head sha, the D3 perf check numbers per runner, and anything still red with its cause.`,
  { label: 'hs-ci', phase: 'CI', ...SNH })
return { prof, ci }
