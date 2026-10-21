# context-mode — launch notes

## The problem

AI coding agents lose time and money on three things:

1. **Context fills up.** A tool call can return tens of KB of raw text (logs,
   docs, search results). That text eats the agent's context window, so it
   has less room to think.
2. **Work is lost after compaction.** When an agent's context is cut down,
   earlier tool output and decisions can disappear.
3. **Cost.** Every token in context costs money and time, on every turn,
   not just once.

context-mode is an MCP server plus hooks that keeps large tool output out
of the agent's context, stores it, and lets the agent search it back on
demand.

## Who it is for

Teams and solo builders who run AI coding agents (Claude Code, Codex CLI,
Gemini CLI, Qwen Code, Copilot CLI, VS Code Copilot, Kiro, ZCode, Pi,
OpenCode 2) on real codebases, where tool output is large: logs, test
runs, search results, docs.

## Business value

- Aims at less tool output in context per turn. Measured so far: a saving on large
  outputs only; on small single-task sessions v2 uses more tokens than no plugin
  (see "Measured numbers").
- No text is thrown away: output is indexed, not deleted, so the agent can
  always search back for the exact bytes it needs.
- One shared store per project, so work survives a context compaction.

## 10 supported agents (v2.0 scope)

| Agent | Install mode |
|---|---|
| Claude Code | marketplace plugin |
| Codex CLI | `config.toml` MCP entry |
| Gemini CLI | extension |
| Qwen Code | extension |
| Copilot CLI | plugin |
| VS Code Copilot | MCP entry |
| Kiro | MCP entry |
| ZCode | hooks + MCP |
| Pi | in-process plugin |
| OpenCode 2 | in-process plugin |

Source: `PRD-v2.md` §3, `docs/v2/TECH-SPEC.md` §2.

## What is new in v2 vs v1

| Area | v1 | v2 |
|---|---|---|
| Fallback paths | Each adapter had its own runtime fallback for host differences | One path per feature; no fallback chains (PRD P1) |
| Agents | Grew ad hoc, adapter by adapter | Fixed scope of 10 agents, same code path on each (PRD P2) |
| Hooks | Could touch DB or network | Hooks are pure: no DB, no network, no spawn (PRD P4) |
| Idle cost | Timers and boot-time probes ran in the background | Idle server uses 0% CPU: no scanning timers, no boot probes (PRD P5) |
| Tests | Tests written after code, case by case | Every case gets a green end-to-end test before its code (PRD P6) |
| Issue backlog | 357 open issues/PRs, no single outcome per item | Every issue given one explicit outcome: 159 closed-by-design, 111 covered-by-test, 55 wont-fix, 2 merged, 1 unverified pending a release decision (329 deduplicated rows, source: `docs/v2/review/ISSUE-OUTCOMES-r4.md` via `PRD-v2.md` §1) |

## Measured numbers

Only measured numbers, each with its source, date and agent version. The old
v1 savings figures (from the removed `BENCHMARK.md`) are gone: no
file in this repo measures them now.

