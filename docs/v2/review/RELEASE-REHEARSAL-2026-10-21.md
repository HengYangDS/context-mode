# Release rehearsal, 2026-10-21

Goal: put a `release` branch with built files on GitHub and test it. No tag, no GitHub Release, no npm, main untouched.
`release.yml` exists only on v2-design, so GitHub cannot dispatch it. The same scripts ran locally.

## Jobs in release.yml
- ci: calls ci.yml.
- plan: checkout, fetch `release` if it exists, `plan.mjs` gives version and notes.
- build: `npm install`, `build/build.mjs`, prompt lint, `claude plugin validate`, attest, upload `release-out`.
- publish-stage: `publish.mjs --stage` commits `release-out` as one commit on `release-staging`, local annotated tag, push branch only.
- smoke: `smoke.mjs --ref release-staging` for claude-code, codex, gemini on 3 OS.
- publish-promote: `publish.mjs --promote` fast-forwards `release`, pushes tag, `gh release create` (default remote only).
- rollback: `rollback.mjs --sha` hard-resets `release`.

## Results
- Gate M7 quick: v2-unit 1202 pass, 0 fail; ci-checks, gp-cases, prompt-lint PASS. check-removed FAIL only on docs/benchmarks (outside target tree, handled elsewhere); live skipped because of it.
- plan.mjs without `release`: 2.0.0. With a `release` branch: "no releasable commits since <sha>". So a pre-existing `release` changes the real first release (see LAUNCH.md note). After a local delete, 2.0.0 returned.
- Build: 23 files, SHA256SUMS all OK, lint OK.
- Stage: `release-staging` = 152f63b8517d522ded7cbb80707159b3d029ef9f. No v2 tag on GitHub.
- Smoke on release-staging: claude-code PASS (with real binary, see problem 2), codex PASS, gemini SKIPPED (not installed).
- Promote to local bare clone: `release` fast-forward, tag v2.0.0 annotated, `gh release` skipped (remote not origin). Pushed `release` on GitHub with `--no-follow-tags` at the staged sha.
- Install from GitHub (`git clone --depth 1 --branch release`): 23 files, SHA256SUMS OK, `git pull` works. server.mjs: initialize ok, 9 tools. Hook with golden PostToolUse Bash payload (8892 B): replace shape {stdout, stderr, interrupted}, 149 B.
- Live `claude -p` (sonnet-5-5, low): Bash `seq 1 3000`, the model saw 157 bytes (head, tail, ctx_search hint). Run stopped with error_max_budget_usd (cost 0.135 over 0.1) after the result.
- End state: branches release and release-staging exist; no refs/tags/v2*; no v2 GitHub Release; main stays a1712dbb7af1a579bf3a4c5a98236b4127630b76.

## Problems
1. `release.yml` must be on main to be dispatched. Not done here (main untouched).
2. `claude` on this machine's PATH is a claude-worktree shim; smoke failed with an empty error until /opt/homebrew/bin came first. Smoke should call the real binary or report stderr.
3. A hand-made small hook payload returns empty output; only the real payload shape triggers replace. Docs examples should use the golden payload.
4. A `release` branch blocks the first release (plan.mjs). Delete `release` and `release-staging` first.
5. server.mjs prints a zod version warning on stderr (harmless).
6. `--max-budget-usd 0.1` is too low for one live call.

## Before the real release
- Put release.yml on main, then run `git push origin --delete release release-staging`.
- Re-run gate once check-removed is fixed.
- Gemini smoke not covered here.
