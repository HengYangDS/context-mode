# Spike S-UI: prompt UI, bundled `@clack/prompts` or own `node:readline` module

Date 2026-10-22. Status: done. Pass column (ADR-0019): "pty test of the full flow on macOS, Linux, Windows". This spike ran macOS only (Darwin 23.5, Node v26.8.1, Python 3.11.6 pty). Linux and Windows are not run.

## Method
Two prototypes of the same flow: multi-select of 3 agents, confirm, spinner with 3 steps, summary table. Bundled with esbuild 0.28.2 (`--bundle --minify --platform=node --format=esm`). Each was driven in a pty (python3 `pty.fork`, window 30x100) with keys: space, down, down, space, enter, `y`. Then run with stdin not a TTY (pipe and `/dev/null`) and with `NO_COLOR=1` in a pty.

## Raw numbers
| | @clack/prompts 1.8.1 | own readline module |
|---|---|---|
| Licence | MIT (also `@clack/core` 1.5.1) | none needed |
| Prototype source | 10 lines | 32 lines (about 25 more for cancel/redraw/non-TTY polish) |
| Bundle, minified | 24171 bytes | 1814 bytes |
| node_modules on disk | 172 KB (+20 KB sisteransi) | 0 |
| Runtime deps after bundle | 0 | 0 |

Clack has 4 direct dependencies (sisteransi, @clack/core, fast-wrap-ansi, fast-string-width). All are inlined by the bundle.

## pty results (macOS)
- Clack: keys select claude + gemini. Screen ends with the boxed Summary and `RESULT ["claude","gemini"]`. PASS.
- Readline: same keys, same result `RESULT ["claude","gemini"]`. PASS.
- `NO_COLOR=1` in pty: colour (SGR) sequences: 0 in both. Other escapes (cursor, erase): clack 34, readline 10, so both honour NO_COLOR for colour; both still move the cursor in a TTY.
- Stdin not a TTY (pipe `claude,codex`, and `/dev/null`):
  - Clack: prints the first prompt, then exits code 13 (unsettled top-level await). It never reads the pipe. The non-TTY path needs our own code (`--yes`, `--agents`), as ADR-0019 already says.
  - Readline: reads one line from the pipe, finishes, exit 0 (`/dev/null` gives an empty selection, exit 0). Plain text, no escapes.

## Verdict
Pass for macOS only. Both options work with a TTY. Neither removes the need for an own non-TTY and flag path.

Recommendation: bundled `@clack/prompts`.
- Reason: the "Vercel `skills` look" is a stated goal of ADR-0019. Clack gives it with 10 lines, with tested cancel (Ctrl+C), resize, wide-char width and redraw handling. 24 KB is small against the package.
- Cost: our wrapper must test `process.stdin.isTTY && process.stdout.isTTY` and use the flag path before any clack call, and must treat `isCancel` as exit 130.
- Own readline module is 13x smaller, but we would own raw-mode, redraw, resize, Windows console and Unicode width bugs. Choose it only if the 24 KB or a clack licence change matters.

## What ADR-0019 must change
1. Replace "Spike S-UI decides" with: prompt UI is `@clack/prompts` (MIT), bundled at build time, `devDependency` only, no runtime dependency.
2. State: the TTY check and the `--yes`/`--agents`/`--json` path run before any prompt call; clack never runs without a TTY (it exits 13).
3. Add a build gate: bundle size of the prompt layer at most 40 KB minified; licence check in CI.
4. Keep S-UI open for Linux and Windows pty runs (Windows has no pty module in python; use ConPTY in CI). Move to Accepted only after those pass.
