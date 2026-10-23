# ADR-0006 live probe: alwaysLoad on ctx_execute, Opus and Sonnet (2026-10-23)

Real sessions only. 30 sessions: 2 models x (5 large tasks, 5 small tasks, 5 description-quote runs). The ADR names no n for this probe, so n = 5 per model per case type. Only the "alwaysLoad on" arm ran (the release build). No "off" arm ran, so the ADR consequence "if off routes as well as on, remove the flag" is not decided here.

## Setup

- Binary: real `claude` 2.1.303 (Mach-O path, not the shim). `init.apiKeySource = "none"` in all 30 sessions.
- Plugin: `--plugin-dir release-out` built from branch v2-design at the commit that was HEAD at clone time (`node build/build.mjs`).
- Models: `claude-opus-5-5`, `claude-sonnet-5-5`, explicit `--model`. Default effort (the 2026-10-15 re-probe used `--effort low`).
- `--max-budget-usd 0.5` per session, `</dev/null`, fresh `CLAUDE_CONFIG_DIR` with the login credential copied, temp HOME, `ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, `--setting-sources project`, `--no-session-persistence`, `--permission-mode bypassPermissions`.
- Deviation from the task text: `--strict-mcp-config` was NOT used. ADR-0012 says it drops the server inside the `--plugin-dir` plugin. A test session with it showed `mcp_servers: []` and no ctx tools. The plugin server was `connected` in all 30 probe sessions.
- Tasks: S1-S5 (small) and L1-L5 (large) from `e2e/live/routing/tasks.mjs`, scored with `e2e/live/routing/score.mjs` (tool class and returned bytes, ROUTE_BYTES 2048). The quote prompt: "For each of ctx_execute and ctx_search: quote the first sentence of its description, or write NOT VISIBLE". No tool call was allowed unless needed.
- Transcript is the evidence. Deferred vs loaded comes from what the model could quote, not from the `init` tool list.

## Counts

| Model | Case | n | ctx tools named in init | ctx_execute description | ctx_search description | ctx tool first | Under-routed | Over-routed | Correct |
|---|---|---|---|---|---|---|---|---|---|
| Opus 5.5 | quote | 5 | 9 of 9 | loaded 5/5 | NOT VISIBLE 5/5 | n/a | n/a | n/a | n/a |
| Sonnet 5.5 | quote | 5 | 9 of 9 | loaded 5/5 | NOT VISIBLE 5/5 | n/a | n/a | n/a | n/a |
| Opus 5.5 | large | 5 | 9 of 9 | n/a | n/a | 4/5 | 0/5 | n/a | 5/5 |
| Sonnet 5.5 | large | 5 | 9 of 9 | n/a | n/a | 3/5 | 0/5 | n/a | 5/5 |
| Opus 5.5 | small | 5 | 9 of 9 | n/a | n/a | 0/5 | n/a | 0/5 | 5/5 |
| Sonnet 5.5 | small | 5 | 9 of 9 | n/a | n/a | 0/5 | n/a | 0/5 | 5/5 |

Notes:
- "init" lists all 9 ctx tool names in every session, deferred or not. The init list alone cannot show deferral.
- Under-routing here uses the current bytes rule (native first tool with output over 2048 B). Native first tools on large tasks were Bash with 8 to 193 B back (Opus L4; Sonnet L1, L4), so 0 under-routed. By the old 2026-10-15 rule (first tool native on a large task) the count is Opus 1/5 and Sonnet 2/5.
- Sonnet S3 made no tool call (answered from the prompt context), correct.
- Tokens, list-price estimate, sums over the 5 sessions of each row. Opus quote: in 10, cache_create 23964, cache_read 61650, out 574, $0.216. Sonnet quote: in 10, cache_create 23151, cache_read 64195, out 735, $0.106. Opus large: in 22, cache_create 74835, cache_read 115192, out 1055, $0.643. Sonnet large: in 22, cache_create 88438, cache_read 104707, out 814, $0.372. Opus small: in 20, cache_create 73816, cache_read 97651, out 533, $0.621. Sonnet small: in 18, cache_create 23441, cache_read 133837, out 327, $0.110. Total 30 sessions $2.07 list price, no bill (Max login).

## Per run

### Routing runs (large and small)

| Model | Case | Run | ctx tools in init | Tool sequence | Result | in | cache_create | cache_read | out | list $ |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | L1 | 1 | 9 | ctx_execute,ctx_execute | large correct=true under=false over=false nat=0B ctx=378B | 6 | 5394 | 46913 | 329 | 0.059 |
| claude-opus-5-5 | L2 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=142B | 4 | 17454 | 17076 | 236 | 0.148 |
| claude-opus-5-5 | L3 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=125B | 4 | 17359 | 17067 | 177 | 0.146 |
| claude-opus-5-5 | L4 | 1 | 9 | Bash | large correct=true under=false over=false nat=8B ctx=0B | 4 | 17217 | 17070 | 93 | 0.143 |
| claude-opus-5-5 | L5 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=121B | 4 | 17411 | 17066 | 220 | 0.147 |
| claude-opus-5-5 | S1 | 1 | 9 | Bash | small correct=true under=false over=false nat=11B ctx=0B | 4 | 17238 | 17063 | 118 | 0.144 |
| claude-opus-5-5 | S2 | 1 | 9 | Bash | small correct=true under=false over=false nat=8B ctx=0B | 4 | 17233 | 17071 | 108 | 0.143 |
| claude-opus-5-5 | S3 | 1 | 9 | Bash | small correct=true under=false over=false nat=4B ctx=0B | 4 | 17250 | 17065 | 128 | 0.144 |
| claude-opus-5-5 | S4 | 1 | 9 | Read | small correct=true under=false over=false nat=21B ctx=0B | 4 | 17216 | 17060 | 90 | 0.143 |
| claude-opus-5-5 | S5 | 1 | 9 | Read | small correct=true under=false over=false nat=11B ctx=0B | 4 | 4879 | 29392 | 89 | 0.047 |
| claude-sonnet-5-5 | L1 | 1 | 9 | Bash,Bash | large correct=true under=false over=false nat=193B ctx=0B | 6 | 17788 | 35043 | 165 | 0.076 |
| claude-sonnet-5-5 | L2 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=20B | 4 | 17667 | 17422 | 176 | 0.074 |
| claude-sonnet-5-5 | L3 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=100B | 4 | 17699 | 17413 | 187 | 0.074 |
| claude-sonnet-5-5 | L4 | 1 | 9 | Bash | large correct=true under=false over=false nat=8B ctx=0B | 4 | 17541 | 17417 | 66 | 0.073 |
| claude-sonnet-5-5 | L5 | 1 | 9 | ctx_execute | large correct=true under=false over=false nat=0B ctx=104B | 4 | 17743 | 17412 | 220 | 0.075 |
| claude-sonnet-5-5 | S1 | 1 | 9 | Read | small correct=true under=false over=false nat=42B ctx=0B | 4 | 4734 | 30248 | 86 | 0.023 |
| claude-sonnet-5-5 | S2 | 1 | 9 | Bash | small correct=true under=false over=false nat=8B ctx=0B | 4 | 4696 | 30256 | 59 | 0.022 |
| claude-sonnet-5-5 | S3 | 1 | 9 | (none) | small correct=true under=false over=false nat=0B ctx=0B | 2 | 4574 | 12839 | 3 | 0.020 |
| claude-sonnet-5-5 | S4 | 1 | 9 | Read | small correct=true under=false over=false nat=21B ctx=0B | 4 | 4721 | 30245 | 90 | 0.023 |
| claude-sonnet-5-5 | S5 | 1 | 9 | Read | small correct=true under=false over=false nat=11B ctx=0B | 4 | 4716 | 30249 | 89 | 0.023 |

### Quote runs

| Model | Case | Run | ctx tools in init | Tool sequence | Result | in | cache_create | cache_read | out | list $ |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | quote | 1 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4792 | 12330 | 113 | 0.043 |
| claude-opus-5-5 | quote | 2 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4793 | 12330 | 113 | 0.043 |
| claude-opus-5-5 | quote | 3 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4793 | 12330 | 114 | 0.043 |
| claude-opus-5-5 | quote | 4 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4793 | 12330 | 117 | 0.043 |
| claude-opus-5-5 | quote | 5 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4793 | 12330 | 117 | 0.043 |
| claude-sonnet-5-5 | quote | 1 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4632 | 12839 | 216 | 0.022 |
| claude-sonnet-5-5 | quote | 2 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4629 | 12839 | 55 | 0.020 |
| claude-sonnet-5-5 | quote | 3 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4630 | 12839 | 143 | 0.021 |
| claude-sonnet-5-5 | quote | 4 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4629 | 12839 | 135 | 0.021 |
| claude-sonnet-5-5 | quote | 5 | 9 | (none) | execute:loaded search:NOT VISIBLE | 2 | 4631 | 12839 | 186 | 0.022 |

## Reading

- ctx_execute is loaded at session start on both models (10/10). ctx_search is deferred (10/10). This matches Decision 2.
- No over-routing on either model (0/10 small sessions used a ctx tool first).
- Large tasks: Opus used ctx_execute first on 4/5, Sonnet on 3/5. The 2026-10-15 claim "Sonnet under-routing 3/3 with alwaysLoad" is not reproduced: now 2/5 by the old rule and 0/5 by the bytes rule. Different n, scoring rule and effort setting, so this is not a clean A/B.
- Not measured: the alwaysLoad off arm. The remove-the-flag check stays with GP-LIVE-ROUTING.
