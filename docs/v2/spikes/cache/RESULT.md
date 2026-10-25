# Prompt-cache safety: result

Date: 2026-10-25. Branch: v2-design. Gateway is not involved.

## Question

Does v2 break the prompt cache? Four sub-questions: (1) does hook text edit or reorder earlier prompt bytes, (2) does the system prompt change between turns, (3) does it change between sessions, (4) does the tool list change.

## Definitions

- Cache break at turn n (n>1): `cache_creation_input_tokens` at turn n is larger than the new content since turn n-1 (tool results, prompt, hook text) by more than 1024 tokens. Part of the old prefix was written again.
- In mined transcripts new content is not recorded. There the proxy is: rewritten = (cc+cr at n-1) - cr at n, floored at 0; break if above 1024. Compact turns are counted apart, never as breaks.
- Cache hit ratio = cache_read / (cache_read + cache_creation + input).
- Cross-session prefix read = cache_read on turn 1 of a second session started within 4 minutes in the same project. Share = that read / turn-1 prefix.

## Static audit

- Server: 10 agents x 5 starts with different cwd, HOME, store, TZ, clock, env and LANG. initialize + tools/list was byte-identical every time (7195 bytes). No `list_changed` is sent. Tool text and instructions are fixed literals from the build (0 placeholders in `src/prompt`). Tool list: safe on every host.
- Break found, Pi (fixed): Pi 0.73.1 resets the system prompt to base when `before_agent_start` returns no `systemPrompt` (`agent-session.js:791-797`). v2 sent INSTRUCTIONS on turn 1 and `{}` after, so turn 2 rewrote the prefix. Hook text (resume hint, compact state) had the same one-turn shape.
- Possible break, opencode: after a compaction, the next session could get different `system[]` text. The marker is keyed by session id, so it does not. Guarded by test.

## Mined numbers (2474 transcripts, Claude Code 2.1.303)

Breaks: 0 in every arm. Source: `bench/cache/mined.json`, `bench/cache/mined.md`. Input set: `/private/tmp/cm-v2-impl-private/**` without `cache/`. A re-run over the whole root now also reads the 188 per-turn files of this spike under `cache/` (Claude Code 2.1.310) and gives 2662 files; the 2474 numbers come from the set without `cache/`.

| arm | sessions | turns | hit/turn median | hit/session median | compact turns | compact hit median |
|---|---|---|---|---|---|---|
| off | 636 | 2101 | 90.6% | 88.3% | 73 | 68.5% |
| v2 | 1738 | 8786 | 96.6% | 93.0% | 1164 | 73.8% |
| gateway | 47 | 96 | 93.3% (turn) | - | - | - |
| v1 | 42 | 190 | 91.1% (turn) | - | - | - |

Not mined: cross-session read.

## Live Claude Code A/B

Claude Code 2.1.310, claude-sonnet-5-5, effort low, n=3 per arm, 6 turns, turn 2 reads a 200 KB file. Files: `claude-code.json` (before Pi fix), `claude-code-after.json`, `claude-code-after-cross.json`. Cost 4.41 + 3.47 + 0.11 USD.

Breaks per session: off 0,0,0; v2 0,0,0 (both runs). Pass.

Mean hit ratio per turn (turns 1 to 6), mean of the per-session `analysis.perTurn[i].hitRatio`, 3 decimals:

| run | arm | t1 | t2 | t3 | t4 | t5 | t6 |
|---|---|---|---|---|---|---|---|
| first | off | 0.885 | 0.634 | 0.990 | 0.985 | 0.991 | 0.994 |
| first | v2 | 0.943 | 0.670 | 0.990 | 0.963 | 0.988 | 0.995 |
| after | off | 0.885 | 0.634 | 0.990 | 0.985 | 0.992 | 0.994 |
| after | v2 | 0.855 | 0.669 | 0.991 | 0.962 | 0.989 | 0.995 |

Pooled turns 2-6: off 0.930, v2 0.931. Pass (v2 >= off - 0.02). Turn 2 is low in both arms because the file is written to cache.

First-turn prefix, median: off 6.3k tokens, v2 9.1k. v2 adds about 2.8k (9 tools, hook and skill entries).

