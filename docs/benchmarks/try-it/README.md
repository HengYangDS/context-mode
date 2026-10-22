# README try-it prompts: direct vs OSS v1 vs OSS v2 vs the Context Mode gateway (Opus 5.5)

On the five counted "Try It" prompts from the README, OSS plugin v1 cost **35.2% more** than Claude Code alone, and v1 cost less in 4 of 20 pairs. OSS plugin v2 cost **10.9% more**, and v2 cost less in 7 of 20 pairs. The Context Mode gateway cost **43.8% less**, and it cost less in 20 of 20 pairs. But the gateway passed the task check in only **7 of 20** sessions, against 16 of 20 for direct, v1 and v2 (see "Success" below). Sums over pairs: [ab.json](ab.json) (`pooled`). Each prompt has its own interval and verdict in the tables below. Of the 13 README numbers we could check, 2 hold and 11 differ. We wrote down the plan before the first run: [prereg.md](prereg.md), commit `f924eda2`.

## Key facts

- **What it is:** a paired cost test of the six "Try It" prompts from the OSS README, in four arms: Claude Code alone (direct), OSS v1, OSS v2, and the live Context Mode gateway. Same day, same client, same model for all arms.
- **Who it is for:** people who read the README numbers and want to know what one prompt really costs in each setup.
- **Client:** Claude Code 2.1.303, `claude-opus-5-5`, 2026-10-22. No other model. No Codex run.
- **Measured result:** the gateway cost less than direct on all 5 prompts ("less" verdict on each). v1 cost more on large-json and docs-search ("more"); on the other 3 the range crosses zero ("same"). v2 cost more on web-scrape and docs-search ("more"); on the other 3 the range crosses zero ("same").
- **Limits:** 4 pairs per prompt, so the ranges are wide. A "same" verdict does not prove the cost is equal. The success checks for repo-research, web-scrape and docs-search are completion checks, not quality checks. The large-json check failed every arm (0 of 16) for a reason in the check itself, see below. Cost is the list-price value on a claude.ai login: there is no per-token invoice. session-continuity ran 2 cycles as a demonstration only: no range, no verdict, no claim.

## Results

Each cost cell gives the mean cost per prompt at list price. "Likely" gives the 95% t range of the paired difference (t = 3.182 at n = 4). "Head-to-head" counts the cycles where the arm cost less than direct. "tool_result bytes" is the mean size of all tool results the client sent to the model in one session. All rows are here: wins, losses and "same".

### Deep repo research

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.249 | $0.342 | $0.198 | $0.176 |
| Saving vs direct | – | cost 37% more, likely 36% less to 110% more, **same** (range crosses zero) | 21% lower, likely 42% lower to 1% more, **same** (range crosses zero) | **29% lower**, likely 3 to 56%, **less** |
| Head-to-head | – | 1 of 4 | 4 of 4 | 4 of 4 |
| tool_result bytes seen | 25,089 | 33,655 | 16,249 | 5,610 |
| Tool calls (median) | 4 | 4 | 2 | 2.5 |
| Success (completion check) | 4/4 | 4/4 | 4/4 | 3/4 |

v2 against v1: 42% lower, likely 98% lower to 14% more, same. The gateway failure: in cycle 1 the client made no tool call.

### Git history analysis

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.145 | $0.141 | $0.142 | $0.078 |
| Saving vs direct | – | 3% lower, likely 31% lower to 26% more, **same** (range crosses zero) | 2% lower, likely 45% lower to 40% more, **same** (range crosses zero) | **46% lower**, likely 11 to 81%, **less** |
| Head-to-head | – | 2 of 4 | 2 of 4 | 4 of 4 |
| tool_result bytes seen | 2,946 | 2,041 | 2,684 | 1,373 |
| Tool calls (median) | 4 | 2 | 2.5 | 2 |
| Success (top author named) | 4/4 | 4/4 | 4/4 | 4/4 |

v2 against v1: 0.3% more, likely 22% lower to 23% more, same. v1 made no plugin tool call in any measured cycle (0 of 4).

### Web scraping

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.120 | $0.146 | $0.154 | $0.059 |
| Saving vs direct | – | cost 21% more, likely 23% less to 66% more, **same** (range crosses zero) | cost **28% more**, likely 11 to 46% more, **more** | **51% lower**, likely 30 to 72%, **less** |
| Head-to-head | – | 1 of 4 | 0 of 4 | 4 of 4 |
| tool_result bytes seen | 2,340 | 2,565 | 5,817 | 0 |
| Tool calls (median) | 2 | 1 | 2 | 0 |
| Success (completion check) | 4/4 | 4/4 | 4/4 | **0/4** |

v2 against v1: 6% more, likely 27% lower to 38% more, same. The gateway sessions ended after 1 turn with no client tool call. See "Success".

