# Prompt-cache safety: host docs (gemini, qwen, copilot-cli, opencode, pi, vscode, kiro, zcode)

Read on 2026-10-25. Primary sources only where a vendor page exists; issue threads are marked "report".
Rule from the static audit: `tools/list` is byte-identical across starts, the server never sends `list_changed`,
and hook text is static or lands after the tool and system prefix. So question 4 (tool list) is safe on every
host by construction. The open risk is hook text placement (questions 1 to 3).

Provider cache rule used: a cache hit needs an identical prefix (tools, system, then history in order).
A break = hook text that edits or reorders earlier content, or that varies the system prompt between turns.

## Table

| Host | Provider cache + prefix order | Hook text lands | Tool result replace before history | Tool list rebuild / list_changed | Class |
|---|---|---|---|---|---|
| gemini | Not in docs. Unknown | SessionStart: first turn of history (interactive) or prepended to prompt (non-interactive). BeforeAgent: appended to prompt "for this turn only". AfterTool: appended to tool result | Yes. AfterTool deny reason replaces output "before it enters the conversation history" | Refreshes on list_changed (PR 14375, merged 2025-12-04). Not an issue: v2 never sends it | unknown (BeforeAgent: is the text kept in later turns? if it is dropped, earlier content changes) |
| qwen | Docs list "TokenCaching", no detail. Unknown | UserPromptSubmit: own message part in `<qwen:user-prompt-submit-context>` tag. PreToolUse/PostToolUse: after the tool output | Not documented | Does NOT re-fetch on list_changed (issue 13632, open). Safe | unknown (no prefix-order doc), no break seen |
| copilot-cli | Not in docs. Unknown | sessionStart: contributed context. postToolUse: appended to `textResultForLlm`, same turn. userPromptSubmitted: config-file command hooks output dropped | `modifiedResult` honored for command hooks; docs silent on history | Not in docs. v2 sends no list_changed | unknown. Reports 2585, 2652, 2980 (CLI 1.0.21, 1.0.24): additionalContext dropped for pre/postToolUse. A dropped text is a saving loss, not a cache break |
| opencode | Yes. Explicit `cache_control: ephemeral` on system, last tool, last messages for anthropic-messages and bedrock (`provider/transform.ts`, V2 `cache-policy.ts`) | `experimental.chat.system.transform` pushes to `system[]` on every request. `tool.execute.after` mutates output | Hook runs on the output object before it is saved. Whether MCP tools fire it: sources disagree | Docs silent; v2 sends no list_changed | cache-safe only if the pushed system text is byte-static; break if it varies per turn. MCP hook firing unknown |
| pi | Has `cache_warming_decision` event, so it caches. Prefix order not documented | `before_agent_start` `message` is stored in the session. Returning `systemPrompt` replaces the whole prompt for the run | Yes. "Modifications occur in-place before the result enters session history" | `registerMcpServer`, `mcp_servers_change` event. No list_changed detail | cache-safe if v2 uses `message` and tool_result only. Break if v2 returns `systemPrompt` with varying text |
| vscode | Not in docs. Unknown | Hooks page: postToolUse may add top-level `additionalContext`. Other placement not stated | postToolUse cannot replace output (docs) | Not in docs | unknown (no placement doc, no cache doc) |
| kiro | Not in docs. Unknown | `kiro.dev/docs/hooks/` is a short overview. Placement not stated | Not stated | Not stated | unknown (need hook-types and actions pages, or a live run) |
| zcode | Not in docs. Unknown | SessionStart: before first prompt, adds context. PostToolUse: appends model-visible context after success. stdout must be strict JSON | No. "cannot replace the original output" | Not in docs. Reports: built-in agent may not fire tool hooks | unknown |

## Per host evidence

