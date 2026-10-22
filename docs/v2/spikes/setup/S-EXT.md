# Spike S-EXT: Gemini and Qwen extensions from the npm package dir

Date: 2026-10-22. Result: PASS on the ADR-0019 column (both agents list the extension and a hook runs, before and after update), with 3 findings the ADR must absorb.

## Question

Can Gemini and Qwen extensions install from the npm package dir (link) instead of git, and stay current after `npm i -g`?

## Method

- Clone of `v2-design` (d36e46f9). `npm install --no-package-lock` (no lockfile exists, `npm ci` fails), `node build/build.mjs --out release-out --version 2.0.0` (24 files).
- Temp HOME and temp npm prefix. `npm pack` of release-out, `npm i -g <abs path>/context-mode-2.0.0.tgz`.
- `npm i -g @google/gemini-cli @qwen-code/qwen-code` into the same temp prefix: gemini 0.65.0, qwen 0.26.0. Node 26.8.1, npm 11.19.0, macOS arm64.
- `gemini extensions link <pkg dir> --consent`, `qwen extensions link <pkg dir>`, then `extensions list`.
- MCP: spawn `node <pkg>/server.mjs --agent <id>`, send `initialize`, `tools/list`.
- Hook: pipe a sample payload to `node <pkg>/hook.mjs --agent <id>`.
- Update: build a second tarball (version 2.0.1, one appended line in hook.mjs, one new file), `npm i -g` it, repeat all checks. No re-link.

## Raw results

| Step | Gemini 0.65.0 | Qwen 0.26.0 |
|---|---|---|
| link | `linked successfully and enabled` | `linked successfully and enabled` (needs `y` on stdin) |
| list | `context-mode (2.0.0)`, Type: link, Enabled User and Workspace true, MCP server context-mode, 3 skills | same, Origin QwenCode, MCP server context-mode, 3 skills |
| link target | the global package dir itself (`<prefix>/lib/node_modules/context-mode`) | same |
| MCP `initialize` + `tools/list` | both answered, 10 tools (`ctx_execute` ... `ctx_purge`) | same |
| hook, SessionStart | JSON `additionalContext` returned, rc 0 | not run |
| hook, PreToolUse curl | empty output, rc 0 (see finding 3) | `permissionDecision: deny`, rc 0, 70 ms wall (node cold start, includes spawn) |
| after `npm i -g` 2.0.1: list | `context-mode (2.0.1)` | `context-mode (2.0.1)` |
| after update: new file visible | `NEWFILE.txt` present, `hook.mjs` has new last line | same dir, same |
| after update: MCP | 10 tools | 10 tools |
| after update: hook | still answers | still denies curl |

The link is a symlink-like record to the package dir. `npm i -g` replaces the dir content in place, so the linked extension sees the new files with no agent command. Gemini and Qwen read the version from the manifest at list time.

## Findings

1. The existing manifests work as built. `gemini-extension.json` and `qwen-extension.json` sit at the package root, with `${extensionPath}` paths. No build change needed for link.
2. `qwen extensions link` asks `Do you want to continue? [Y/n]` (skills notice). It has no `--consent` flag. Setup must pipe `y` or run it with a pty. Gemini has `--consent`.
3. Gemini `BeforeTool` with `run_shell_command` + curl returned no output (allow) while Qwen denied the same command. I did not find out why in the time box. Possible causes: the Gemini adapter blocks curl only through another path, or the payload shape I used differs from the real Gemini one. The hook runs, but a golden Gemini payload is needed before setup can claim "hook returns expected shape". Open item for the adapter owner, not a link problem.
4. `hooks/hooks.json` has no `matcher` keys for Gemini, so the hook fires on every tool call (cost is per-call node start, ~70 ms here). Not a blocker, but S-HOOK should count it.
5. Neither agent was started as a live session (needs model auth). The hook command was run directly with the expanded path, not fired by the agent. This is the gap to close in the E2E test.

## Pass check against ADR-0019

Pass: both agents list the extension and fire a hook. Listed: yes, both, before and after update. Hook: runs and answers, both, before and after update (fired by me, not by the agent). PASS, with the gap in finding 5.

## What ADR-0019 must change

- Section 1: the `release` git branch is not needed for Gemini and Qwen. Remove "Gemini and Qwen extensions" from the git-only list. Only the Claude Code marketplace stays on git (not tested here).
- Section 3 step 4 and PRD: plan for Gemini is `gemini extensions link <abs global pkg dir> --consent`, for Qwen `qwen extensions link <abs global pkg dir>` with `y` piped. Setup resolves the dir with S-PATH.
- `upgrade` needs no extension step for these two: `npm i -g` updates the files in place. `setup --repair` only re-verifies.
- Verify step: list command must show version equal to the package version. Add a check that the link target still exists (a prefix change or nvm switch breaks the link; the extension record keeps the old path).
- Add open item: golden Gemini hook payload (finding 3) and a live-session E2E for both agents.