### Large JSON API

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.118 | $0.242 | $0.138 | $0.076 |
| Saving vs direct | – | cost **105% more**, likely 86 to 124% more, **more** | cost 17% more, likely 18% less to 52% more, **same** (range crosses zero) | **35% lower**, likely 18 to 52%, **less** |
| Head-to-head | – | 0 of 4 | 1 of 4 | 4 of 4 |
| tool_result bytes seen | 1,825 | 3,252 | 1,716 | 741 |
| Tool calls (median) | 2.5 | 8 | 4 | 1 |
| Success (record check) | 0/4 | 0/4 | 0/4 | 0/4 |

v2 against v1: **43% lower**, likely 17 to 69%, less. No arm passed. 13 of 16 sessions failed with `no-served-data-on-disk`: the model built the 20,000 records in memory, so the check had no file to read the record from. 3 direct sessions served a file, and each answer missed 1 value of the record (1 of 8, 1 of 4, 1 of 8). The 0/4 figures are a fault of the check design (named as an open risk before the run). They do not show that the answers were wrong. The cost figures are valid.

### Documentation search

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.162 | $0.203 | $0.250 | $0.057 |
| Saving vs direct | – | cost **25% more**, likely 6 to 45% more, **more** | cost **54% more**, likely 18 to 90% more, **more** | **65% lower**, likely 41 to 88%, **less** |
| Head-to-head | – | 0 of 4 | 0 of 4 | 4 of 4 |
| tool_result bytes seen | 11,604 | 16,971 | 19,971 | 0 |
| Tool calls (median) | 4 | 3 | 8.5 | 0 |
| Success (completion check) | 4/4 | 4/4 | 4/4 | **0/4** |

v2 against v1: 23% more, likely 10% lower to 56% more, same. The gateway sessions ended after 1 turn with no client tool call.

### Session continuity (demonstration only, 2 cycles)

| | Direct | v1 | v2 | Context Mode Gateway |
|---|---:|---:|---:|---:|
| Mean cost | $0.242 | $0.333 | $0.300 | $0.149 |
| tool_result bytes seen | 1,438 | 3,006 | 2,611 | 638 |
| Success (completion check) | 2/2 | 2/2 | 2/2 | 2/2 |

No range and no verdict (prereg). No session compacted, so compaction recovery was not tested.

### Sum over all counted pairs

A sum over the 20 measured pairs of the five counted prompts. No range: the rows are different prompts.

| Arm | Direct total | Arm total | Change | Cost less | Success |
|---|---:|---:|---:|---|---|
| v1 | $3.177 | $4.295 | +35.2% | 4 of 20 | 16 of 20 |
| v2 | $3.177 | $3.522 | +10.9% | 7 of 20 | 16 of 20 |
| Gateway | $3.177 | $1.785 | −43.8% | 20 of 20 | 7 of 20 |

Direct success: 16 of 20.

### Where the range crosses zero

With n = 4, these rows show no clear difference from direct: v1 on repo-research, git-history and web-scrape; v2 on repo-research, git-history and large-json. The gateway range is below zero on all 5 prompts. v2 against v1 crosses zero on 4 of 5 prompts (all but large-json).

### Success: read this before the gateway cost

- In 9 of 20 measured gateway sessions (web-scrape 4, docs-search 4, repo-research 1) the client made no tool call and the session ended after 1 turn. The completion check needs at least one client tool call, so these count as failures. That is the prereg rule and we did not change it.
- In each of these 9 sessions the gateway's own record counts 1 or 2 edge calls, and tokens the client did not see. We did not check what those calls did, and we do not use the model's answer text as evidence. So whether the gateway did the task in these sessions is **INCONCLUSIVE**.
- The gateway cost includes those hidden calls: it comes from the gateway's per-call record, not from the client.
- A lower cost with a failed check is not a saving you can claim. On git-history, where every arm passed a real check, the gateway cost 46% less (likely 11 to 81%).

## README claims checked

Claims from the "Try It" section of README.md at origin/main `a92cf6a7`, checked against the v1 arm. Rule (prereg): HOLDS when the measured median is within 25% of the claimed number. KB = 1,000 bytes (the verdicts are the same at 1,024). "Raw" uses the bytes the direct arm saw (prereg); this is not the size of the full data.

| Prompt | Claim | Measured (v1, median of 4) | Holds? |
|---|---|---|---|
| Deep repo research | 5 calls | 4 calls (range 3 to 4) | true |
| Deep repo research | 62 KB context | 32.7 KB (16.0 to 53.1) | false |
| Deep repo research | raw: 986 KB | direct saw 24.1 KB (20.9 to 31.4) | false |
| Deep repo research | 94% saved | −33.2%: v1 showed more bytes than direct (−155 to 49) | false |
| Git history analysis | 1 call | 2 calls (2 to 2) | false |
| Git history analysis | 5.6 KB context | 2.0 KB (2.0 to 2.1) | false (v1 showed less) |
| Web scraping | 1 call | 1 call (1 to 3) | true |
| Web scraping | 3.2 KB context | 2.2 KB (2.2 to 3.6) | false (v1 showed less) |
| Large JSON API | 7.5 MB raw | direct saw 1.6 KB (1.5 to 2.5) | false |
| Large JSON API | 0.9 KB context | 3.5 KB (1.8 to 4.3) | false |
| Large JSON API | 99% saved | −83.4%: v1 showed more bytes than direct (−156 to −18) | false |
| Documentation search | 2 calls | 3 calls (3 to 3) | false |
| Documentation search | 1.8 KB context | 16.9 KB (16.9 to 17.1) | false |
| Session continuity | compaction recovery with full state | 0 compactions in 2 v1 sessions | INCONCLUSIVE |

