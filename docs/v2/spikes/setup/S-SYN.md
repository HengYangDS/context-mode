# S-SYN: ADR-0019 spike results, merged

Date: 2026-10-22. Role: ADR editor. Status: done.

## Question

What do the six setup spikes (S-NPM, S-PATH, S-HOOK, S-EXT, S-UI, S-V1) change in ADR-0019 and PRD-setup, and what is left for the owner?

## Method

Read ADR-0019, PRD-setup and the six result files in this folder (commits a111aac0, 68cca1e, 284b1f82, 26cb995c, 64391d8e, 25329b29). Compare each result to the ADR-0019 pass column. Move each "what the ADR must change" item into the ADR or PRD. Put an item under "Owner decisions" only when the owner must act or choose. No code ran; no agent, npm or home dir was touched.

## Raw numbers (copied from the spike files)

| Id | Key numbers |
|---|---|
| S-NPM | dry-run: 25 files, 911399 B packed, 4533139 B unpacked; 22 of 22 shared files match `SHA256SUMS`; `package.json` (private) and `cli.mjs` (absent) not in the list; npm 11.19.0 removes bin `"./cli.mjs"` |
| S-PATH | run 39777443062: 6 of 6 jobs green (ubuntu, macOS, Windows x Node 24.15.0, 26.12.1) |
| S-HOOK | p50 / p95 ms: Post abs 43.9 / 47.8; Pre abs 39.0 / 41.1; shim +1 to 5; npx warm about 221 / 235; bare `node -e ""` 30.0 / 31.7; `HOOK_P95_MS` = 40 |
| S-EXT | Gemini 0.65.0, Qwen 0.26.0: listed, enabled, 10 tools, before and after 2.0.0 -> 2.0.1 with no re-link; hook about 70 ms wall |
| S-UI | clack 24171 B min, readline 1814 B; macOS pty both `["claude","gemini"]`; clack non-TTY exit 13; `NO_COLOR` 0 SGR |
| S-V1 | 10 of 10 table rows (9 with v1 entries, zcode 0); 9 unsupported agents with v1 entries; 7 instruction files; 0 tests |

## Pass/fail against the ADR-0019 pass column

| Id | Pass column | Verdict |
|---|---|---|
| S-NPM | dry-run publish with provenance from `release.yml` | FAIL: OIDC and provenance run only in a real Actions publish |
| S-PATH | 6 of 6 layouts | PASS (nvm, fnm, Volta not run) |
| S-HOOK | absolute path under 40 ms p95 | FAIL: 47.8 / 41.1 ms; node start alone is 31.7 ms |
| S-EXT | both list the extension and fire a hook | PASS (hook run by hand, not by a live session) |
| S-UI | pty test on macOS, Linux, Windows | PASS on macOS only |
| S-V1 | list from v1 main, each row covered by a test | FAIL: list done, no tests |

## What changed in ADR-0019 (commit 05fdf0d)

1. "Open items" replaced by "Results" (id, result, evidence link, pass/fail) plus a follow-up list.
2. Section 1: bin `cli.mjs`; `package.json` with `type`, `license`, `repository`, no `private`; build emits it and `cli.mjs` before `SHA256SUMS`; tarball gate incl. `npm pkg fix` no-op; `publish-npm` job (environment `npm-publish`, OIDC, npm >= 11.5.1, idempotent, after `publish-promote`, never `latest`); `release` branch for the Claude Code marketplace only; v1 bin takeover noted (O3). Supersede note on "no `package.json` on `release`" updated.
3. Section 2: `upgrade` has no extension step for Gemini and Qwen.
4. Section 3: own path via `import.meta.url` + `realpathSync`, no `lib/` assumption; S-V1 table is the normative v1 detect list; commands are `process.execPath` + absolute file; Gemini/Qwen `extensions link` plans; Claude Code via `claude plugin` CLI only; verify checks extension version and link target, and prints the node baseline next to the hook time.
5. Section 4: "S-UI decides" replaced by bundled `@clack/prompts` (devDependency), TTY check before any prompt, `isCancel` = exit 130, 40 KB and licence gates.
6. Section 6: v1 entries for unsupported agents, removal only. Section 7: the 7 v1 instruction files, detect-only in setup.
7. Consequences: stale-path doctor check. Tests: per-S-V1-row fixtures, tarball gate.
8. Status stays Proposed. New "Owner decisions": O1 npm trusted publisher, O2 hook budget rule, O3 v1 hook compat. The prompt UI was not close, so it is decided, not an owner item.

## What changed in PRD-setup (commit 75fe1e8)

Rollout step 1 lists results and what must pass before Accepted; step 3 ties the first `next` publish to O1 and S-NPM; step 4 waits for O3. Story 9 adds v1 hook compat and unsupported-agent removal. Open questions: UI closed; O1, O2, O3 added with recommendations; the `gh` question kept with a recommendation.
