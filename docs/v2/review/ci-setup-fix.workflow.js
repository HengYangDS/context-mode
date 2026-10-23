export const meta = {
  name: 'v2-ci-setup-fix',
  description: 'Make CI green on v2-design after the npm/setup work: GP-SETUP doctor exit 1 on Node 24, Windows fake agent binaries not on PATH, flaky hook-overhead timing in a functional e2e, stray DEVIATIONS.md-e',
  phases: [
    { title: 'Fix', detail: 'root causes, one commit each' },
    { title: 'CI', detail: 'watch until green, max 3 rounds' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const SNM = { model: 'claude-sonnet-5-5', effort: 'medium' }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design. Commit + push allowed (git pull --rebase on reject, max 5). Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never tag, never create a GitHub Release, never force-push, never npm publish.
Own temp space only: /private/tmp/cm-v2-ci-${id}. Delete it before you return. npm install --no-package-lock; node build/build.mjs --generated-only before node --test.
Tests first. Never weaken a functional assertion. DEVIATIONS.md row per behaviour change. Write no personal names.
Pace: commit + push within your first 15 tool calls; push after each step; done within 60 minutes.`

phase('Fix')
const prompt = `${base('fix')}\n\nCI on v2-design is red (runs 39878788930 on cd326952, 39878033502, 39877329454). Read the failing job logs with gh run view --log-failed. Known causes from the last fixer:
1. ci jobs ubuntu Node 24, macOS Node 24 and 26: e2e/cases/run.mjs runs GP-SETUP-npm-pack-install-setup-twice-remove and "doctor" exits 1. Find which doctor check fails on those runners and fix the root cause (product bug or test setup), not the assertion.
2. setup e2e job on Windows: the fake agent binaries are not found ("claude not on PATH"). On Windows a fake CLI needs a .cmd shim (and PATHEXT), and setup's agent detection must find .cmd/.exe the way the real agents install. Fix both the test shims and, if needed, detection in src/setup.
3. The hook overhead budget (D3, p95 <= 15 ms) makes the functional GP-SETUP case flaky on shared CI runners. Rule: a functional e2e checks the hook answers the golden payload with the right shape and records the overhead; it does not fail on timing. Timing is gated in one place only: a dedicated perf check (more samples, median of 3 batches) that runs in the CI ubuntu job and prints the number; keep the 15 ms rule in ADR-0019 D3 and say in DEVIATIONS that CI runners gate the perf check, not the functional case.
4. Delete the stray tracked file docs/v2/impl/DEVIATIONS.md-e (a sed backup with merge markers) and check no other *-e backup files are tracked.
Run node --test tests/v2/ and node scripts/gate.mjs --all locally. Commit + push one commit per root cause. Return a short report: cause, fix, commit, per item.`
let fix = await agent(prompt, { label: 'ci-fix', phase: 'Fix', ...OPH })
if (!fix) fix = await agent(prompt, { label: 'ci-fix-retry', phase: 'Fix', ...SNH })

phase('CI')
const ci = await agent(`${base('watch')}\n\nRole: CI checker. Watch the latest ci.yml run on v2-design with gh run watch (up to 90 min per round; queued macOS runners are not a failure). If red, read the failed logs, fix the root cause (never weaken a functional assertion, never skip a job), push, watch again. Max 3 rounds. Report a table per OS x Node plus the setup e2e jobs, the final run id and head sha, and anything still red with its cause.`,
  { label: 'ci-watch', phase: 'CI', ...SNH })
return { fix, ci }