| Number | Value | Source, date, agent |
|---|---|---|
| Final A/B: sessions and pass | 54 sessions (3 runs x 6 tasks x 3 arms), all pass 18/18 per arm | `bench/live/results/ab-final.json`, `docs/v2/benchmarks.md`, 2026-10-20, Claude Code 2.1.303, claude-sonnet-5-5 low |
| Final A/B: median session tokens | off 36,217; v1 42,557; v2 38,252 | same |
| Final A/B: saving vs off (median / min / max) | v1 -17.5 / -61.3 / -15.1 %; v2 -5.5 / -5.7 / +30.4 % | same |
| Final A/B: v2 vs v1 (median / min / max) | +10.2 / +10.0 / +56.9 % | same |
| Final A/B: median tool_result bytes; ctx calls | bytes: off 46.5, v1 46.5, v2 31; calls: v1 2, v2 3 | same |
| Final A/B: cost (list price, estimate) | off 0.534, v1 0.747, v2 0.687, total 1.97 USD | same |
| Saving loop score | M1 94.12, M2 88.9, guards pass (head 1d55d561f4cf62e5f8584c4958ee60522b012bd5) | `bench/saving-score-last.json`, 2026-10-20 |
| Offline replay (old policy with hints): bytes v2 would return vs bytes the model got | 1.1% saving; -1.5% with the re-run bound (23175 tool calls, 820 sessions) | `docs/v2/benchmarks.md`, 2026-10-19, Claude Code transcripts mostly 2.1.149 to 2.1.283, Node v26.8.1 |
| Earlier live A/B (20 tasks x 3 runs, before the replace changes), session input saving (median, min, max) | -6.7%, -6.9%, +29.7%; pass on 60/60, off 60/60 | `docs/v2/benchmarks.md`, 2026-10-19, Claude Code 2.1.303 |
| Live routing, run 4 (new rule) | under 0/20 on all 3 models; over 0/20 opus-5-5, 0/20 sonnet-5-5, 1/20 haiku-5-5; correct 40/40 each | `docs/v2/prompt/results.md`, 2026-10-19, Claude Code 2.1.303 |
| Memory live cases | 4/4 PASS; fixture R2 recall@5 1.000 on 6 queries (smoke gate, not an estimate); model spend 0.0510 USD | `docs/v2/benchmarks.md` "Memory", 2026-10-21, claude-sonnet-5-5 low |
| Memory, stored real-data run (not re-run) | R2 recall@5 0.743, MRR 0.671 (148 queries); decision recall@5 0.744 (39 queries); timeline 43/47 | `tickets/memory-retrieval/eval/results.md` via `docs/v2/benchmarks.md` |
| Compaction pointer, `T-CMP` | correct 7/10 in every arm a to e; `ctx_resume`/`ctx_search` call rate 0/10; 0 bytes returned in 50 sessions; total 4.5222 USD | `docs/v2/benchmarks.md` "Compaction pointer", 2026-10-21, Sonnet 5.5 low |
| Claude Code hook p95 (GS6) | 41 ms; budget `HOOK_P95_MS` 40 ms: FAIL | `docs/v2/TECH-SPEC.md` §1.1, 2026-10-20, macOS, Node 26 |
| 64 KB PostToolUse hook p95 (`T-F1` Case B) | 62 ms; budget `HOOK_COMBINED_P95_MS` 60 ms: FAIL | same |
| v2 issue backlog resolved | 329 deduplicated rows (from 357 open issues/PRs), one outcome each | `PRD-v2.md` §1, `docs/v2/review/ISSUE-OUTCOMES-r4.md` |

What these runs show: on tasks with a small output the plugin adds a fixed prompt cost
(about +2.0k tokens for v2, +6.3k for v1), so the median saving is negative. v2 saves
where the output is large (json-1 -30.4% vs off, v1 -61.3%). v2 uses fewer tokens than
v1 on every task. The model called a ctx tool in few sessions (v1 2, v2 3 of 18).
Caveats: n=3 per cell, one date, list-price cost. Full caveats are in
`docs/v2/benchmarks.md`. More hook numbers: `docs/performance.md`.

## Claims we do not make

- We do not claim v2 saves tokens on every session. The final A/B shows a
  median saving of -5.5% against no plugin (v2 used more); a saving appears
  only on large outputs (`docs/v2/benchmarks.md`).
- We do not claim the compaction pointer works. In `T-CMP` the model never
  called `ctx_resume` or `ctx_search` from it (0/10 in every arm).
- We do not claim v2 meets its hook latency budget. GS6 is FAIL
  (`docs/v2/TECH-SPEC.md` §1.1).
- We do not claim v2 has confirmed that Copilot CLI's MCP `instructions` field
  reaches the model. ADR-0004 records a live probe on Copilot CLI 1.0.60 with
  v1; no v2 build has run that check yet.
- We do not claim any install command works yet. Every row of the
  `README.md` install table says "see guide", because no agent has passed a
  live install test (`docs/install/README.md`).
- We do not claim zero data loss as a design choice: the design bans
  truncation and cutting a reply mid-item as a *reduction mechanism*
  (`docs/v2/impl/DEVIATIONS.md`, D-M2-T5-1, D-M2-T10-6); we do not claim
  this has been proven for every code path yet, only for the ones listed
  in `DEVIATIONS.md`.
- We do not claim a CLI or `cli.mjs` entry point. Install, update and
  diagnosis run through each host's own mechanism plus the `ctx_doctor`
  and `ctx_upgrade` tools (`PRD-v2.md` §3).

## Short copy for a release post

**context-mode v2 keeps large tool output out of your AI agent's context.**
Logs, search results, and docs get stored and indexed instead of filling
the context window. Your agent searches back for the exact text it needs,
on any of 10 supported agents, with one code path and no fallback chains.