### gemini
- Hooks reference: https://geminicli.com/docs/hooks/reference/ (page dated 2026-04-13; notes Gemini CLI replaced by Antigravity CLI for unpaid users on 2026-06-18). Hooks need v0.26.0 or later (report: https://geminicli.com/docs/hooks/).
- Quote: SessionStart additionalContext "Interactive: Injected as the first turn in history. Non-interactive: Prepended to the user's prompt." BeforeAgent: "appended to the prompt for this turn only." AfterTool: "appended to the tool result for the agent"; deny reason replaces output "before it enters the conversation history".
- Field must be nested `hookSpecificOutput.additionalContext`; BeforeTool cannot add model context (report: https://github.com/OthmanAdi/planning-with-files/issues/292, https://github.com/ix-infrastructure/ix-gemini-plugin/pull/45).
- list_changed: https://github.com/google-gemini/gemini-cli/pull/14375 (merged 2025-12-04, commit 5f60281; no release version stated). Report that it fails on 0.29.2: https://github.com/google-gemini/gemini-cli/issues/19509.
- Missing: caching docs; whether BeforeAgent text stays in history on later turns. Test: two-turn live run with a BeforeAgent hook, compare turn-2 cache usage.

### qwen
- Hooks: https://qwenlm.github.io/qwen-code-docs/en/users/features/hooks/ (page read up to char 100000 of 114928; no version).
- Quote: UserPromptSubmit additionalContext "is appended as its own message part wrapped in a reserved `<qwen:user-prompt-submit-context>` tag". PreToolUse: "after the tool's own output when it runs".
- list_changed not implemented: https://github.com/QwenLM/qwen-code/issues/13632 (open, Oct 2026).
- Missing: prefix order; whether the tagged part persists in history.

### copilot-cli
- Reference: https://docs.github.com/en/copilot/reference/hooks-reference . Quote: postToolUse "Additional guidance appended to `textResultForLlm` so the model sees it after the tool output on the same turn"; "`modifiedResult` is honored by both SDK programmatic hooks and command/HTTP config-file `postToolUse` hooks".
- Reports: https://github.com/github/copilot-cli/issues/2585 (1.0.21), https://github.com/github/copilot-cli/issues/2652 (1.0.24), https://github.com/github/copilot-cli/issues/2980.
- Missing: any cache or MCP statement; whether the fix shipped. Need the current CLI changelog.

### opencode
- Plugins: https://opencode.ai/docs/plugins/ (lists `tool.execute.before/after`, no shapes, no cache text). Shapes from a community gist: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a (report).
- Cache: https://github.com/anomalyco/opencode/issues/14642 , https://github.com/anomalyco/opencode/issues/57199 , https://github.com/anomalyco/opencode/issues/51726 (2.0.18). Markers on system, last tool, last message. Report 57199: with `cacheFormat: "anthropic"` on an openai-compatible gateway the marker after a tool result is ignored (host bug, hits off and v2 arms alike).
- MCP hook conflict: https://symposium.dev/design/agent-details/opencode.html (says no) vs https://ai-security-docs.akto.io/akto-atlas-agentic-ai-security-for-employee-endpoints/endpoints-discovery-agents/opencode-hooks (says yes).
- V2 plugin API: https://opencode.ai/v2/docs/build/plugins/ .
- Missing: source check of `tool.execute.after` for MCP tools.

### pi
- Extensions: https://pi.dev/docs/latest/extensions and https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md (no version stated on the page).
- Quote: "Prefer changing prompt sections, selected tools, or guidelines so Pi can append a transcript delta." `forceSystemPrompt` replaces the whole prompt. tool_result changes happen "before the result enters session history".
- Missing: prefix order; MCP list_changed handling.

### vscode
- https://code.visualstudio.com/docs/copilot/customization/hooks : "A `postToolUse` hook can add top-level `additionalContext`, but cannot undo an action that has already completed." Nothing on cache, placement or MCP refresh.
- Missing: everything for questions 1, 2 (other events), 4. Test: live VS Code run is not possible in batch; read the vscode-copilot-chat source.

### kiro
- https://kiro.dev/docs/hooks/ (overview; `/docs/cli/hooks/` redirects to it). Hook types and actions pages were not read.
- Missing: all four questions.

### zcode
- https://zcode.z.ai/en/docs/hooks : "PostToolUse can only append model-visible context after successful tool execution". Reports: https://github.com/DietrichGebert/ponytail/issues/798 (plain stdout dropped, JSON needed), https://github.com/kenn-io/roborev/pull/1368 (no tool hook dispatch in logs), https://github.com/zai-org/ZCode/blob/main/apps/zcode-cli/README.md .
- Missing: cache and prefix docs; MCP refresh.

## Result

- Cache-safe by rule: none proven from docs alone. No host doc states a cache prefix order except opencode (code and issues).
- Break: none found, none proven absent. Conditional breaks: opencode and pi, if v2 puts varying text in the system prompt. v2 must not.
- Unknown: gemini (BeforeAgent persistence), qwen, copilot-cli, vscode, kiro, zcode (no cache or placement doc).
- list_changed: gemini re-fetches, qwen does not, others undocumented. v2 never emits it, so no host refreshes.
- Guard v2 must keep: hook text static per session, delivered through the host append channel (tool result or user turn), never through a rebuilt system prompt.
