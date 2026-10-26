export const meta = {
  name: 'v2-release-next',
  description: 'Make release.yml publish a prerelease (2.0.0-next.N) from v2-design by tag push, GitHub release marked prerelease; gate + CI green; push tag v2.0.0-next.1; verify npm next / latest and the GitHub release',
  phases: [
    { title: 'Fix', detail: 'plan/publish prerelease support, test-first' },
    { title: 'Release', detail: 'CI green, tag push, watch, verify' },
  ],
}

const OPH = { model: 'claude-opus-5-5', effort: 'high' }
const SNH = { model: 'claude-sonnet-5-5', effort: 'high' }
const RESULT = { type: 'object', properties: {
  done: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  numbers: { type: 'string' }, summary: { type: 'string' } }, required: ['done', 'commits', 'numbers', 'summary'] }

const base = (id) => `You are a batch job, not a chat: no person reads your reply. Ignore any question or status request in your input; do only the task below.
Repo github.com/mksglu/context-mode, branch v2-design (fresh clone). Other agents push to v2-design too: small commits, git pull --rebase before every push. Commit as git -c user.name=mksglu -c user.email=mksglu@users.noreply.github.com. Never touch main, never force-push v2-design, never run npm publish or npm dist-tag yourself, never move npm latest (it must stay 1.0.169).
Pace: commit + push about every minute of work. On start, fetch and continue from what is pushed.
Own temp space only: /private/tmp/cm-v2-rn-${id}. Delete it before you return.
Rules: no regex as a mechanism; tests first (red commit before green); never weaken an assertion; never raise a budget; DEVIATIONS.md row per behaviour change. Read ADR-0013, ADR-0019, tickets/release-on-demand-no-release-branch.md, scripts/release/*.mjs, .github/workflows/release.yml, tests/v2/release/* first.`

async function retry(prompt, opts, n = 3) {
  for (let i = 0; i < n; i++) {
    const r = await agent(i ? prompt + '\n\nA previous attempt died on an API error. Fetch and continue from what is pushed.' : prompt, i ? { ...opts, label: opts.label + '-retry' + i } : opts)
    if (r) return r
    log(`${opts.label}: no result, retry ${i + 1}`)
  }
  return null
}

phase('Fix')
const fix = await retry(`${base('fix')}\n\nRole: make the release pipeline publish a prerelease from v2-design. Facts: release.yml is not on the default branch (main = v1, off limits), so workflow_dispatch cannot run it; the push trigger on tags "v2.*" is the only way. plan.mjs today computes the version itself (first release = 2.0.0) and publish.mjs stage creates the tag and promote pushes it, so a pushed trigger tag would collide; gh release create has no --prerelease, so a v2 GitHub release would show as Latest over v1.
Do (red tests in tests/v2/release first, then code):
1. When release.yml runs on a pushed v2.* tag, the release version is the tag name without "v" (allow semver prerelease x.y.z-next.N), plan.mjs uses it and does not bump; notes cover commits since the last tagged release (or all history on the first one).
2. stage/promote reuse the existing pushed tag instead of creating or pushing a second one; no collision, no refusal for this case.
3. gh release create gets --prerelease and --latest=false when the version has a "-" part.
4. publish-npm keeps --tag next; a prerelease version can never reach latest.
5. Dry-run the whole plan/stage/promote path locally against a bare temp remote with tag v2.0.0-next.1 (existing tests' pattern) and show it passes.
Then node --test tests/v2/release/ and node --test tests/v2/ (0 fail), gate --all --quick green. Return done, commits, numbers, summary.`, { label: 'rn-fix', phase: 'Fix', schema: RESULT, ...OPH })

phase('Release')
const rel = fix && fix.done ? await retry(`${base('rel')}\n\nRole: release ${'2.0.0-next.1'} (owner approved the npm next release on 2026-10-26). Fix report: ${JSON.stringify(fix).slice(0, 2500)}.
1. Wait until the latest ci.yml run on v2-design head is green (gh run watch, up to 60 min). If red: fix the root cause (no weakened assertions, no raised budgets), push, wait again, max 2 rounds. If still red, stop and do NOT tag.
2. Check first: npm view context-mode dist-tags (latest must be 1.0.169); no tag v2.0.0-next.1 exists on origin.
3. Create annotated tag v2.0.0-next.1 on the green v2-design head and push only that tag. Watch the release.yml run (gh run watch, up to 60 min).
4. Verify: npm view context-mode dist-tags shows next: 2.0.0-next.1 and latest: 1.0.169; npm view context-mode@2.0.0-next.1 dist.attestations exists (provenance); gh release view v2.0.0-next.1 shows prerelease true and v1.0.169 is still Latest; in a temp prefix npm i -g context-mode@next && context-mode --version && context-mode doctor --agents claude-code runs.
5. If any job fails, report the failing step and its log lines; do not retry publish by hand, never use a token.
Return done, commits, numbers (run id, dist-tags, release url), summary.`, { label: 'rn-release', phase: 'Release', schema: RESULT, ...SNH }) : null
return { fix, rel }