Compact in mid-session (no break in either arm). First call after compact, off: read 5435, wrote 2739. v2: read 7064, wrote 4380. The compact turn is exempt. Post-compact hit: off 0.82, v2 0.77 (turn 5), then 0.95 and above.

Cross-session share (second session back to back), after-fix runs only (`claude-code-after.json` 3 pairs + `claude-code-after-cross.json` 6 pairs), n=9 pairs per arm. The runner does not record the gap between the two sessions (`gapMs` is null); they run one after the other, so the gap is seconds, but the 4-minute rule is not proven from the JSON:

- off: 0.718 to 0.9997, median 0.954, 3 of 9 below 0.9.
- v2: 0.876 to 0.9998 in 8 of 9, median 0.974, 2 of 9 below 0.9. One pair read 0 (after-fix run, pair 2). I did not find the cause. The first run's three v2 shares were 0.897, 0.874, 0.935.
- All runs (add the first run, n=12 pairs per arm): off min 0.715 (first run 0.7152), 4 of 12 below 0.9; v2 min 0.874 without the zero pair, 4 of 12 below 0.9 (one of them 0).
- Verdict flag `crossOk` is false in both files because of the 0.9 bar. off fails it too. This is the host and provider, not only v2. Tail of ~1.2k tokens is written again in some v2 pairs; cause not proven.

## Live Codex A/B

codex-cli 0.156.1, gpt-6-astra, effort low, 5 turns via `codex exec` then `resume`, usage from rollout token_usage. n=5 per arm (`codex.json` n=2, `codex-r3.json` n=3). v2 arm calls ctx tools in every session (2 MCP calls); the runner fails if none.

- Breaks per session: off 1,0,1,1,1 (mean 0.8). v2 2,0,0,0,2 (mean 0.8). Pass.
- Hit ratio turns 2-5, pooled: off 0.913, v2 0.927. Pass.
- First request input: off 14364-14372, v2 14372-14380.
- Cross-session, one pair per arm per file: `codex.json` off 12160 of 14342 = 0.848, v2 12160 of 14350 = 0.847; `codex-r3.json` off 12160 of 14350 = 0.847, v2 12160 of 14358 = 0.847. Fail the 0.9 bar, the same in both arms.
- Per-file verdict: `codex.json` (n=2) has `pass.breaks` false (v2 2 breaks, off 1). The pooled n=5 mean (0.8 both arms) passes. The cached part stops at 12160 in every first request. Cause not found.

## Host table

| Host | Class | Source |
|---|---|---|
| claude-code | cache-safe | live A/B above, mined 0 breaks |
| codex | cache-safe (no v2-only break) | live A/B above |
| pi | cache-safe after fix | fix e1b98217, test `tests/v2/plugins/pi-cache.test.mjs`. No live Pi run. |
| opencode | cache-safe, static | `tests/v2/plugins/opencode-cache.test.mjs`, `hosts.md`. MCP hook firing unknown. |
| gemini | unknown | `hosts.md`: BeforeAgent text is "this turn only", no cache doc |
| qwen | unknown | `hosts.md` |
| copilot-cli | unknown | `hosts.md` |
| vscode | unknown | `hosts.md` |
| kiro | unknown | `hosts.md` |
| zcode | unknown | `hosts.md` |

Tool list is safe on all hosts by construction (no `list_changed`).

## Fixes and after numbers

- D-CACHE-PI-1 (`e1b98217`, red test `6428cfbf`): Pi returns `base + payload` on every turn. Payload bytes are stable between compactions. After number: unit test shows byte-identical prompts on turns 1 and 2. No live Pi number.
- opencode guard test `faa77967`: no code change needed.
- Claude Code and Codex needed no code change. After-fix Claude Code run: v2 breaks 0, hit 0.931 vs off 0.930.

## Open items

1. Cross-session share below 0.9 on Claude Code (both arms) and Codex (both arms). Find out whether the tail differs per session or is not cacheable.
2. One v2 Claude Code cross pair read 0. Repeat to see if it is cache eviction or a v2 effect.
3. Live Pi and opencode runs are not done.
4. Hosts marked unknown need a live two-turn run.
5. The prefix-determinism test and a dynamic-token lint for `src/prompt` are not in the gate. Static audit used a probe outside the repo.
