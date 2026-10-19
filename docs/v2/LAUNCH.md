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

- Aims at less tool output in context per turn. Measured so far: no saving on
  single-task sessions (see "Measured numbers").
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
| Offline replay: bytes v2 would return vs bytes the model got | 1.1% saving; -1.5% with the re-run bound (23175 tool calls, 820 sessions) | `docs/v2/benchmarks.md`, 2026-10-19, Claude Code transcripts mostly 2.1.149 to 2.1.283, Node v26.8.1 |
| Live A/B, session input saving per task (median, min, max over 20 tasks) | -6.7%, -6.9%, +29.7%; the plugin arm read more | `docs/v2/benchmarks.md`, 2026-10-19, Claude Code 2.1.303, claude-sonnet-5-5 effort low |
| Live A/B, fresh input saving (median) | -18.6% | same |
| Live A/B success | on 60/60, off 60/60 | same |
| Live A/B list-price cost (estimate, not a bill) | on $1.4121, off $1.2744 | same |
| Live routing, run 4 (new rule) | under 0/20 on all 3 models; over 0/20 opus-5-5, 0/20 sonnet-5-5, 1/20 haiku-5-5; correct 40/40 each | `docs/v2/prompt/results.md`, 2026-10-19, Claude Code 2.1.303 |
| Claude Code hook p95 (GS6) | 41 ms; budget `HOOK_P95_MS` 40 ms: FAIL | `docs/v2/TECH-SPEC.md` §1.1, 2026-10-20, macOS, Node 26 |
| 64 KB PostToolUse hook p95 (`T-F1` Case B) | 62 ms; budget `HOOK_COMBINED_P95_MS` 60 ms: FAIL | same |
| v2 issue backlog resolved | 329 deduplicated rows (from 357 open issues/PRs), one outcome each | `PRD-v2.md` §1, `docs/v2/review/ISSUE-OUTCOMES-r4.md` |

What these runs show: on single-task sessions v2 gives no token saving. The
three JSON tasks where the model called a ctx tool saved 29.6 to 29.7%
session input; the other tasks read 6.6 to 6.9% more. Full caveats are in
`docs/v2/benchmarks.md`. More hook numbers: `docs/performance.md`.

## Claims we do not make

- We do not claim v2 saves tokens. The measured runs above show no saving
  on single-task sessions (`docs/v2/benchmarks.md`).
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
