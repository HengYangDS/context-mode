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

## Re-run after fixes
Same steps on the fixed v2-design (bcda6561), with the old `release` and `release-staging` branches left in place.
- plan.mjs: 2.0.0 with the rehearsal branch present (problem 4 fixed, D-FU-RF-1).
- Build: 13 top-level entries, SHA256SUMS all OK, prompt lint OK.
- Stage: `release-staging` = 04385377f6bccaacb6e7566a3eadc9a472965113, tag v2.0.0 local only.
- Smoke on release-staging: claude-code PASS with the real binary found without PATH reorder (problem 2 fixed, D-FU-RF-2); codex PASS; gemini SKIPPED (not installed).
- Promote to a local bare clone: `release` and tag v2.0.0 moved, `gh release` skipped (remote not origin).
- GitHub `release` updated with `git push --force-with-lease origin <sha>:refs/heads/release --no-follow-tags` (rehearsal branch only): 152f63b8 -> 04385377.
- Install from GitHub in a temp HOME (`git clone --depth 1 --branch release`): SHA256SUMS OK; server.mjs initialize ok, tools/list 9 tools.
- Hook, hand-written PostToolUse Bash payload (documented fields only, 12 KB stdout): replace, 284 B ({stdout, stderr, interrupted}). The golden payload also replaces (285 B). Problem 3 is fixed on the payload side. The hook returns empty when `CLAUDE_PROJECT_DIR` is not set; Claude Code sets it for hooks, so a manual test must set it.
- End state: no refs/tags/v2*, no v2 GitHub Release, main stays a92cf6a77ac02971fb5fafe2155e5ee229491884.
- Notes: `publish.mjs --stage` leaves the clone on `release-staging` and removes node_modules; check out v2-design and reinstall before smoke.
- Still open: release.yml on main, delete `release`/`release-staging` before the real release, gemini smoke.

## Re-run 2 (manifests)
Same steps on v2-design bcf7e406, with the old `release` and `release-staging` branches (04385377) left in place.
- plan.mjs: 2.0.0 with the rehearsal branch present.
- Build: 15 top-level entries, SHA256SUMS all OK, prompt lint OK.
- Stage: `release-staging` = 87a17f8f8fd62b1d7cc9f0afdd39f0afe5a630ec, tag v2.0.0 local only. `publish.mjs --stage` pushes, so it needs git credentials; a temp HOME has none. Run it with the normal HOME (it only reads credentials). A failed stage leaves a local tag v2.0.0 and a local `release-staging`; delete both before a retry.
- Smoke on release-staging: claude-code PASS (real binary), codex PASS, gemini SKIPPED (not installed).
- Promote to a local bare clone: `release` and tag v2.0.0 moved, `gh release` skipped (remote not origin).
- GitHub `release` updated with `git push --force-with-lease=refs/heads/release:04385377... origin 87a17f8f:refs/heads/release --no-follow-tags` (rehearsal branch only): 04385377 -> 87a17f8f.
- Install from GitHub (`git clone --depth 1 --branch release`): 24 files, SHA256SUMS OK. Root package.json has the `pi` key (private, type, version). `gemini-extension.json` and `hooks/hooks.json` present. Fixed `qwen-extension.json`, `hooks/qwen.json`, `hooks/codex.json`, `hooks/vscode.json`, `hooks/copilot-cli.json`, `hooks/kiro.json` present.
- End state: no refs/tags/v2*, no v2 GitHub Release (latest is v1.0.169), main stays a92cf6a77ac02971fb5fafe2155e5ee229491884.

## Re-run 3 (kiro prompt hook, qwen extension)
Same steps on v2-design c507e005, with the old `release` and `release-staging` branches (87a17f8f) left in place.
- Gate M7 quick: PASS (v2-unit 1278 pass, 0 fail; ci-checks, gp-cases, prompt-lint, check-removed PASS; live skipped).
- plan.mjs: 2.0.0 with the rehearsal branch present.
- Build: 14 top-level entries, SHA256SUMS all OK, prompt lint OK.
- Stage: `release-staging` = 05e977243ed65d24808ab1b6471721b64a83fa94, tag v2.0.0 local only.
- Smoke on release-staging: claude-code PASS, codex PASS, gemini SKIPPED (not installed).
- Promote to a local bare clone: `release` and tag v2.0.0 moved, `gh release` skipped (remote not origin).
- GitHub `release` updated with `git push --force-with-lease=refs/heads/release:87a17f8f... origin 05e97724:refs/heads/release --no-follow-tags` (rehearsal branch only): 87a17f8f -> 05e97724.
- Install from GitHub in a temp HOME: SHA256SUMS OK. `hook.mjs --agent kiro` with a `UserPromptSubmit` payload: exit 0, empty stdout, no decode error. `qwen extensions install ...:context-mode --ref release --consent` (Qwen Code 0.26.0): installed, server Connected, uninstall clean.
- End state: no refs/tags/v2*, no v2 GitHub Release, main stays a92cf6a77ac02971fb5fafe2155e5ee229491884.
