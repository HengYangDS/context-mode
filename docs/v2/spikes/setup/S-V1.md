# Spike S-V1: v1 entries that `context-mode setup` must find and replace

Status: DRAFT 1 (2026-10-22). Feeds ADR-0019, PRD-setup story 9.

## Question
Which v1 entries must setup find and replace, per agent in `src/adapters/table.ts` (v2-design)?

## Method
Git archaeology on `origin/main` (v1.0.169, tag `v1.0.169-187-g90af14e3`, 2244 commits). Read: `src/adapters/*/index.ts`, `src/cli.ts` (`upgrade`, `doctor`), `configs/`, `.claude-plugin/`, `.codex-plugin/`, `hooks/hooks.json`, README "Install". Commit = first commit that added the file (`git log --diff-filter=A`). Detection = what the v1 doctor/adapter code reads today.
Not run: no agent was installed, no real home dir touched. Rows marked (doc) come from the README only, not from adapter code.

## Rows in table.ts
10 agents: claude-code, codex, gemini, qwen, copilot-cli, vscode, kiro, zcode, pi, opencode. All 10 appear below. `zcode` has no v1 trace (grep of src, configs, README, docs: 0 hits).

## v1 entries per agent
Common v1 shape: command `context-mode` (global npm bin) or `npx -y context-mode`, hook command `context-mode hook <platform> <event>`. v2 replaces all of them with `node /abs/...`. Action: R = replace with v2 entry, X = remove, K = keep (user-owned).