Call counts include ToolSearch calls. Without them the medians are repo-research 3.5, git-history 2, web-scrape 1, docs-search 2. The direct arm did not dump the full data on these prompts: the model filtered it with its own commands. So the "raw" and "% saved" claims compare v1 with a direct arm that already saw little.

## How we measured

- **Paired runs.** Per prompt, 1 warm-up cycle (not counted) and 4 measured cycles. One cycle runs direct, v1, v2 and the gateway back to back. The start arm rotates by cycle, so each arm starts once. session-continuity: 2 cycles, no warm-up.
- **The real client.** `claude -p` with Claude Code 2.1.303 (version checked at start and end), `--model claude-opus-5-5`, `--max-turns 60`, `--permission-mode bypassPermissions`, `--max-budget-usd 3`, stdin closed, a fresh config dir and a fresh empty cwd per session, 900 s limit. Direct and the plugin arms use `--strict-mcp-config`; direct has an empty MCP map.
- **Arms we checked.** We read each arm from the session's own `init` event, not from model text. v1: origin/main `a92cf6a7`, version 1.0.169, clean tree. v2: v2-design `7f320e16` built to `release-out`, clean tree. Gateway: `ANTHROPIC_BASE_URL` set to the deployed gateway at `https://gateway.context-mode.com`, default tenant flags (read before and after each run, unchanged), one new disposable tenant per prompt (ids withheld). The gateway version was the same before and after each run. No run was void, and no cycle ran a second time.
- **The cost.** Direct, v1 and v2: list price on the token counts in each session's result event (Opus 5.5 per million tokens: input $4, output $20, cache read $0.20, cache write 5 min $5, 1 h $8). Gateway: the same prices on the gateway's per-call record for the session, hidden calls included. Each record was found, complete, and covered all tokens the client saw. `analyze.mjs` prices every row again and stops on any difference.
- **Bytes seen.** `measure-bytes.mjs` reads each private transcript once and sums the UTF-8 bytes of every tool_result block. It writes [tool-result-bytes.json](tool-result-bytes.json), with the SHA-256 of each transcript. For the gateway this is what the client sent; the gateway can change it on the way, and its record does not hold that size. Tool calls are counted from the transcript. The `tools` field in the run files counts fewer calls in 13 sessions; we use the transcript count.
- **Success checks.** git-history: the answer names the top `git shortlog -sn` author over the same 500 commits. large-json: the planted record value is in the answer, read against the served file on disk. The rest: end_turn, at least one client tool call, a non-empty answer.
- **Written down first.** [prereg.md](prereg.md) was pushed as `f924eda2` at 2026-10-22T10:51Z. The first run file was pushed at 2026-10-22T11:13Z.
- **Analysis.** d = arm − direct per cycle. Change = 100 × mean(d) / mean(direct), with the 95% t range at df = n − 1. Verdict "less" when the whole range is below zero, "more" when it is above zero, else "same". Every measured cycle counts, failures included. We dropped no outlier.
- **Spend.** 108 sessions (20 warm-up, 88 measured), $18.15 at list price. Stop rule $80, not reached.

## Verify it yourself

```
git clone --branch v2-design https://github.com/mksglu/context-mode.git
cd context-mode/docs/benchmarks/try-it
node analyze.mjs --check   # exit 0: ab.json and index.json match the run files
node analyze.mjs           # writes them again and prints one line per prompt and per claim
```

`analyze.mjs` uses no clock, no network and no random numbers. It stops on an unresolved arm, a model or client change, a changed plugin or harness commit, a gateway record that is missing or does not cover the client, a cost that does not match its token columns, or a success flag that does not match the check result. `measure-bytes.mjs` needs the raw transcripts, which we keep private; its output holds each transcript's SHA-256. The run files hold token counts, cost, success, tool-call names and the arm evidence. We withheld answer text, session ids, tenant ids, local paths and transcripts. To run the cycles again, see [bench/gateway-ab/README.md](../../../bench/gateway-ab/README.md) and `tryit.patch`.

## Sources

- Pre-registration: [prereg.md](prereg.md) (commit `f924eda2`).
- Evidence: [ab.json](ab.json), [index.json](index.json), [tool-result-bytes.json](tool-result-bytes.json), run files in [runs/](runs/).
- Scripts: [analyze.mjs](analyze.mjs), [measure-bytes.mjs](measure-bytes.mjs).
- Claims: README.md "Try It" at origin/main `a92cf6a77ac02971fb5fafe2155e5ee229491884`.
- Harness: [bench/gateway-ab/](../../../bench/gateway-ab/) (`tryit.patch`).
- Method: [../v1-v2-gateway/README.md](../v1-v2-gateway/README.md).
