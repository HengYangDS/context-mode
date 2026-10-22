# ADR-0019: One interactive `context-mode setup`, npm as the user channel

- Status: Proposed (2026-10-22). Accepted when the spikes in "Open items" pass.
- Owner request, 2026-10-22: install steps are too complex; setup must be interactive (in the style of the Vercel `skills` CLI), live inside doctor, verify and validate every step, leave nothing to the user, and report every failure as an issue.
- Supersedes: ADR-0011 step d (npm deprecate) and the "no `package.json` on `release`" rule; ADR-0002 GS7 (out-tree `package.json` shape); the per-agent install docs as the main install path.
- Amends: ADR-0010 (doctor gets a CLI form that can fix), ADR-0013 (release also publishes to npm), ADR-0014 (setup failures use the same debug report).
- Keeps: ADR-0004 / D11 (no writes to instruction files), ADR-0003 (E2E-style tests only), ADR-0001 (one fixed path per agent, no runtime fallback).

## Context

Measured on 2026-10-21 and 2026-10-22 (workflows `wf_f35f080b-b7b`, `wf_42b57ac4-f63`):

- 10 install docs, each with its own method. 5 of them need a one-line `node -e` that writes a config file, because the files live at `~/.context-mode-app` and every agent must be told that path.
- The copy-paste verifiers passed 8 of 10 after three fix rounds; pi and kiro needed release-build changes.
- Windows needs a second form of every block.
- The root cause is not git or npm. It is that the user must know a path, and must know which of 10 methods is theirs.

The two reasons npm was dropped no longer hold:

| Reason (2026-10) | v2 today |
|---|---|
| Publishing by hand is tiring | `release.yml` already builds and stages; one more job publishes |
| v1 install failures: `better-sqlite3`, native builds, ABI (#514, #543, #889) | v2 has no runtime dependencies (`node:sqlite`), 24 files, nothing to compile |

## Decision

### 1. Channel

- **npm is the user channel.** Package `context-mode`, `bin: {"context-mode": "./cli.mjs"}`, no `dependencies`, no install scripts.
- **The git `release` branch stays, for agents that install from git only** (Claude Code marketplace, Gemini and Qwen extensions). Users never type its name: `setup` runs those commands.
- Both come from one build in one `release.yml` run. The job fails if the npm tarball file list and hashes differ from `release` `SHA256SUMS`.
- v2 is published with dist-tag `next`. The owner moves `latest` by hand (one approval). Until then, v1 configs that run `npx -y context-mode mcp` keep getting v1.
- v2 accepts `mcp` as an alias of `server`, so a v1 config still starts a working server after `latest` moves; `doctor` then flags it and offers `setup`.

### 2. One command

```
npm i -g context-mode && context-mode setup
```

`setup`, `doctor` and `upgrade` share **one check registry** built from the adapter table (`installMode`, config paths, list commands, golden hook payloads). No second source of truth.

| Command | Form | Writes? |
|---|---|---|
| `context-mode setup` | CLI, interactive | yes, after consent |
| `context-mode doctor` | CLI, interactive | read-only; on FAIL it offers "fix now", which runs `setup` for that agent |
| `ctx_doctor` (`/ctx-doctor`) | MCP tool | read-only; prints the exact `context-mode` command to run (an MCP tool cannot prompt) |
| `context-mode upgrade` | CLI | `npm i -g context-mode@<tag>`, then `setup --repair` |

### 3. Setup flow (every agent, every run)

1. **Preflight:** Node version (`node:sqlite` present), npm global prefix writable, the package's own files match `SHA256SUMS`. Fail stops here with the fix.
2. **Detect:** for each adapter row, binary on PATH, its version, config dir present, existing context-mode entries (v1 or v2). Agents not in the table are listed as "not supported" (section 6).
3. **Choose:** multi-select of detected agents, pre-selected; unsupported and missing agents shown greyed with the reason.
4. **Plan:** per agent, the exact change: the agent's own command (`claude plugin install`, `codex mcp add`, `gemini extensions install`, `pi install npm:context-mode`, ...) or the exact config keys to add. Shown as a diff. Absolute paths to the installed package (`node /abs/.../server.mjs`), never `npx`, never a PATH lookup in hooks (hook budget 40 ms, Windows `.cmd`, nvm switches).
5. **Consent:** one confirm for the plan. `--dry-run` stops after the plan.
6. **Apply, per agent:** take a lock (`~/.context-mode/setup.lock`); back up each file to `~/.context-mode/backups/<run-id>/`; refuse a file that does not parse (report, never "fix" it); write atomically (temp file + rename); touch only keys context-mode owns; prefer the agent's own CLI over writing its files.
7. **Verify, per agent** (all must pass, else roll back that agent from its backup and report):
   - the written entry parses and equals the plan;
   - the agent's own list command shows context-mode, where it has one;
   - the exact server command from the config answers MCP `initialize` + `tools/list` with the expected tools;
   - the exact hook command from the config, fed that agent's golden payload, returns the expected shape inside the hook budget;
   - the `doctor` checks for that agent pass.
8. **Summary:** table of agents, PASS / FAIL / SKIPPED with reason, what was written, backup path, and the next step (`/ctx-doctor` inside the agent).

Rules: running `setup` twice changes nothing the second time. `setup --remove` restores every touched file byte for byte from the backup. A crash mid-run leaves either the old file or the new one, never a partial one; the next run sees the lock, finishes or rolls back.

Non-interactive (no TTY, or `--yes`): same steps, no prompts, `--agents a,b`, `--json` result. CI and scripts use this.

### 4. Interface

- In the style of the Vercel `skills` CLI: arrow-key multi-select, spinners per step, a live checklist, colours that degrade to plain text (`NO_COLOR`, no TTY), every prompt answerable by flag.
- No runtime dependency. Prompt UI either bundled at build time (candidate: `@clack/prompts`, if MIT and the bundle stays small) or a small module on `node:readline`. Spike S-UI decides.

### 5. Failure reporting

- Every FAIL builds the ADR-0014 debug report: versions, OS, agent versions, the failing check, its exact error, the plan, redacted (home dir as `~`, no tokens, no env values, no file contents beyond context-mode's own keys).
- Setup shows the report and asks once: open an issue? With `gh` logged in it runs `gh issue create` with the setup issue form; else it opens the prefilled issue URL (long reports: saved to a file and the path is shown).
- **Nothing is sent without a keypress.** Silent auto-filing would send a user's machine details to a public repo without consent, and would flood the tracker with duplicates. Non-interactive runs write the report and print the command.
- Reports carry a stable fingerprint (check id + error class) so duplicates link to one issue.

### 6. "Does my agent work?"

- `context-mode setup` lists every detected agent with one of: **full** (MCP + hooks), **MCP only**, **not supported**, each with the reason.
- `context-mode setup --list` prints the same table for all supported agents without touching anything.
- A detected MCP-capable agent that is not in the adapter table is shown as "not supported yet" with an offer to open a support request (same consent rule).
- README carries the same table, generated from the adapter table at build time.

### 7. Instruction files

`setup`, `doctor` and `upgrade` **never create or edit** instruction files: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `QWEN.md`, `.github/copilot-instructions.md`, `.cursorrules`, steering files or any other prompt file. Routing lives in MCP server instructions and tool descriptions only (ADR-0004, D11).

Why: these files belong to the user and their team; some agents and some companies treat edits there as a policy breach; v1 issues came from such edits.

Guard: each adapter row lists the only files setup may write. A test fails if setup writes any other path. `doctor` reports a v1 routing block left in an instruction file and offers to remove only that block, with a diff and consent.

## Consequences

- Install is two commands for every agent, the same on macOS, Linux and Windows.
- 10 install docs become one page plus per-agent troubleshooting.
- `check-install-docs.mjs` changes: it allows `npm i -g context-mode` and `context-mode setup`, still bans user paths.
- npm download counts return as a metric; GitHub traffic (G23) stays as a second source.
- The release job gets npm credentials (trusted publishing, no long-lived token; spike S-NPM).
- More code than a doc page. It replaces the `node -e` writers in the docs, and it reuses the adapter table and `ctx_upgrade` logic.

## Open items (spikes before Accepted)

| Id | Question | Pass |
|---|---|---|
| S-NPM | npm trusted publishing from GitHub Actions for `context-mode` | a dry-run publish with provenance from `release.yml` on a test package |
| S-PATH | where `npm i -g` puts the package with system Node, nvm, fnm, Volta, Homebrew, Windows; can setup find its own absolute path every time | 6 of 6 layouts |
| S-HOOK | hook p95 with `node /abs/hook.mjs` vs `context-mode hook` vs `npx` | absolute path under 40 ms; record the others |
| S-EXT | can Gemini/Qwen extensions install from the npm package dir (link) instead of git, and update with `npm i -g` | both agents list the extension and fire a hook |
| S-UI | bundled prompt library vs own `node:readline` module | pty test of the full flow on macOS, Linux, Windows |
| S-V1 | v1 entries per agent that setup must find and replace | list from v1 `main` install code, each covered by a test |

## Tests (ADR-0003 style)

- Per agent, clean HOME: `npm i -g <local tarball> && context-mode setup --yes --agents <id>` passes every verify step.
- Pty-driven run of the interactive flow, golden screen states.
- Fault injection, each must leave files byte-identical or fully applied: unwritable config, config that does not parse, agent binary missing, server that fails `tools/list`, kill during write, two setups at once.
- Second run: no changes. `--remove`: byte-identical restore.
- Guard: no write outside the per-agent allowlist; no instruction file touched.
- Windows CI job for the agents that run there.