| Agent | File | Key or block | v1 shape | v1 commit | How setup detects it | Action |
|---|---|---|---|---|---|---|
| claude-code | `~/.claude/settings.json` | `enabledPlugins["context-mode@context-mode"]` | `true` | d114a192 / 3e7dbd0c (2026-02-23) | key contains `context-mode` | R (v2 marketplace plugin) |
| claude-code | `~/.claude/plugins/installed_plugins.json` | plugin record + install path (cache dir per version) | written by `claude plugin install`; v1 `upgrade` also rewrites it (post-write assert v1.0.114) | cli.ts upgrade | key contains `context-mode` | R via `claude plugin` CLI, never edit by hand |
| claude-code | `~/.claude/plugins/marketplaces/context-mode/` | git clone of `mksglu/context-mode` (main) | dir | 3e7dbd0c; pull step #418 | dir exists, `origin` = v1 repo | R: re-add marketplace at `release` branch |
| claude-code | `~/.claude/settings.json` | `hooks.{PreToolUse,PostToolUse,SessionStart,PreCompact,UserPromptSubmit}[].hooks[].command` containing `context-mode` | standalone hooks (pre-plugin install); v1 `upgrade` removes stale ones (#187) and duplicates covered by plugin `hooks.json` | src/adapters/claude-code/index.ts 49e0d7f1 | any hook command matching `context-mode` | X, then plugin supplies hooks |
| claude-code | `~/.claude.json` (mcpServers) | `context-mode` | `claude mcp add context-mode -- npx -y context-mode` (README "MCP-only") | README | `claude mcp list` shows it | X (v2 plugin owns MCP) |
| claude-code | `~/.claude/settings.json` | `statusLine` | `{"type":"command","command":"context-mode statusline"}` | README | command equals `context-mode statusline` | R only if value is exactly v1; else leave and warn |
| claude-code | `CLAUDE.md` (project) | routing block from `configs/claude-code/CLAUDE.md` | copied text | 75ae6ae3 (2026-03-05) | doctor: block text match | doctor offers removal with diff (ADR-0019 s7); setup never edits |
| codex | `~/.codex/config.toml` | `[mcp_servers.context-mode]` `command = "context-mode"` (+ optional `[...env]`) | TOML table | 75ae6ae3 (2026-03-05) | TOML table name | R (`codex mcp add`) |
| codex | `~/.codex/config.toml` | `[features] hooks = true` (older: `codex_hooks`) | boolean | 75ae6ae3 | key present | K (v2 hooks need it; set if absent) |
| codex | `$CODEX_HOME/hooks.json` (default `~/.codex/hooks.json`) | PreToolUse/PostToolUse/SessionStart/PreCompact entries, command `context-mode hook codex <event>` | JSON, `{"type":"command","command":...}` | 725951a2 (2026-04-02, 1.0.59) | command matches `context-mode hook codex` | R |
| codex | Codex plugin registry | marketplace `mksglu/context-mode`, `.codex-plugin/{plugin,mcp,hooks}.json`; MCP env `CONTEXT_MODE_PLATFORM=codex`, `default_tools_approval_mode=approve` | `codex plugin marketplace add mksglu/context-mode` | aee831a2 (2026-05-10); hooks 572d451f (#575, 2026-05-17) | `codex plugin` list / v1 adapter checks `.codex-plugin/hooks.json` | R |
| codex | `AGENTS.md`, `AGENTS.override.md` (`~/.codex/` or project) | routing block from `configs/codex/AGENTS.md` | copied text | 75ae6ae3 | text match | doctor offers removal |
| gemini | `~/.gemini/settings.json` | `mcpServers["context-mode"]` `{"command":"context-mode"}` | JSON | 75ae6ae3 (2026-03-05) | key present | R |
| gemini | `~/.gemini/settings.json` | `hooks.BeforeTool` (long matcher), `AfterTool`, `PreCompress`, `SessionStart`; command `context-mode hook gemini-cli <event>` | JSON | 75ae6ae3 | command matches | R (v2 has no SessionStart for gemini: X it, D-FU-GCH-1) |
| gemini | `GEMINI.md` (project) | routing block | copied | 75ae6ae3 | text match | doctor offers removal |
| qwen | `~/.qwen/settings.json` | `mcpServers["context-mode"]` `{"command":"context-mode","args":[]}` | JSON | 2861d45f (2026-04-25) | key present | R |
| qwen | `~/.qwen/settings.json` | `hooks.{PreToolUse,PostToolUse,SessionStart,PreCompact,UserPromptSubmit}` command `context-mode hook qwen-code <event>` | JSON | 2861d45f | command matches | R |
| qwen | `QWEN.md` (project or `~/.qwen/`) | routing block | copied | 2861d45f | text match | doctor offers removal |
| copilot-cli | `~/.copilot/mcp-config.json` (or `$COPILOT_HOME`) | `mcpServers["context-mode"]` | `copilot mcp add context-mode -- context-mode` | 9f34c6f1 (#787, 2026-06-21) | key present | R |
| copilot-cli | `~/.copilot/hooks/context-mode.json` | `{"version":1,"hooks":{preToolUse,postToolUse,preCompact,sessionStart,userPromptSubmitted,agentStop}}`, command `context-mode hook copilot-cli <event>` | flat `{type,command}` entries | 9f34c6f1 (#787) | file exists, command matches | R (the file is context-mode's own: replace whole file) |
| copilot-cli | plugin `mksglu/context-mode:configs/copilot-cli` | `.mcp.json` with `CONTEXT_MODE_PLATFORM=copilot-cli`, `hooks.json`, `skills/` | `copilot plugin install ...` | 9f34c6f1 (#787) | `copilot plugin list` | R |
| copilot-cli | `.github/copilot-instructions.md`, `AGENTS.md` | routing block | copied | 9f34c6f1 | text match | doctor offers removal |
| vscode | `.vscode/mcp.json` (project) | `servers["context-mode"]` `{"command":"context-mode"}` (key is `servers`, not `mcpServers`) | JSON | 75ae6ae3 (2026-03-05) | key present | R |
| vscode | `.github/hooks/context-mode.json` | `hooks.{PreToolUse,PostToolUse,SessionStart,PreCompact}`, command `context-mode hook vscode-copilot <event>` | JSON | 75ae6ae3 | file exists | R |
| vscode | `.github/copilot-instructions.md` | routing block | copied | 75ae6ae3 | text match | doctor offers removal |
| kiro | `~/.kiro/settings/mcp.json` or `.kiro/settings/mcp.json` | `mcpServers["context-mode"]` | JSON | 4bbbd46a (2026-03-21; adapter b40d6bdb 2026-03-16) | key present | R |
| kiro | `.kiro/hooks/context-mode.json` | `{"name":"context-mode","hooks":{preToolUse,postToolUse}}` with matcher `execute_bash\|fs_read\|@context-mode/...`, command `context-mode hook kiro <event>` | JSON | 77ad0fd2 (#137, 2026-03-17) | file exists | R |
| kiro | default agent file (adapter writes it, index.ts:372) | agent config with hooks | JSON | 77ad0fd2 (#137) | command matches | R (check exact path in a follow-up) |
| kiro | `KIRO.md` | routing block | copied | 4bbbd46a | text match | doctor offers removal |
| zcode | none | no v1 entry | n/a | n/a | n/a | nothing to replace |
| pi | `~/.pi/agent/settings.json` (also `.pi/settings.json`) | `packages: ["npm:context-mode"]` | `pi install npm:context-mode` | a9e6c142 (2026-03-19); PiAdapter 5a6fe4bd (2026-05-09) | `pi list` / key present | R (v2 installs from its own package) |
| pi | `~/.pi/agent/mcp.json` | `mcpServers["context-mode"]` `{"command":"context-mode"}` | JSON | a9e6c142 | key present | R |
| pi | `AGENTS.md` | routing block (`configs/pi/AGENTS.md`) | copied | a9e6c142 | text match | doctor offers removal |
| opencode | `opencode.json[c]` in project, `.opencode/`, or `~/.config/opencode/` | `plugin: ["context-mode"]` (+ `$schema`) | JSON/JSONC | 75ae6ae3 (2026-03-05) | array contains `context-mode` | R (JSONC: do not strip comments) |
| opencode | `AGENTS.md` | routing block | copied | 75ae6ae3 | text match | doctor offers removal |

## Findings that change setup design
1. v1 `context-mode` bin must be gone from PATH or v2 must own that name. `npm i -g context-mode@2` overwrites the same bin name, so every v1 hook command `context-mode hook <p> <e>` would then call the v2 CLI. v2 needs a compat `hook` subcommand, or setup must rewrite all of them in the same run. Else a half-migrated user gets broken hooks.
2. Also keep the `mcp` alias (ADR-0019 s1) and `npx -y context-mode` entries: `latest` stays v1 until the owner moves it.
3. v1 writes routing text into 7 instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, QWEN.md, KIRO.md, `.github/copilot-instructions.md`, `SYSTEM.md`). Setup must only detect; doctor removes with consent (matches ADR-0019 s7).
4. v1 `upgrade` itself edited `settings.json` (removed stale hooks #187, rewrote runtime paths #738, Windows #628). v2 setup must handle files v1 already mutated.
5. Claude Code v1 state lives in three places (settings, `installed_plugins.json`, marketplace clone). Use the `claude plugin` CLI to replace; do not hand-edit the registry.
6. Scope of detection is wider than the table: v1 also wrote entries for cursor, jetbrains-copilot, antigravity, antigravity-cli, kimi, omp, openclaw, zed, kilo (all absent in v2 table). Setup should report "v1 entry found for unsupported agent" and offer removal only.
7. Pi path conflict to verify: README says `~/.pi/agent/settings.json`, adapter code returns `~/.pi/settings.json` (pi/index.ts:122).

## Pass check (ADR-0019 pass column: "list from v1 main install code, each covered by a test")
- List built from v1 main code: yes (10 of 10 table rows).
- Each row covered by a test: NOT YET. Draft 1 has no test. Needs one fixture HOME per row (v1 shape in, v2 shape out, second run no change).
- Result: partial pass (list complete, tests pending). Linked issue numbers so far: #137, #187, #418, #473, #575, #628, #729, #738, #787 (from commit subjects and code comments); per-row issue links still to be completed.

## What ADR-0019 must change
1. Add the table above as the normative v1 detect list in section 3 step 2; make each row a test fixture (Tests section).
2. Decide the v1 `context-mode hook ...` compat (finding 1) before `latest` moves.
3. Section 7: say detect-only for the 7 instruction files; removal only through doctor with diff and consent.
4. Add "unsupported agent with v1 entry" case to section 6.
5. Claude Code: replace via `claude plugin` CLI plus marketplace re-add at `release`; never write `installed_plugins.json`.
